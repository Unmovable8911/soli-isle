import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HOME_GRID_LIMIT, HOME_HERO_LIMIT, ReaderHome } from "@/components/reader-home";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listRecentArticles } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The hero and the grid are consecutive slices of one newest-first list. */
const HOME_LIMIT = HOME_HERO_LIMIT + HOME_GRID_LIMIT;

type LocaleParams = { locale: string };

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

export default async function HomePage({ params }: { params: Promise<LocaleParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const context = getAppContext();
  const articles = await listRecentArticles(context.reading, {
    locale,
    limit: HOME_LIMIT,
  });

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <ReaderHome articles={articles} locale={locale} />
    </main>
  );
}
