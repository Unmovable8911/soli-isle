"use client";

import Link from "next/link";

import { siteConfig } from "@/config/site";
import { instantToSiteLocal } from "@/domain/site-time";
import type { PostSummary } from "@/services/posts";

import type { PostLabels } from "./post-composer";

export interface PostListProps {
  posts: PostSummary[];
  labels: PostLabels;
}

export function PostList({ posts, labels }: PostListProps) {
  return (
    <div className="article-list">
      {posts.length === 0 ? (
        <p className="article-empty">{labels.empty}</p>
      ) : (
        <div className="table-scroll">
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
        </div>
      )}
    </div>
  );
}
