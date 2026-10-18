import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ArticleView } from "@/components/article-view";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale, type Locale } from "@/config/site";
import {
  buildAssetAddress,
  extractAssetIds,
  isSafeAssetId,
  parseAssetAddress,
} from "@/domain/asset-address";
import { alternateLanguageMap, articleLanguageLinks } from "@/domain/article-language";
import { formatPublishDate } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { buildCategoryIndexPath, buildCategoryPath, buildTagPath } from "@/domain/public-paths";
import { pickLocalised } from "@/domain/localised";
import { buildTableOfContents } from "@/domain/table-of-contents";
import { absoluteUrl } from "@/domain/urls";
import { renderArticleBody } from "@/editor/render/render-article";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { findReadableArticle, type ReadableArticle } from "@/services/articles";
import {
  findArticleNeighbours,
  resolveBodyImages,
} from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ArticleParams = { locale: string; slug: string };

/** One lookup per request, shared by `generateMetadata` and the page. */
const readArticle = cache(
  async (locale: Locale, slug: string): Promise<ReadableArticle> =>
    findReadableArticle(getAppContext().articles, { slug, locale }),
);

/** The first body image, as the address the media route actually serves. */
function sharedImagePath(translation: { bodyJson: string }): string | null {
  const [assetId] = extractAssetIds(translation.bodyJson);
  if (assetId === undefined || !isSafeAssetId(assetId)) {
    return null;
  }
  return buildAssetAddress({ assetId, variant: "display", format: "webp" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ArticleParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    return {};
  }

  const found = await readArticle(locale, decodeURIComponent(slug));
  if (found.kind !== "found") {
    return {};
  }

  const t = messages[locale];
  const { translation, article } = found;
  // The page's own language declarations: canonical at the version it shows,
  // alternates only for the Locales that really have one.
  const headerSource = await headers();
  const links = articleLanguageLinks({
    slug: article.slug,
    shownLocale: translation.locale,
    translations: article.translations,
    headers: headerSource,
  });
  const languages = alternateLanguageMap(links);

  const imagePath = sharedImagePath(translation);
  const image = imagePath === null ? null : absoluteUrl(imagePath, headerSource);

  return {
    title: `${translation.title} · ${t.meta.title}`,
    description: translation.summary,
    alternates: { canonical: links.canonical, languages },
    robots: found.indexable ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
      title: translation.title,
      description: translation.summary,
      url: links.canonical,
      publishedTime: article.publishTime ?? undefined,
      images: image === null ? undefined : [{ url: image, alt: translation.title }],
    },
    twitter: {
      card: image === null ? "summary" : "summary_large_image",
      title: translation.title,
      description: translation.summary,
      images: image === null ? undefined : [image],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<ArticleParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const found = await readArticle(locale, decodeURIComponent(slug));
  if (found.kind === "not-found") {
    notFound();
  }
  if (found.kind === "permanently-removed") {
    // The 410 itself is answered before the page runs; see `src/middleware.ts`.
    notFound();
  }

  const t = messages[locale];
  const { article, translation, fellBack } = found;
  const context = getAppContext();
  const images = await resolveBodyImages(context.reading, translation.bodyJson);
  const html = await renderArticleBody(translation.bodyJson, {
    resolveImage: (src) => {
      const parsed = parseAssetAddress(src);
      return parsed === null ? null : (images.get(parsed.assetId) ?? null);
    },
    footnoteBackLabel: t.reader.article.footnoteBack,
  });
  const neighbours = await findArticleNeighbours(context.reading, {
    locale,
    articleId: article.id,
  });
  const links = articleLanguageLinks({
    slug: article.slug,
    shownLocale: translation.locale,
    translations: article.translations,
    headers: await headers(),
  });

  const toc = buildTableOfContents(translation.bodyJson);
  // The cover belongs to the work, not to one Locale, and the header shows it
  // whole: the display derivation keeps the original ratio.
  const cover =
    article.coverAssetId === null
      ? null
      : { address: buildAssetAddress({ assetId: article.coverAssetId, variant: "display", format: "webp" }) };

  const category =
    article.category === null
      ? null
      : {
          name: pickLocalised(article.category.names, locale, article.category.slug),
          href: buildCategoryPath({ locale, categoryPath: article.category.path }),
        };
  // The shell keeps the breadcrumb on the Category page and the long-form page,
  // out of the top bar: the Article shows where it sits in the one tree it
  // belongs to, and its own title closes the walk.
  const breadcrumbs = [
    { href: buildCategoryIndexPath(locale), label: t.reader.category.heading },
    ...(category === null ? [] : [{ href: category.href, label: category.name }]),
    { href: buildArticlePath({ locale, slug: article.slug }), label: translation.title },
  ];

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <Breadcrumbs label={t.reader.breadcrumb.label} items={breadcrumbs} />
      <ArticleView
        title={translation.title}
        summary={translation.summary}
        publishTime={article.publishTime}
        publishedOn={article.publishTime === null ? "" : formatPublishDate(article.publishTime, locale)}
        category={category}
        cover={cover}
        bodyHtml={html}
        toc={toc}
        versions={{ current: locale, links: links.versions, names: t.chrome.localeNames }}
        fallback={
          fellBack
            ? { requested: t.chrome.localeNames[locale], shown: t.chrome.localeNames[translation.locale] }
            : null
        }
        tags={article.tags.map((tag) => ({
          name: pickLocalised(tag.names, locale, tag.slug),
          href: buildTagPath({ locale, slug: tag.slug }),
        }))}
        neighbours={{
          previous:
            neighbours?.older == null
              ? null
              : {
                  title: neighbours.older.title,
                  href: buildArticlePath({ locale, slug: neighbours.older.slug }),
                },
          next:
            neighbours?.newer == null
              ? null
              : {
                  title: neighbours.newer.title,
                  href: buildArticlePath({ locale, slug: neighbours.newer.slug }),
                },
        }}
        labels={{
          article: t.reader.article,
          languages: t.reader.languages,
          fallback: t.reader.fallback,
          lightbox: t.reader.lightbox,
        }}
      />
    </main>
  );
}
