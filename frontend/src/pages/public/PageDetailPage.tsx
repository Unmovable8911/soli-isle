import { useParams } from 'react-router';
import { usePage } from '../../api/pages.js';
import { RichContent } from '../../components/RichContent.js';
import { FallbackBadge } from '../../components/FallbackBadge.js';

export function PageDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, error } = usePage(slug!);

  if (isLoading) return <div className="page-loading"><span className="skeleton" style={{ height: '2rem', width: '60%', display: 'block' }} /></div>;
  if (error || !page) return <div className="empty-state">Page not found</div>;

  return (
    <article className="page-detail">
      <header className="article-detail__header"><FallbackBadge lang={page.lang} /><h1>{page.translation.title}</h1></header>
      <div className="article-body"><RichContent content={page.translation.body} /></div>
    </article>
  );
}
