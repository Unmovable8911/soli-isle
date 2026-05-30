import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList, adminDelete } from '../../api/admin.js';

interface AdminResource { id: string; url: string; translation_title: string; }

export function ResourceListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: () => adminList<AdminResource[]>('resources'),
  });
  const [deleteError, setDeleteError] = useState('');
  const del = useMutation({
    mutationFn: (id: string) => adminDelete('resources', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-resources'] }); queryClient.invalidateQueries({ queryKey: ['resources'] }); setDeleteError(''); },
    onError: (e) => setDeleteError((e as Error)?.message ?? 'Delete failed'),
  });
  function handleDelete(id: string) { if (window.confirm('Delete this resource? This cannot be undone.')) del.mutate(id); }

  if (isLoading) return <div className="page-loading">Loading…</div>;
  const rows = data ?? [];

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Resources</h1>
        <Link to="/admin/resources/new" className="admin-new-btn">New Resource</Link>
      </div>
      {deleteError && <p className="error">{deleteError}</p>}
      <table className="admin-table">
        <thead><tr><th>Title</th><th>URL</th><th></th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td data-label="Title">{r.translation_title || '—'}</td>
              <td data-label="URL" className="admin-table-url">{r.url}</td>
              <td className="admin-actions-cell">
                <div className="admin-row-actions">
                  <Link to={`/admin/resources/${r.id}`} className="btn btn--ghost btn--sm">Edit</Link>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(r.id)} disabled={del.isPending}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-empty">No resources yet.</p>}
    </div>
  );
}
