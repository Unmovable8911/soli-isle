import { Link } from 'react-router';
import type { ArticleListItem } from '../api/articles.js';
import { useScrollReveal } from '../hooks/useScrollReveal.js';

export function ArticleCard({ article }: { article: ArticleListItem }) {
  const reveal = useScrollReveal<HTMLElement>();
  return (
    <article ref={reveal} className="article-card card card--interactive reveal">
      {article.cover_image && <img src={article.cover_image} alt="" />}
      <h2><Link to={`/articles/${article.slug}`}>{article.title}</Link></h2>
      {article.excerpt && <p>{article.excerpt}</p>}
      <time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
    </article>
  );
}
