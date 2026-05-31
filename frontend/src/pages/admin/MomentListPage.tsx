import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList, adminDelete } from '../../api/admin.js';

interface AdminMoment { id: string; published_at: string; translation_body: string; }

export function MomentListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-moments'],
    queryFn: () => adminList<AdminMoment[]>('moments'),
  });
  const [deleteError, setDeleteError] = useState('');
  const del = useMutation({
    mutationFn: (id: string) => adminDelete('moments', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-moments'] }); queryClient.invalidateQueries({ queryKey: ['moments'] }); setDeleteError(''); },
    onError: (e) => setDeleteError((e as Error)?.message ?? 'Delete failed'),
  });
  function handleDelete(id: string) { if (window.confirm('Delete this moment? This cannot be undone.')) del.mutate(id); }

  if (isLoading) return <div className="page-loading">Loading…</div>;
  const rows = data ?? [];

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Moments</h1>
        <Link to="/admin/moments/new" className="admin-new-btn">New Moment</Link>
      </div>
      {deleteError && <p className="error">{deleteError}</p>}
      <table className="admin-table">
        <thead><tr><th>Published</th><th>Body (preview)</th><th></th></tr></thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id}>
              <td data-label="Published"><time>{m.published_at ? new Date(m.published_at).toLocaleDateString() : '—'}</time></td>
              <td data-label="Body" className="admin-table-preview">{m.translation_body ? String(m.translation_body).slice(0, 80) : '—'}</td>
              <td className="admin-actions-cell">
                <div className="admin-row-actions">
                  <Link to={`/admin/moments/${m.id}`} className="btn btn--ghost btn--sm">Edit</Link>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(m.id)} disabled={del.isPending}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-empty">No moments yet.</p>}
    </div>
  );
}
