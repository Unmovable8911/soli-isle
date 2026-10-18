import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleList } from "@/components/article-list";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { archiveMonths, formatArchiveMonth } from "@/domain/article-time";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { createReadingContext, listArchiveArticles } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  // A derived index of everything is exactly what a search engine should skip.
  return { title: `${messages[locale].reader.archive.title}`, robots: { index: false } };
}

export default async function ArchivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const t = messages[locale];
  const context = getAppContext();
  const articles = await listArchiveArticles(createReadingContext(context.database, context.clock), {
    locale,
  });
  const months = archiveMonths(articles, (article) => article.publishTime);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <h1>{t.reader.archive.title}</h1>
      {months.length === 0 ? (
        <p className="reader-empty">{t.reader.archive.empty}</p>
      ) : (
        months.map((month) => (
          <section key={`${month.year}-${month.month}`} className="reader-month">
            <h2>{formatArchiveMonth(month.year, month.month, locale)}</h2>
            <ArticleList articles={month.items} locale={locale} labels={t.reader.list} />
          </section>
        ))
      )}
    </main>
  );
}
