export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (cookieHeader === null) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [partName = "", ...rest] = part.trim().split("=");
    if (partName === name) {
      return rest.join("=") || null;
    }
  }

  return null;
}
