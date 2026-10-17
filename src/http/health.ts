import { getHealth, type HealthContext } from "@/services/health";

export async function healthResponse(context: HealthContext): Promise<Response> {
  const report = await getHealth(context);
  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: {
      "cache-control": "no-store",
    },
  });
}
