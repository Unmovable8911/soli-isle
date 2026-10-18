"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { siteConfig, type Locale } from "@/config/site";
import { instantToSiteLocal } from "@/domain/site-time";
import type { Messages } from "@/messages";
import type { ArticleSummary } from "@/services/articles";

export type ArticleListLabels = Messages["admin"]["articles"];

export interface ArticleListProps {
  articles: ArticleSummary[];
  locale: Locale;
  labels: ArticleListLabels;
}

export function ArticleList({ articles, locale, labels }: ArticleListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function createArticle() {
    setCreating(true);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const payload = (await response.json()) as { article: { id: string } };
      router.push(`/admin/articles/${payload.article.id}`);
    } catch {
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="article-list">
      <button type="button" onClick={() => void createArticle()} disabled={creating}>
        {labels.newArticle}
      </button>
      {failed ? (
        <p role="alert" className="article-error">
          {labels.loadFailed}
        </p>
      ) : null}

      {articles.length === 0 ? (
        <p className="article-empty">{labels.empty}</p>
      ) : (
        <table className="article-table">
          <thead>
            <tr>
              <th scope="col">{labels.list.title}</th>
              <th scope="col">{labels.list.slug}</th>
              <th scope="col">{labels.list.state}</th>
              <th scope="col">{labels.list.languages}</th>
              <th scope="col">{labels.list.updatedAt}</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const primary =
                article.translations.find(
                  (translation) => translation.locale === article.defaultLocale,
                ) ?? article.translations[0];

              return (
                <tr key={article.id}>
                  <td>
                    <Link href={`/admin/articles/${article.id}`}>
                      {primary?.title !== undefined && primary.title.length > 0
                        ? primary.title
                        : labels.untitled}
                    </Link>
                  </td>
                  <td>
                    <code>{article.slug}</code>
                  </td>
                  <td>
                    <span className={`article-state article-state-${article.visibility}`}>
                      {labels.visibility[article.visibility]}
                    </span>
                  </td>
                  <td>{article.translations.map((translation) => translation.locale).join(" ")}</td>
                  <td>{instantToSiteLocal(new Date(article.updatedAt), siteConfig.timeZone)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
