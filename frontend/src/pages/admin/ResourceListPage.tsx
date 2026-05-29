import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList } from '../../api/admin.js';

interface AdminResource {
  id: string;
  url: string;
  translation_title: string;
}

export function ResourceListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: () => adminList<AdminResource[]>('resources'),
  });

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Resources</h1>
        <Link to="/admin/resources/new" className="admin-new-btn">New Resource</Link>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>URL</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.map(r => (
            <tr key={r.id}>
              <td>{r.translation_title || '—'}</td>
              <td className="admin-table-url">{r.url}</td>
              <td><Link to={`/admin/resources/${r.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
