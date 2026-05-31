import { Link } from 'react-router';
import type { ArticleListItem } from '../api/articles.js';
import { useScrollReveal } from '../hooks/useScrollReveal.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { FallbackBadge } from './FallbackBadge.js';

export function ArticleCard({ article }: { article: ArticleListItem }) {
  const reveal = useScrollReveal<HTMLElement>();
  const { t } = useLanguage();
  return (
    <article ref={reveal} className="article-card card card--interactive reveal">
      {article.cover_image && <img src={article.cover_image} alt="" />}
      <FallbackBadge lang={article.lang} />
      <h2><Link to={`/articles/${article.slug}`}>{article.title}</Link></h2>
      {article.excerpt && <p>{article.excerpt}</p>}
      <time dateTime={article.published_at}>{t('published_on', 'Published on')} {new Date(article.published_at).toLocaleDateString()}</time>
      <Link to={`/articles/${article.slug}`} className="read-more link-underline">{t('read_more', 'Read more')} →</Link>
    </article>
  );
}
