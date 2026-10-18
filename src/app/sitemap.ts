import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { requestUrl } from "@/domain/urls";
import { getAppContext } from "@/server/app-context";
import { createReadingContext, listIndexableArticlePaths } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Only indexable Article pages: no archive, no search, no Content Fallback. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = getAppContext();
  const entries = await listIndexableArticlePaths(
    createReadingContext(context.database, context.clock),
  );
  const headerSource = await headers();

  return entries.map((entry) => ({
    url: requestUrl(entry.path, headerSource),
    lastModified: entry.lastModified,
  }));
}
