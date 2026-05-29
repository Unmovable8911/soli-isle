import { Link } from 'react-router';
import type { ArticleListItem } from '../api/articles.js';

export function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
    <article className="article-card">
      {article.cover_image && <img src={article.cover_image} alt="" />}
      <h2><Link to={`/articles/${article.slug}`}>{article.title}</Link></h2>
      {article.excerpt && <p>{article.excerpt}</p>}
      <time dateTime={article.published_at}>
        {new Date(article.published_at).toLocaleDateString()}
      </time>
    </article>
  );
}
