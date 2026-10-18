import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReaderHome } from "@/components/reader-home";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { resolveCategoryPath } from "@/domain/home-listing";
import { parsePageNumber } from "@/domain/pagination";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listReaderCategories, listRecentArticles } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LocaleParams = { locale: string };

/**
 * The query string is a URL anyone can edit, so both halves are optional: a
 * Category path and a page number, and nothing else on Home changes.
 */
type HomeSearchParams = {
  category?: string | string[];
  page?: string | string[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = messages[locale];
  return {
    title: `${t.reader.home.title} · ${t.meta.title}`,
    description: t.meta.description,
  };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<LocaleParams>;
  searchParams: Promise<HomeSearchParams>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) {
    notFound();
  }

  const context = getAppContext();
  // The hero, the grid and the paging are one newest-first list, so the whole
  // set is read once and the component decides how much of it to show.
  const [articles, categories] = await Promise.all([
    listRecentArticles(context.reading, { locale }),
    listReaderCategories(context.reading, { locale }),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <ReaderHome
        articles={articles}
        categories={categories}
        locale={locale}
        categoryPath={resolveCategoryPath(
          categories.map((category) => category.path),
          query.category,
        )}
        page={parsePageNumber(query.page)}
      />
    </main>
  );
}
