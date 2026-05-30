import { useRef } from 'react';
import { useParams, Link } from 'react-router';
import { useArticle } from '../../api/articles.js';
import { RichContent } from '../../components/RichContent.js';
import { useToc } from '../../hooks/useToc.js';
import { ArticleToc } from '../../components/ArticleToc.js';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useArticle(slug!);
  const bodyRef = useRef<HTMLDivElement>(null);
  const toc = useToc(bodyRef, [article?.translation.body]);

  if (isLoading) return <div className="page-loading"><span className="skeleton" style={{ height: '2rem', width: '60%', display: 'block' }} /></div>;
  if (error || !article) return <div className="empty-state">Article not found</div>;

  return (
    <div className="article-layout">
      <article className="article-detail">
        <Link to="/articles" className="back-link link-underline">← Articles</Link>
        <header className="article-detail__header">
          {article.category && <span className="eyebrow">{article.category.translation.name ?? article.category.slug}</span>}
          <h1>{article.translation.title}</h1>
          <time className="meta" dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
        </header>
        {article.cover_image && <img src={article.cover_image} alt="" className="article-cover" />}
        <div className="article-body" ref={bodyRef}>
          <RichContent content={article.translation.body} />
        </div>
        {article.tags.length > 0 && (
          <div className="article-tags">
            {article.tags.map(tag => (
              <Link key={tag.id} to={`/articles?tag=${tag.slug}`} className="chip">{tag.translation.name ?? tag.slug}</Link>
            ))}
          </div>
        )}
      </article>
      <aside className="article-aside"><ArticleToc entries={toc} /></aside>
    </div>
  );
}
