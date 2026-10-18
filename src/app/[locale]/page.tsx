import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleList } from "@/components/article-list";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import {
  buildArchivePath,
  buildCategoryIndexPath,
  buildSearchPath,
} from "@/domain/public-paths";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listRecentArticles } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECENT_LIMIT = 20;

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

  const t = messages[locale];
  const context = getAppContext();
  const articles = await listRecentArticles(context.reading, {
    locale,
    limit: RECENT_LIMIT,
  });

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <h1>{t.reader.home.title}</h1>
      <p className="reader-lead">{t.reader.home.lead}</p>
      <nav className="reader-entries" aria-label={t.reader.home.title}>
        <ul>
          <li>
            <Link href={buildCategoryIndexPath(locale)}>{t.reader.nav.categories}</Link>
          </li>
          <li>
            <Link href={buildArchivePath(locale)}>{t.reader.nav.archive}</Link>
          </li>
          <li>
            <Link href={buildSearchPath({ locale })}>{t.reader.nav.search}</Link>
          </li>
        </ul>
      </nav>
      {articles.length === 0 ? (
        <p className="reader-empty">{t.reader.home.empty}</p>
      ) : (
        <ArticleList articles={articles} locale={locale} labels={t.reader.list} />
      )}
    </main>
  );
}
