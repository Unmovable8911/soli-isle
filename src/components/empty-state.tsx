import type { ReactNode } from "react";

/**
 * The one way a surface says it has nothing to show: what this surface is, one
 * sentence about why it is bare, and — only where the Reader can act — the
 * action. Every empty surface uses it, so the first bare page a Reader meets
 * looks like the rest of the site rather than like a gap in it.
 */
export function EmptyState({
  title,
  body,
  action,
  level = 2,
}: {
  title: string;
  /** One sentence. If it needs two, the state is explaining rather than stating. */
  body: string;
  /** What the Reader can do about it, where anything can be done. */
  action?: ReactNode;
  /** A state that is the whole page (404, 410, an error) takes the page's H1. */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <section className="empty-state">
      <Heading className="empty-state-title">{title}</Heading>
      <p className="empty-state-body">{body}</p>
      {action !== undefined && <div className="empty-state-action">{action}</div>}
    </section>
  );
}
