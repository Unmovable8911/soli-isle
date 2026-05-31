import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useCallback, useEffect } from 'react';

interface TipTapEditorProps {
  content: string;
  onChange: (json: string) => void;
}

const EMPTY_DOC = { type: 'doc', content: [] };

function safeParse(content: string): object {
  if (!content) return EMPTY_DOC;
  try {
    return JSON.parse(content) as object;
  } catch {
    return EMPTY_DOC;
  }
}

export function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({ allowBase64: false }),
    ],
    content: safeParse(content),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Sync editor content when the content prop changes (e.g. switching translation tabs)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const incoming = JSON.stringify(safeParse(content));
    const current = JSON.stringify(editor.getJSON());
    if (incoming !== current) {
      editor.commands.setContent(safeParse(content), false);
    }
  }, [editor, content]);

  const addImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/admin/media', { method: 'POST', body: formData, credentials: 'same-origin' });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = await res.json() as { url: string };
        if (editor.isDestroyed) return;
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        alert('Image upload failed');
      }
    };
    input.click();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor">
      <div className="tiptap-toolbar">
        <button type="button" aria-label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''}>B</button>
        <button type="button" aria-label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''}>I</button>
        <button type="button" aria-label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}>H2</button>
        <button type="button" aria-label="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}>H3</button>
        <button type="button" aria-label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''}>List</button>
        <button type="button" aria-label="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'active' : ''}>Quote</button>
        <button type="button" aria-label="Link" onClick={() => { const url = window.prompt('Link URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); }} className={editor.isActive('link') ? 'active' : ''}>Link</button>
        <button type="button" aria-label="Insert image" onClick={addImage}>Image</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
