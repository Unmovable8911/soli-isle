import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchiveIndex } from "@/components/archive-index";
import { ReaderPageHead } from "@/components/reader-page-head";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { archiveMonths } from "@/domain/article-time";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listArchiveArticles } from "@/services/reading";

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
  const articles = await listArchiveArticles(context.reading, {
    locale,
  });
  const months = archiveMonths(articles, (article) => article.publishTime);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <ReaderPageHead locale={locale} title={t.reader.archive.title} />
      {months.length === 0 ? (
        <p className="reader-empty">{t.reader.archive.empty}</p>
      ) : (
        <ArchiveIndex months={months} locale={locale} />
      )}
    </main>
  );
}
