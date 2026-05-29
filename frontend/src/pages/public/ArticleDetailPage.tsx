import { useParams, Link } from 'react-router';
import { useArticle } from '../../api/articles.js';
import { RichContent } from '../../components/RichContent.js';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useArticle(slug!);

  if (isLoading) return <div className="page-loading">Loading…</div>;
  if (error || !article) return <div className="page-not-found">Article not found</div>;

  return (
    <article className="article-detail">
      <Link to="/articles" className="back-link">← Articles</Link>
      <h1>{article.translation.title}</h1>
      {article.cover_image && <img src={article.cover_image} alt="" className="article-cover" />}
      <div className="article-meta">
        <time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
        {article.category && (
          <span className="category-label">{article.category.translation.name ?? article.category.slug}</span>
        )}
      </div>
      <RichContent content={article.translation.body} />
      {article.tags.length > 0 && (
        <div className="article-tags">
          {article.tags.map(tag => (
            <Link key={tag.id} to={`/articles?tag=${tag.slug}`} className="tag-pill">
              {tag.translation.name ?? tag.slug}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
