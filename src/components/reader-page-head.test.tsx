import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReaderPageHead } from "./reader-page-head";

describe("a browse surface's page head", () => {
  it("sets the H1 and counts what is below it", () => {
    const html = renderToStaticMarkup(<ReaderPageHead locale="zh" title="分类" count={12} />);

    expect(html).toContain('class="reader-page-head"');
    expect(html).toContain("<h1>分类</h1>");
    expect(html).toContain('<p class="reader-page-count">12 篇长文</p>');
  });

  it("counts in the language of the surface", () => {
    const html = renderToStaticMarkup(<ReaderPageHead locale="en" title="Notes" count={1} />);

    expect(html).toContain("1 article(s)");
  });

  it("counts zero rather than falling silent", () => {
    const html = renderToStaticMarkup(<ReaderPageHead locale="zh" title="搜索" count={0} />);

    expect(html).toContain("0 篇长文");
  });

  it("leaves the count out when the surface has nothing to count", () => {
    const html = renderToStaticMarkup(<ReaderPageHead locale="en" title="Archive" />);

    expect(html).not.toContain("reader-page-count");
  });

  it("holds whatever the surface keeps above the listing", () => {
    const html = renderToStaticMarkup(
      <ReaderPageHead locale="en" title="Search">
        <form className="reader-search-form" />
      </ReaderPageHead>,
    );

    expect(html).toContain('class="reader-search-form"');
    expect(html.indexOf("reader-search-form")).toBeGreaterThan(html.indexOf("</h1>"));
  });
});
