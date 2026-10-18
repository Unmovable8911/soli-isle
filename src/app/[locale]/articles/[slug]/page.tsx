import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ArticleBody } from "@/components/article-body";
import { ArticleLanguageVersions, FallbackNotice } from "@/components/article-language";
import { ImageZoom } from "@/components/lightbox";
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
import { buildCategoryPath, buildTagPath } from "@/domain/public-paths";
import { pickLocalised } from "@/domain/localised";
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

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <article className="reader-article">
        <header className="reader-article-header">
          <h1>{translation.title}</h1>
          <p className="reader-article-meta">
            {article.publishTime !== null && (
              <>
                <span>{t.reader.article.publishedOn}</span>{" "}
                <time dateTime={article.publishTime}>
                  {formatPublishDate(article.publishTime, locale)}
                </time>
              </>
            )}
            {article.category !== null && (
              <>
                {" · "}
                <Link href={buildCategoryPath({ locale, categoryPath: article.category.path })}>
                  {pickLocalised(article.category.names, locale, article.category.slug)}
                </Link>
              </>
            )}
          </p>
          {article.tags.length > 0 && (
            <ul className="reader-tags">
              {article.tags.map((tag) => (
                <li key={tag.id}>
                  <Link href={buildTagPath({ locale, slug: tag.slug })}>
                    {pickLocalised(tag.names, locale, tag.slug)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>
        {fellBack && (
          <FallbackNotice
            labels={t.reader.fallback}
            requested={t.chrome.localeNames[locale]}
            shown={t.chrome.localeNames[translation.locale]}
          />
        )}
        <ArticleLanguageVersions
          current={locale}
          versions={links.versions}
          names={t.chrome.localeNames}
          labels={t.reader.languages}
        />
        <ImageZoom labels={t.reader.lightbox}>
          <ArticleBody html={html} />
        </ImageZoom>
        <nav className="reader-article-nav" aria-label={translation.title}>
          {neighbours?.older != null && (
            <Link
              className="reader-article-previous"
              href={buildArticlePath({ locale, slug: neighbours.older.slug })}
            >
              <span>{t.reader.article.previous}</span>
              {neighbours.older.title}
            </Link>
          )}
          {neighbours?.newer != null && (
            <Link
              className="reader-article-next"
              href={buildArticlePath({ locale, slug: neighbours.newer.slug })}
            >
              <span>{t.reader.article.next}</span>
              {neighbours.newer.title}
            </Link>
          )}
        </nav>
      </article>
    </main>
  );
}
