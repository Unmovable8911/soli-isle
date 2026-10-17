import { healthResponse } from "@/http/health";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return healthResponse(getAppContext().health);
}
