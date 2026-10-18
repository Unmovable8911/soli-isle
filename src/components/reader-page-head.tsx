import type { ReactNode } from "react";

import type { Locale } from "@/config/site";
import { messages } from "@/messages";

/**
 * The top of a browse surface: the page's name at page scale, what is under it
 * counted, and whatever the surface keeps above its listing — a search form, for
 * one. The count is a micro-label rather than a sentence, so the eye reaches the
 * listing instead of reading a sentence about it.
 */
export function ReaderPageHead({
  locale,
  title,
  lead,
  count,
  children,
}: {
  locale: Locale;
  title: ReactNode;
  /** One sentence under the name, when the surface wants to introduce itself. */
  lead?: string;
  /** How many Articles the surface holds. Omitted, the head counts nothing. */
  count?: number;
  children?: ReactNode;
}) {
  return (
    <header className="reader-page-head">
      <h1>{title}</h1>
      {lead !== undefined && <p className="reader-page-lead">{lead}</p>}
      {count !== undefined && (
        <p className="reader-page-count">
          {messages[locale].reader.list.count.replaceAll("{count}", String(count))}
        </p>
      )}
      {children}
    </header>
  );
}
