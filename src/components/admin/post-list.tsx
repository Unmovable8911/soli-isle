"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { siteConfig, type Locale } from "@/config/site";
import { instantToSiteLocal } from "@/domain/site-time";
import type { PostSummary } from "@/services/posts";

import type { PostLabels } from "./post-composer";

export interface PostListProps {
  posts: PostSummary[];
  locale: Locale;
  labels: PostLabels;
}

export function PostList({ posts, locale, labels }: PostListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function createPost() {
    setCreating(true);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const payload = (await response.json()) as { post: { id: string } };
      router.push(`/admin/posts/${payload.post.id}`);
    } catch {
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="article-list">
      <button type="button" onClick={() => void createPost()} disabled={creating}>
        {labels.newPost}
      </button>
      {failed ? (
        <p role="alert" className="article-error">
          {labels.loadFailed}
        </p>
      ) : null}

      {posts.length === 0 ? (
        <p className="article-empty">{labels.empty}</p>
      ) : (
        <table className="article-table">
          <thead>
            <tr>
              <th scope="col">{labels.open}</th>
              <th scope="col">{labels.list.state}</th>
              <th scope="col">{labels.list.publishTime}</th>
              <th scope="col">{labels.list.images}</th>
              <th scope="col">{labels.list.languages}</th>
              <th scope="col">{labels.list.updatedAt}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link href={`/admin/posts/${post.id}`}>{labels.open}</Link>
                </td>
                <td>
                  <span className={`article-state article-state-${post.visibility}`}>
                    {labels.visibility[post.visibility]}
                  </span>
                </td>
                <td>
                  {post.publishTime === null
                    ? "—"
                    : instantToSiteLocal(new Date(post.publishTime), siteConfig.timeZone)}
                </td>
                <td>{post.images.length}</td>
                <td>{post.translations.map((translation) => translation.locale).join(" ")}</td>
                <td>{instantToSiteLocal(new Date(post.updatedAt), siteConfig.timeZone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
