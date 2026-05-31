export function encodeCursor(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8');
}

export interface PaginatedResult<T> {
  data: T[];
  next_cursor: string | null;
}

export function paginatedResult<T>(
  rows: T[],
  cursorField: keyof T,
  limit: number
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor(String(data[data.length - 1]![cursorField]))
      : null;
  return { data, next_cursor: nextCursor };
}
