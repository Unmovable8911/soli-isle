import type { Metadata } from "next";
import { headers } from "next/headers";

import { NotFoundView } from "@/components/not-found-view";
import { requestLocale } from "@/components/request-locale";
import { LOCALE_HEADER } from "@/domain/locale";

/**
 * The 404 a client-side navigation renders inside the shell. A full document
 * load cannot use this boundary — the shell has already streamed by the time a
 * page throws, so Next answers with its error document — which is why
 * `global-not-found.tsx` exists as well. Both draw the same view.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const requestHeaders = await headers();
  return <NotFoundView locale={requestLocale(requestHeaders.get(LOCALE_HEADER))} />;
}
