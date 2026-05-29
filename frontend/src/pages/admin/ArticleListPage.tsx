import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList } from '../../api/admin.js';

interface AdminArticle {
  id: string;
  slug: string;
  translation_title: string;
  is_draft: number;
}

export function ArticleListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-articles'],
    queryFn: () => adminList<{ data: AdminArticle[]; next_cursor: string | null }>('articles'),
  });

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Articles</h1>
        <Link to="/admin/articles/new" className="admin-new-btn">New Article</Link>
      </div>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {data?.data.map(a => (
            <tr key={a.id}>
              <td>{a.translation_title}</td>
              <td>{a.slug}</td>
              <td>{a.is_draft ? 'Draft' : 'Published'}</td>
              <td><Link to={`/admin/articles/${a.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
