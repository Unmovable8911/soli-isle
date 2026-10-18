import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleGrid } from "@/components/article-grid";
import { EmptyState } from "@/components/empty-state";
import { ReaderPageHead } from "@/components/reader-page-head";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { buildSearchPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { searchArticles } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = { q?: string | string[] };

function readQuery(params: SearchParams): string {
  const value = params.q;
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return raw.trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  // A query-dependent page must never enter an index.
  return { title: messages[locale].reader.search.title, robots: { index: false, follow: true } };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const t = messages[locale];
  const query = readQuery(await searchParams);
  const context = getAppContext();
  const search = await searchArticles(context.reading, {
    locale,
    query,
  });

  const summary = t.reader.search.summary
    .replaceAll("{count}", String(search.results.length))
    .replaceAll("{query}", query);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <ReaderPageHead locale={locale} title={t.reader.search.title}>
        <form
          className="reader-search-form"
          action={buildSearchPath({ locale })}
          method="get"
          role="search"
        >
          <label htmlFor="reader-search-input">{t.reader.search.label}</label>
          <input
            id="reader-search-input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t.reader.search.placeholder}
          />
          <button type="submit">{t.reader.search.submit}</button>
        </form>
        <p className="reader-hint">{t.reader.search.hint}</p>
        {query.length > 0 && search.results.length > 0 && (
          <p className="reader-page-count reader-search-summary" role="status">
            {summary}
          </p>
        )}
      </ReaderPageHead>
      {query.length === 0 ? null : search.results.length === 0 ? (
        <EmptyState title={t.reader.search.emptyTitle} body={t.reader.search.empty} />
      ) : (
        <ArticleGrid articles={search.results} locale={locale} terms={search.terms} />
      )}
    </main>
  );
}
