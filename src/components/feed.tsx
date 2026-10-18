"use client";

import Link from "next/link";
import { useState } from "react";

import type { Locale } from "@/config/site";
import type { FeedCardView } from "@/domain/feed-view";
import { buildFeedPath } from "@/domain/public-paths";
import type { Messages } from "@/messages";

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
    return <p className="post-empty">{labels.empty}</p>;
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
}: {
  locale: Locale;
  tag: { slug: string; name: string } | null;
  labels: FeedLabels;
  title: string;
}) {
  return (
    <header className="feed-heading">
      <h1 className="feed-title">{title}</h1>
      {tag !== null && (
        <p className="feed-filter">
          <span>{labels.tagFiltered.replaceAll("{name}", tag.name)}</span>{" "}
          <Link href={buildFeedPath({ locale })}>{labels.clearTag}</Link>
        </p>
      )}
    </header>
  );
}
