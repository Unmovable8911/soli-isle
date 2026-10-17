import { clientAddress, forwardedProtocol } from "./urls";

export function normalizeProxyHeaders(headers: Headers): Headers {
  const normalized = new Headers(headers);
  const address = clientAddress(headers);

  normalized.set("x-forwarded-proto", forwardedProtocol(headers));
  if (address) {
    normalized.set("x-forwarded-for", address);
  } else {
    normalized.delete("x-forwarded-for");
  }

  return normalized;
}
