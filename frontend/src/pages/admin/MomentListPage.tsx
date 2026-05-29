import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList } from '../../api/admin.js';

interface AdminMoment {
  id: string;
  published_at: string;
  translation_body: string;
}

export function MomentListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-moments'],
    queryFn: () => adminList<AdminMoment[]>('moments'),
  });

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Moments</h1>
        <Link to="/admin/moments/new" className="admin-new-btn">New Moment</Link>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Published</th>
            <th>Body (preview)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.map(m => (
            <tr key={m.id}>
              <td><time>{m.published_at ? new Date(m.published_at).toLocaleDateString() : '—'}</time></td>
              <td className="admin-table-preview">{m.translation_body ? String(m.translation_body).slice(0, 80) : '—'}</td>
              <td><Link to={`/admin/moments/${m.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
