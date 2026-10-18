import { getAppContext } from "@/server/app-context";
import { listTombstonedSlugs } from "@/services/reading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Which Slugs answer 410. The middleware runs on the Edge runtime and cannot
 * read SQLite, so it asks here and caches the answer briefly.
 */
export async function GET(): Promise<Response> {
  const context = getAppContext();
  const slugs = await listTombstonedSlugs(context.reading);

  return Response.json({ slugs }, { headers: { "cache-control": "no-store" } });
}
