import { logoutResponse } from "@/http/admin-auth";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return logoutResponse(getAppContext().auth, request);
}
