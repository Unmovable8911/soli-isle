import { useParams } from 'react-router';
import { usePage } from '../../api/pages.js';
import { RichContent } from '../../components/RichContent.js';

export function PageDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, error } = usePage(slug!);

  if (isLoading) return <div className="page-loading">Loading…</div>;
  if (error || !page) return <div className="page-not-found">Page not found</div>;

  return (
    <article className="page-detail">
      <h1>{page.translation.title}</h1>
      <RichContent content={page.translation.body} />
    </article>
  );
}
