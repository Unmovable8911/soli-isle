/**
 * The id every public document gives its main region. The skip link and the
 * pages both import it, so the anchor cannot point at an id nobody renders.
 */
export const MAIN_CONTENT_ID = "main-content";

/**
 * The first focusable thing in a public document: it stays out of the way until
 * it takes focus, then jumps the reader past the header and into `main`, which
 * is `tabIndex={-1}` so the browser can really move focus there.
 */
export function SkipLink({ label }: { label: string }) {
  return (
    <a className="skip-link" href={`#${MAIN_CONTENT_ID}`}>
      {label}
    </a>
  );
}
