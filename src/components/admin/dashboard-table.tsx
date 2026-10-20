import Link from "next/link";
import type { ReactNode } from "react";

import type { PublicationVisibility } from "@/domain/publication";
import { formatAbsoluteMinute } from "@/domain/relative-time";
import type { Messages } from "@/messages";
import type { ArticleSummary } from "@/services/articles";
import type { PostSummary } from "@/services/posts";

import { EmptyState } from "../empty-state";

export type DashboardLabels = Messages["admin"]["dashboard"];

/** What the row actions need to know: which work, and how it stands right now. */
export interface DashboardRow {
  kind: "article" | "post";
  id: string;
  visibility: PublicationVisibility;
}

export interface DashboardTableProps {
  articles: ArticleSummary[];
  posts: PostSummary[];
  labels: DashboardLabels;
  /** Supplied by the page so this module stays free of browser state. */
  renderActions: (row: DashboardRow) => ReactNode;
}

function displayTitle(article: ArticleSummary, untitled: string): string {
  const primary =
    article.translations.find((translation) => translation.locale === article.defaultLocale) ??
    article.translations[0];
  const title = primary?.title.trim() ?? "";
  return title.length === 0 ? untitled : title;
}

/**
 * The whole dashboard, rendered on the server: every Article and Post with the
 * Publication State the services derived for it. Nothing here decides what a
 * state means — the label is a lookup by `visibility`, and the row actions get
 * the same value.
 */
export function DashboardTable({ articles, posts, labels, renderActions }: DashboardTableProps) {
  return (
    <div className="dashboard">
      <section className="dashboard-section" aria-labelledby="dashboard-articles">
        <h2 id="dashboard-articles">{labels.articles.title}</h2>
        {articles.length === 0 ? (
          <EmptyState
            title={labels.articles.emptyTitle}
            body={labels.articles.empty}
            action={<Link href="/admin/articles">{labels.articles.newArticle}</Link>}
          />
        ) : (
          <div className="table-scroll">
            <table className="article-table">
              <thead>
                <tr>
                  <th scope="col">{labels.articles.columns.title}</th>
                  <th scope="col">{labels.articles.columns.slug}</th>
                  <th scope="col">{labels.articles.columns.state}</th>
                  <th scope="col">{labels.articles.columns.publishTime}</th>
                  <th scope="col">{labels.articles.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <Link href={`/admin/articles/${article.id}`}>
                        {displayTitle(article, labels.untitled)}
                      </Link>
                    </td>
                    <td>
                      <code>{article.slug}</code>
                    </td>
                    <td>
                      <span className={`publication-state publication-state-${article.visibility}`}>
                        {labels.state[article.visibility]}
                      </span>
                    </td>
                    <td>{publishTimeCell(article.publishTime, labels.neverPublished)}</td>
                    <td>
                      {renderActions({
                        kind: "article",
                        id: article.id,
                        visibility: article.visibility,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-posts">
        <h2 id="dashboard-posts">{labels.posts.title}</h2>
        {posts.length === 0 ? (
          <EmptyState
            title={labels.posts.emptyTitle}
            body={labels.posts.empty}
            action={<Link href="/admin/posts">{labels.posts.newPost}</Link>}
          />
        ) : (
          <div className="table-scroll">
            <table className="article-table">
              <thead>
                <tr>
                  <th scope="col">{labels.posts.columns.open}</th>
                  <th scope="col">{labels.posts.columns.state}</th>
                  <th scope="col">{labels.posts.columns.publishTime}</th>
                  <th scope="col">{labels.posts.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link href={`/admin/posts/${post.id}`}>{labels.actions.open}</Link>
                    </td>
                    <td>
                      <span className={`publication-state publication-state-${post.visibility}`}>
                        {labels.state[post.visibility]}
                      </span>
                    </td>
                    <td>{publishTimeCell(post.publishTime, labels.neverPublished)}</td>
                    <td>
                      {renderActions({ kind: "post", id: post.id, visibility: post.visibility })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function publishTimeCell(publishTime: string | null, neverPublished: string): ReactNode {
  if (publishTime === null) {
    return neverPublished;
  }
  return <time dateTime={publishTime}>{formatAbsoluteMinute(publishTime)}</time>;
}
