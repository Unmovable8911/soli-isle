import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleList } from "@/components/article-list";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { buildTagPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { createReadingContext, findReaderTag } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TagParams = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<TagParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = messages[locale];
  const context = getAppContext();
  const found = await findReaderTag(createReadingContext(context.database, context.clock), {
    locale,
    slug: decodeURIComponent(slug),
  });
  if (found === null) {
    return {};
  }
  return {
    title: `${found.tag.name} · ${t.meta.title}`,
    alternates: { canonical: buildTagPath({ locale, slug: found.tag.slug }) },
  };
}

export default async function TagPage({ params }: { params: Promise<TagParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const t = messages[locale];
  const context = getAppContext();
  const found = await findReaderTag(createReadingContext(context.database, context.clock), {
    locale,
    slug: decodeURIComponent(slug),
  });
  if (found === null) {
    notFound();
  }

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <h1>
        <span className="reader-tag-mark" aria-hidden="true">
          #
        </span>
        {found.tag.name}
      </h1>
      <ArticleList articles={found.articles} locale={locale} labels={t.reader.list} />
    </main>
  );
}
