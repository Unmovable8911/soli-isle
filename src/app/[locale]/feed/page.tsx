import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Feed, FeedHeading } from "@/components/feed";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { isLocale } from "@/config/site";
import { feedView } from "@/http/posts";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeedParams = { locale: string };
type FeedSearchParams = Record<string, string | string[] | undefined>;

/**
 * A Post has no page of its own and must never be indexed: the Feed is noindex,
 * it contributes nothing to the Sitemap, and there is no per-Post URL for a
 * crawler to find in the first place.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<FeedParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }

  const t = messages[locale];
  return {
    title: `${t.reader.feed.title} · ${t.meta.title}`,
    description: t.meta.description,
    robots: { index: false, follow: true },
  };
}

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<FeedParams>;
  searchParams: Promise<FeedSearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const query = await searchParams;
  const requestedTag = query.tag;
  const tagSlug =
    typeof requestedTag === "string" && requestedTag.length > 0 ? requestedTag : null;

  const context = getAppContext();
  const outcome = await feedView(context.posts, { locale, tagSlug });
  if (!outcome.ok) {
    // A Slug no Tag answers to is an unknown resource, exactly like an unknown
    // Article Slug: 404, never the unfiltered Feed under a filtered URL.
    notFound();
  }
  const view = outcome.view;
  const t = messages[locale];

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <FeedHeading
        locale={locale}
        tag={view.tag}
        labels={t.reader.feed}
        title={t.reader.feed.title}
        lead={t.reader.feed.lead}
      />
      <Feed
        initialPosts={view.posts}
        initialCursor={view.nextCursor}
        tagSlug={view.tag?.slug ?? null}
        locale={locale}
        labels={t.reader.feed}
        lightboxLabels={t.reader.lightbox}
      />
    </main>
  );
}
