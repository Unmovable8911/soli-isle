"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

import { ErrorView } from "@/components/error-view";
import { requestLocale } from "@/components/request-locale";

/**
 * A page that threw. The response is a 500 and the body is the site's own error
 * page; the boundary receives the route's params through `useParams`, so the copy
 * is in the Reader's Locale. The digest is the only thing worth logging — the
 * message itself may carry data.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = requestLocale(typeof params?.locale === "string" ? params.locale : null);

  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return <ErrorView locale={locale} onRetry={reset} />;
}
