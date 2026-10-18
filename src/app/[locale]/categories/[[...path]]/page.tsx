import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleGrid } from "@/components/article-grid";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryPills } from "@/components/category-pills";
import { EmptyState } from "@/components/empty-state";
import { ReaderPageHead } from "@/components/reader-page-head";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { buildCategoryIndexPath, buildCategoryPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { findReaderCategory, listReaderCategories } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CategoryParams = { locale: string; path?: string[] };

/** Next hands over the raw URL segments, so a Category Slug must be decoded here. */
function categoryPathFrom(segments: readonly string[] | undefined): string {
  return (segments ?? [])
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<CategoryParams>;
}): Promise<Metadata> {
  const { locale, path } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const t = messages[locale];
  const categoryPath = categoryPathFrom(path);
  if (categoryPath.length === 0) {
    return { title: `${t.reader.category.heading} · ${t.meta.title}` };
  }

  const context = getAppContext();
  const found = await findReaderCategory(context.reading, {
    locale,
    categoryPath,
  });
  if (found === null) {
    return {};
  }
  return {
    title: `${found.category.name} · ${t.meta.title}`,
    alternates: { canonical: buildCategoryPath({ locale, categoryPath }) },
  };
}

export default async function CategoryPage({ params }: { params: Promise<CategoryParams> }) {
  const { locale, path } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const t = messages[locale];
  const categoryPath = categoryPathFrom(path);

  if (categoryPath.length === 0) {
    return <CategoryIndex locale={locale} />;
  }

  const context = getAppContext();
  const found = await findReaderCategory(context.reading, {
    locale,
    categoryPath,
  });
  if (found === null) {
    notFound();
  }

  const breadcrumbs = [
    { href: buildCategoryIndexPath(locale), label: t.reader.category.heading },
    ...found.breadcrumbs.map((crumb) => ({
      href: buildCategoryPath({ locale, categoryPath: crumb.path }),
      label: crumb.name,
    })),
  ];

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <Breadcrumbs label={t.reader.breadcrumb.label} items={breadcrumbs} />
      <ReaderPageHead
        locale={locale}
        title={found.category.name}
        count={found.category.count}
      />
      {found.category.children.length > 0 && (
        <section className="reader-subcategories">
          <h2 className="reader-subcategories-heading">{t.reader.category.children}</h2>
          <CategoryPills categories={found.category.children} locale={locale} />
        </section>
      )}
      {found.articles.length === 0 ? (
        <EmptyState title={t.reader.list.emptyTitle} body={t.reader.category.empty} />
      ) : (
        <ArticleGrid articles={found.articles} locale={locale} />
      )}
    </main>
  );
}

async function CategoryIndex({ locale }: { locale: "zh" | "en" }) {
  const t = messages[locale];
  const context = getAppContext();
  const tree = await listReaderCategories(context.reading, {
    locale,
  });

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <ReaderPageHead
        locale={locale}
        title={t.reader.category.heading}
        lead={t.reader.category.lead}
      />
      {tree.length === 0 ? (
        <EmptyState title={t.reader.category.emptyTitle} body={t.reader.category.emptyIndex} />
      ) : (
        <div className="reader-category-index">
          <CategoryPills categories={tree} locale={locale} />
        </div>
      )}
    </main>
  );
}
