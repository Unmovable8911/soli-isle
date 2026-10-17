export function serializeSessionCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  return serializeAttributes(`${name}=${value}`, maxAgeSeconds, secure);
}

export function serializeSessionCookieClear(name: string, secure: boolean): string {
  return serializeAttributes(`${name}=`, null, secure);
}

function serializeAttributes(
  leadingPair: string,
  maxAgeSeconds: number | null,
  secure: boolean,
): string {
  const attributes = [leadingPair];
  if (maxAgeSeconds === null) {
    attributes.push("Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Path=/");
  } else {
    attributes.push("Path=/", `Max-Age=${maxAgeSeconds}`);
  }
  attributes.push("HttpOnly", "SameSite=Lax");
  if (secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}
