/**
 * The rendered Article body. The admin preview uses it today; ticket 07's
 * public page mounts the same component so the two cannot drift.
 */
export function ArticleBody({ html }: { html: string }) {
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
