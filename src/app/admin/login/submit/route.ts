import { loginResponse } from "@/http/admin-auth";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return loginResponse(getAppContext().auth, request);
}
