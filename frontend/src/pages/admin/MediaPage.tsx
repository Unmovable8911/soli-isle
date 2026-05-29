import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminList, adminDelete } from '../../api/admin.js';

interface MediaItem {
  id: string;
  url: string;
  filename: string;
}

export function MediaPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-media'],
    queryFn: () => adminList<{ data: MediaItem[] }>('media'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error: string }).error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      setUploadError('');
    },
    onError: (err) => {
      setUploadError((err as Error)?.message ?? 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDelete('media', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      setDeleteError('');
    },
    onError: (err) => {
      setDeleteError((err as Error)?.message ?? 'Delete failed');
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadMutation.mutateAsync(file).catch(() => {/* onError handles display */});
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    // Reset so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>Media</h1>
      </div>

      {/* Upload zone */}
      <div
        className={`admin-upload-zone${isDragging ? ' admin-upload-zone--active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        aria-label="Upload media files"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="visually-hidden"
          onChange={handleFileChange}
        />
        {uploadMutation.isPending ? (
          <span className="admin-upload-hint">Uploading...</span>
        ) : (
          <>
            <span className="admin-upload-icon">+</span>
            <span className="admin-upload-hint">Drop images here or click to upload</span>
          </>
        )}
      </div>

      {uploadError && <p className="error" style={{ marginBottom: '1rem' }}>{uploadError}</p>}
      {deleteError && <p className="error" style={{ marginBottom: '1rem' }}>{deleteError}</p>}

      {/* Media grid */}
      {data?.data.length === 0 ? (
        <p className="admin-empty">No media uploaded yet.</p>
      ) : (
        <div className="admin-media-grid">
          {data?.data.map(item => (
            <div key={item.id} className="admin-media-item">
              <div className="admin-media-thumb">
                <img src={item.url} alt={item.filename} loading="lazy" />
              </div>
              <div className="admin-media-info">
                <span className="admin-media-filename" title={item.filename}>
                  {item.filename}
                </span>
                <button
                  type="button"
                  className="admin-delete-btn"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
