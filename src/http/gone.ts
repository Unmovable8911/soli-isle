import type { Locale } from "@/config/site";
import { buildHomePath } from "@/domain/public-paths";
import { messages } from "@/messages";
import { NextResponse } from "next/server";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * A Next.js page can only answer 200 or 404, so the 410 is served from the
 * middleware, which runs on the Edge runtime: it cannot query SQLite and it
 * cannot reach the compiled stylesheet. The document therefore carries its own
 * typography — the same self-hosted Lora and Inter, the same 42rem column and
 * the same pill action as the app's empty state — and takes its colours from the
 * platform's own keywords (`Canvas`, `CanvasText`) so that it follows the
 * Reader's light or dark preference without inventing a palette outside
 * tokens.css. It is still a dead end: there is no shell to browse away in.
 */
export function goneResponse(locale: Locale): NextResponse {
  const t = messages[locale];
  const siteName = escapeHtml(t.chrome.siteName);
  const kicker = escapeHtml(t.reader.gone.kicker);
  const title = escapeHtml(t.reader.gone.title);
  const body = escapeHtml(t.reader.gone.body);
  const back = escapeHtml(t.reader.gone.back);
  const home = escapeHtml(buildHomePath(locale));

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="robots" content="noindex" />
<title>${title}</title>
<style>
@font-face {
  font-family: "Lora";
  src: url("/fonts/lora-latin-wght-normal.woff2") format("woff2");
  font-weight: 400 700;
  font-display: swap;
}
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-latin-wght-normal.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}
:root {
  color-scheme: light dark;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: Canvas;
  color: CanvasText;
  font-family: "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  line-height: 1.5;
}
.bar {
  display: flex;
  align-items: center;
  height: 4rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
}
.wordmark {
  color: CanvasText;
  font-family: "Lora", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: 1.25rem;
  font-weight: 700;
  text-decoration: none;
}
main {
  padding: 4rem 1.5rem;
}
.empty-state {
  max-width: 42rem;
  margin: 0 auto;
}
.empty-state-kicker {
  margin: 0 0 0.75rem;
  color: color-mix(in srgb, CanvasText 65%, Canvas);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.empty-state-title {
  margin: 0 0 0.5rem;
  font-family: "Lora", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.empty-state-body {
  margin: 0;
  color: color-mix(in srgb, CanvasText 72%, Canvas);
}
.empty-state-action {
  margin: 1.5rem 0 0;
}
.empty-state-action a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px solid color-mix(in srgb, CanvasText 45%, transparent);
  border-radius: 999px;
  color: CanvasText;
  text-decoration: none;
}
</style>
</head>
<body>
<header class="bar">
<a class="wordmark" href="${home}">${siteName}</a>
</header>
<main>
<section class="empty-state">
<p class="empty-state-kicker">${kicker}</p>
<h1 class="empty-state-title">${title}</h1>
<p class="empty-state-body">${body}</p>
<div class="empty-state-action"><a href="${home}">${back}</a></div>
</section>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
