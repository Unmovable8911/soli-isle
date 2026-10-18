export const EMPTY_DOCUMENT = '{"type":"doc","content":[{"type":"paragraph"}]}';

/** A body is a ProseMirror document, stored as JSON text in the database. */
export function isRichTextDocument(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return false;
    }
    return (parsed as { type?: unknown }).type === "doc";
  } catch {
    return false;
  }
}

export function richTextDocumentOrEmpty(value: string): string {
  return isRichTextDocument(value) ? value : EMPTY_DOCUMENT;
}
