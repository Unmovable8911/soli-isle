import { Fragment } from "react";

import { highlightSegments } from "@/domain/search";

/** Renders a Reader-entered keyword set as `<mark>`s, escaping everything else. */
export function HighlightedText({
  text,
  terms,
}: {
  text: string;
  terms: readonly string[];
}) {
  const segments = highlightSegments(text, terms);

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index}>{segment.text}</mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
