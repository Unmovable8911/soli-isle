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
 * 410 Gone for a Slug a permanently deleted Article left behind. A Next.js
 * page can only answer 200 or 404, so this small document is served from the
 * middleware; it is deliberately chrome-free, it is a dead end.
 */
export function goneResponse(locale: Locale): NextResponse {
  const t = messages[locale];
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
</head>
<body>
<main>
<h1>${title}</h1>
<p>${body}</p>
<p><a href="${home}">${back}</a></p>
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
