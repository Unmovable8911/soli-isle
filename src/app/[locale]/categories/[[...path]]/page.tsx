import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleList } from "@/components/article-list";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { buildCategoryIndexPath, buildCategoryPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { createReadingContext, findReaderCategory, listReaderCategories } from "@/services/reading";

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
  const found = await findReaderCategory(createReadingContext(context.database, context.clock), {
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
  const found = await findReaderCategory(createReadingContext(context.database, context.clock), {
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
      <h1>{found.category.name}</h1>
      {found.category.children.length > 0 && (
        <section className="reader-children">
          <h2>{t.reader.category.children}</h2>
          <ul>
            {found.category.children.map((child) => (
              <li key={child.id}>
                <Link href={buildCategoryPath({ locale, categoryPath: child.path })}>
                  {child.name}
                </Link>
                <span className="reader-count">{child.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ArticleList articles={found.articles} locale={locale} labels={t.reader.list} />
    </main>
  );
}

async function CategoryIndex({ locale }: { locale: "zh" | "en" }) {
  const t = messages[locale];
  const context = getAppContext();
  const tree = await listReaderCategories(createReadingContext(context.database, context.clock), {
    locale,
  });

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <h1>{t.reader.category.heading}</h1>
      {tree.length === 0 ? (
        <p className="reader-empty">{t.reader.list.empty}</p>
      ) : (
        <ul className="reader-children">
          {tree.map((node) => (
            <li key={node.id}>
              <Link href={buildCategoryPath({ locale, categoryPath: node.path })}>
                {node.name}
              </Link>
              <span className="reader-count">{node.count}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
