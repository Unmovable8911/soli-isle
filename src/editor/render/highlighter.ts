import "server-only";

import bash from "@shikijs/langs/shellscript";
import css from "@shikijs/langs/css";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import markdown from "@shikijs/langs/markdown";
import typescript from "@shikijs/langs/typescript";
import githubDark from "@shikijs/themes/github-dark";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export const CODE_THEME = "github-dark";

let highlighter: Promise<HighlighterCore> | null = null;

/** One process-wide highlighter; the JS regex engine keeps WASM out of Next. */
export function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [githubDark],
    langs: [typescript, javascript, json, css, bash, markdown],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

export function highlightCode(
  instance: HighlighterCore,
  code: string,
  language: string | null,
): string {
  const loaded = instance.getLoadedLanguages();
  const lang = language !== null && loaded.includes(language) ? language : "text";

  return instance.codeToHtml(code, { lang, theme: CODE_THEME });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
