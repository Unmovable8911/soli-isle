import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList } from '../../api/admin.js';

interface AdminPage {
  id: string;
  slug: string;
  sort_order: number;
  is_draft: number;
  translation_title: string;
}

export function PageListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pages'],
    queryFn: () => adminList<AdminPage[]>('pages'),
  });

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Pages</h1>
        <Link to="/admin/pages/new" className="admin-new-btn">New Page</Link>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Order</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.map(p => (
            <tr key={p.id}>
              <td>{p.translation_title || '—'}</td>
              <td>{p.slug}</td>
              <td>{p.sort_order}</td>
              <td>{p.is_draft ? 'Draft' : 'Published'}</td>
              <td><Link to={`/admin/pages/${p.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
