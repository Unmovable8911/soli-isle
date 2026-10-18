import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminPageHead } from "./page-head";

describe("the console page head", () => {
  it("reads H1, description, then the primary action on the right", () => {
    const html = renderToStaticMarkup(
      <AdminPageHead
        title="Articles"
        description="The long-form side of the site."
        actions={<a href="#new">New article</a>}
      />,
    );

    expect(html).toContain('<h1>Articles</h1>');
    expect(html).toContain("The long-form side of the site.");

    // One head, one place for the action: after the text block, in its own box.
    const heading = html.indexOf("<h1>");
    const actions = html.indexOf('class="admin-page-actions"');
    expect(heading).toBeGreaterThan(-1);
    expect(actions).toBeGreaterThan(heading);
    expect(html).toContain('</div><div class="admin-page-actions">');
    expect(html).toContain("New article");
  });

  it("leaves the action box out rather than rendering an empty one", () => {
    const html = renderToStaticMarkup(<AdminPageHead title="Assets" description="Every image." />);

    expect(html).toContain('<h1>Assets</h1>');
    expect(html).not.toContain("admin-page-actions");
  });

  it("keeps the description optional", () => {
    const html = renderToStaticMarkup(<AdminPageHead title="Tags" />);

    expect(html).toBe('<div class="admin-page-head"><div class="admin-page-head-text"><h1>Tags</h1></div></div>');
  });
});
