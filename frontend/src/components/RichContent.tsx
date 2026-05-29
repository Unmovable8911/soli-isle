import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';

const extensions = [StarterKit, Link.configure({ openOnClick: true }), Image];

export function RichContent({ content }: { content: string }) {
  const editor = useEditor({ extensions, editable: false, content: JSON.parse(content) });

  useEffect(() => {
    if (editor && content) {
      const parsed = JSON.parse(content);
      editor.commands.setContent(parsed);
    }
  }, [editor, content]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
