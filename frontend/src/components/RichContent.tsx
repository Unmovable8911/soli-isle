import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';

const extensions = [StarterKit, Link.configure({ openOnClick: true }), Image];

function safeParse(content: string): object | null {
  try {
    return JSON.parse(content) as object;
  } catch {
    return null;
  }
}

export function RichContent({ content }: { content: string }) {
  const parsed = safeParse(content);
  const editor = useEditor({ extensions, editable: false, content: parsed ?? undefined });

  useEffect(() => {
    if (editor && content) {
      const next = safeParse(content);
      if (next) editor.commands.setContent(next);
    }
  }, [editor, content]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
