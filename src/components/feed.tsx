"use client";

import Link from "next/link";
import { useState } from "react";

import type { Locale } from "@/config/site";
import type { FeedCardView } from "@/domain/feed-view";
import { buildFeedPath } from "@/domain/public-paths";
import type { Messages } from "@/messages";

import { EmptyState } from "./empty-state";
import type { LightboxLabels } from "./lightbox";
import { PostCard, type FeedLabels } from "./post-card";

export type FeedListLabels = Messages["reader"]["feed"];

interface LoadOlderPage {
  posts: FeedCardView[];
  nextCursor: string | null;
}

/**
 * The Feed: the first batch arrives already rendered from the server, and
 * "load older" appends the next one. It never touches the URL and never asks
 * the server for the first page — paging is appending, not navigating.
 */
export function Feed({
  initialPosts,
  initialCursor,
  tagSlug,
  locale,
  labels,
  lightboxLabels,
}: {
  initialPosts: FeedCardView[];
  initialCursor: string | null;
  tagSlug: string | null;
  locale: Locale;
  labels: FeedLabels;
  lightboxLabels: LightboxLabels;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");

  async function loadOlder() {
    if (cursor === null || status === "loading") {
      return;
    }
    setStatus("loading");

    const params = new URLSearchParams({ locale, cursor });
    if (tagSlug !== null) {
      params.set("tag", tagSlug);
    }

    try {
      const response = await fetch(`/api/public/feed?${params.toString()}`);
      if (!response.ok) {
        setStatus("failed");
        return;
      }
      const page = (await response.json()) as LoadOlderPage;
      setPosts((current) => [...current, ...page.posts]);
      setCursor(page.nextCursor);
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  if (posts.length === 0) {
    return <EmptyState title={labels.emptyTitle} body={labels.empty} />;
  }

  return (
    <div className="feed">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          locale={locale}
          labels={labels}
          lightboxLabels={lightboxLabels}
        />
      ))}

      {cursor !== null && (
        <div className="feed-more">
          <button
            type="button"
            className="feed-more-button"
            onClick={() => void loadOlder()}
            disabled={status === "loading"}
          >
            {status === "loading" ? labels.loading : labels.loadOlder}
          </button>
          <p className="feed-more-notice" role="alert" aria-live="polite">
            {status === "failed" ? labels.loadFailed : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/** The heading a Tag-filtered Feed shows, with the way back to the whole Feed. */
export function FeedHeading({
  locale,
  tag,
  labels,
  title,
  lead,
}: {
  locale: Locale;
  tag: { slug: string; name: string } | null;
  labels: FeedLabels;
  title: string;
  /** One sentence under the title, when the surface wants to introduce itself. */
  lead?: string;
}) {
  return (
    <header className="feed-heading">
      {/* The Tag filter scopes the page, so it sits in the page head as a kicker
          over the title rather than at the foot of the stream. */}
      {tag !== null && (
        <p className="feed-filter">
          <span>{labels.tagFiltered.replaceAll("{name}", tag.name)}</span>{" "}
          <Link href={buildFeedPath({ locale })}>{labels.clearTag}</Link>
        </p>
      )}
      <h1 className="feed-title">{title}</h1>
      {lead !== undefined && <p className="feed-lead">{lead}</p>}
    </header>
  );
}
