import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList, adminDelete } from '../../api/admin.js';

interface AdminPage { id: string; slug: string; sort_order: number; is_draft: number; translation_title: string; }

export function PageListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pages'],
    queryFn: () => adminList<AdminPage[]>('pages'),
  });
  const [deleteError, setDeleteError] = useState('');
  const del = useMutation({
    mutationFn: (id: string) => adminDelete('pages', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-pages'] }); queryClient.invalidateQueries({ queryKey: ['pages'] }); setDeleteError(''); },
    onError: (e) => setDeleteError((e as Error)?.message ?? 'Delete failed'),
  });
  function handleDelete(id: string) { if (window.confirm('Delete this page? This cannot be undone.')) del.mutate(id); }

  if (isLoading) return <div className="page-loading">Loading…</div>;
  const rows = data ?? [];

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Pages</h1>
        <Link to="/admin/pages/new" className="admin-new-btn">New Page</Link>
      </div>
      {deleteError && <p className="error">{deleteError}</p>}
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Slug</th><th>Order</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id}>
              <td data-label="Title">{p.translation_title || '—'}</td>
              <td data-label="Slug">{p.slug}</td>
              <td data-label="Order">{p.sort_order}</td>
              <td data-label="Status"><span className={`badge ${p.is_draft ? 'badge--draft' : 'badge--published'}`}>{p.is_draft ? 'Draft' : 'Published'}</span></td>
              <td className="admin-actions-cell">
                <div className="admin-row-actions">
                  <Link to={`/admin/pages/${p.id}`} className="btn btn--ghost btn--sm">Edit</Link>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(p.id)} disabled={del.isPending}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-empty">No pages yet.</p>}
    </div>
  );
}
