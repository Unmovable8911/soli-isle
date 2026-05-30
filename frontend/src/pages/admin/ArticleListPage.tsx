import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList, adminDelete } from '../../api/admin.js';

interface AdminArticle { id: string; slug: string; translation_title: string; is_draft: number; }

export function ArticleListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-articles'],
    queryFn: () => adminList<{ data: AdminArticle[]; next_cursor: string | null }>('articles'),
  });
  const [deleteError, setDeleteError] = useState('');
  const del = useMutation({
    mutationFn: (id: string) => adminDelete('articles', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-articles'] }); queryClient.invalidateQueries({ queryKey: ['articles'] }); setDeleteError(''); },
    onError: (e) => setDeleteError((e as Error)?.message ?? 'Delete failed'),
  });
  function handleDelete(id: string) { if (window.confirm('Delete this article? This cannot be undone.')) del.mutate(id); }

  if (isLoading) return <div className="page-loading">Loading…</div>;
  const rows = data?.data ?? [];

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Articles</h1>
        <Link to="/admin/articles/new" className="admin-new-btn">New Article</Link>
      </div>
      {deleteError && <p className="error">{deleteError}</p>}
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id}>
              <td data-label="Title">{a.translation_title || '—'}</td>
              <td data-label="Slug">{a.slug}</td>
              <td data-label="Status"><span className={`badge ${a.is_draft ? 'badge--draft' : 'badge--published'}`}>{a.is_draft ? 'Draft' : 'Published'}</span></td>
              <td className="admin-actions-cell">
                <div className="admin-row-actions">
                  <Link to={`/admin/articles/${a.id}`} className="btn btn--ghost btn--sm">Edit</Link>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(a.id)} disabled={del.isPending}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-empty">No articles yet.</p>}
    </div>
  );
}
