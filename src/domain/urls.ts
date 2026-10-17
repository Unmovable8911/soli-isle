export interface HeaderSource {
  get(name: string): string | null;
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

export function forwardedProtocol(headers: HeaderSource): "http" | "https" {
  const protocol = firstHeaderValue(headers.get("x-forwarded-proto"))?.toLowerCase();
  return protocol === "https" ? "https" : "http";
}

export function clientAddress(headers: HeaderSource): string | null {
  return firstHeaderValue(headers.get("x-forwarded-for"));
}

function relativePath(pathname: string): string {
  if (
    /^[a-z][a-z\d+.-]*:/i.test(pathname) ||
    pathname.startsWith("//") ||
    pathname.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(pathname)
  ) {
    throw new Error("Expected a relative path");
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function requestHost(headers: HeaderSource): string | null {
  const host = headers.get("host")?.trim();
  if (!host || /[\s/\\@#?]/.test(host)) {
    return null;
  }

  try {
    const parsed = new URL(`http://${host}/`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.host.toLowerCase() !== host.toLowerCase()
    ) {
      return null;
    }
    return parsed.host;
  } catch {
    return null;
  }
}

export function absoluteUrl(pathname: string, headers: HeaderSource): string | null {
  const host = requestHost(headers);
  if (!host) {
    return null;
  }

  const path = relativePath(pathname);
  return new URL(path, `${forwardedProtocol(headers)}://${host}`).toString();
}

export function requestUrl(pathname: string, headers: HeaderSource): string {
  const path = relativePath(pathname);
  return absoluteUrl(path, headers) ?? path;
}
