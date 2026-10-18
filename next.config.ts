import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The public site and the console are two root layouts (the reader's tree
  // lives under [locale], the console renders its own document), so a 404
  // thrown by a page has no single root layout to render into. Next would then
  // answer with its client-only error document: styled by nothing, blank with
  // JavaScript off. global-not-found is the designated full document for that
  // case, and it is where the 404 gets the site's own shell.
  experimental: { globalNotFound: true },
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "sharp"],
};

export default nextConfig;
