"use client";

import Link from "next/link";

import { siteConfig } from "@/config/site";
import { instantToSiteLocal } from "@/domain/site-time";
import type { Messages } from "@/messages";
import type { ArticleSummary } from "@/services/articles";

export type ArticleListLabels = Messages["admin"]["articles"];

export interface ArticleListProps {
  articles: ArticleSummary[];
  labels: ArticleListLabels;
}

export function ArticleList({ articles, labels }: ArticleListProps) {
  return (
    <div className="article-list">
      {articles.length === 0 ? (
        <p className="article-empty">{labels.empty}</p>
      ) : (
        <div className="table-scroll">
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
        </div>
      )}
    </div>
  );
}
