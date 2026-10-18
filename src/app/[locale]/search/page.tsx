import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleList } from "@/components/article-list";
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
      <h1>{t.reader.search.title}</h1>
      <form className="reader-search-form" action={buildSearchPath({ locale })} method="get" role="search">
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
      {query.length === 0 ? null : search.results.length === 0 ? (
        <p className="reader-empty">{t.reader.search.empty}</p>
      ) : (
        <>
          <p className="reader-search-summary" role="status">
            {summary}
          </p>
          <ArticleList
            articles={search.results}
            locale={locale}
            labels={t.reader.list}
            highlight={search.terms}
          />
        </>
      )}
    </main>
  );
}
