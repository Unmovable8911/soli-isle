import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LanguageVersionLink } from "@/domain/article-language";

import { ArticleLanguageVersions, FallbackNotice } from "./article-language";

const LABELS = { label: "本文语言版本", missing: "暂无此语言版本" };
const NAMES = { zh: "中文", en: "English" };

function version(locale: "zh" | "en", hasVersion: boolean): LanguageVersionLink {
  return { locale, href: `https://isle.example/${locale}/articles/hello-world`, hasVersion };
}

describe("the work's language versions", () => {
  it("lists every Site Locale, marking which ones really have a version", () => {
    const html = renderToStaticMarkup(
      <ArticleLanguageVersions
        current="zh"
        names={NAMES}
        labels={LABELS}
        versions={[version("zh", true), version("en", false)]}
      />,
    );

    expect(html).toContain('aria-label="本文语言版本"');
    expect(html).toContain('href="https://isle.example/zh/articles/hello-world"');
    expect(html).toContain('href="https://isle.example/en/articles/hello-world"');
    expect(html).toContain('hrefLang="zh"');
    expect(html).toContain('data-version="own"');
    expect(html).toContain('data-version="fallback"');
    // The Locale with no version is described by the note, not silently offered.
    expect(html).toContain('aria-describedby="article-locale-note-en"');
    expect(html).not.toContain('aria-describedby="article-locale-note-zh"');
    expect(html).toContain('<span class="article-locale-note" id="article-locale-note-en">暂无此语言版本</span>');
  });

  it("marks the Locale the Reader is on, including on a fallback page", () => {
    const html = renderToStaticMarkup(
      <ArticleLanguageVersions
        current="en"
        names={NAMES}
        labels={LABELS}
        versions={[version("zh", true), version("en", false)]}
      />,
    );

    expect(html).toMatch(/aria-current="page"[^>]*href="https:\/\/isle\.example\/en\/articles\/hello-world"|href="https:\/\/isle\.example\/en\/articles\/hello-world"[^>]*aria-current="page"/);
    expect(html).not.toMatch(/href="https:\/\/isle\.example\/zh\/articles\/hello-world"[^>]*aria-current/);
  });

  it("keeps the Reader on the same work when a version exists in the target Locale", () => {
    const html = renderToStaticMarkup(
      <ArticleLanguageVersions
        current="zh"
        names={NAMES}
        labels={LABELS}
        versions={[version("zh", true), version("en", true)]}
      />,
    );

    expect(html).toContain("https://isle.example/en/articles/hello-world");
    expect(html).not.toContain("暂无此语言版本");
  });
});

describe("the Content Fallback notice", () => {
  it("says which version the Reader asked for and which one is shown", () => {
    const html = renderToStaticMarkup(
      <FallbackNotice
        labels={{ notice: "这篇长文还没有{requested}版本，以下是它的{shown}版本。" }}
        requested="English"
        shown="中文"
      />,
    );

    expect(html).toBe(
      '<p class="reader-notice" role="note">这篇长文还没有English版本，以下是它的中文版本。</p>',
    );
  });

  it("escapes the Locale names it interpolates", () => {
    const html = renderToStaticMarkup(
      <FallbackNotice
        labels={{ notice: "no {requested} version, showing {shown}" }}
        requested="<script>"
        shown="zh"
      />,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
