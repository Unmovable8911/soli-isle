import "server-only";

import katex from "katex";

/**
 * Formulas are rendered here, not by the math nodes' own `renderHTML`: that
 * output is only a marker element and the KaTeX markup exists solely in the
 * editor's node view, so a published formula would otherwise be an empty box.
 */
export function renderMath(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, { displayMode, throwOnError: false });
}
