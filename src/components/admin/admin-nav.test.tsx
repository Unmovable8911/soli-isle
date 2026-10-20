import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { messages } from "@/messages";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/admin") }));

import { usePathname } from "next/navigation";

import { AdminNav } from "./admin-nav";

const labels = messages.en.admin.shell;

function render(pathname: string): string {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return renderToStaticMarkup(<AdminNav shell={labels} />);
}

describe("the console top bar navigation", () => {
  it("offers the six entries as one horizontal list", () => {
    const html = render("/admin");
    const nav = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";

    expect(nav).toContain(`aria-label="${labels.navLabel}"`);
    expect(nav.match(/<li>/g)).toHaveLength(6);
    for (const href of ["/admin", "/admin/articles", "/admin/posts", "/admin/categories", "/admin/tags", "/admin/assets"]) {
      expect(nav, href).toContain(`href="${href}"`);
    }
  });

  it("marks exactly the current entry, on the page itself", () => {
    const html = render("/admin/articles/01J8ZK");

    const marked = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain('href="/admin/articles"');
    expect(marked[0]).toContain(`>${labels.nav.articles}</a>`);
  });

  it("marks nothing when the Author is not on a console entry", () => {
    expect(render("/admin/login")).not.toContain("aria-current");
  });
});
