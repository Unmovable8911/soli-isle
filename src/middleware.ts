import { normalizeProxyHeaders } from "@/domain/proxy-headers";
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.next({ request: { headers: normalizeProxyHeaders(request.headers) } });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
