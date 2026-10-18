"use client";

import type { Locale } from "@/config/site";
import { messages } from "@/messages";

import { EmptyState } from "./empty-state";
import { MAIN_CONTENT_ID } from "./skip-link";

/**
 * The error boundary's page. A 500 is not a 404 and not a 410: the work exists
 * and the server failed, so the copy says so and the one action is to try the
 * same request again. The boundary has no params, so the Locale arrives from the
 * route the client is already on.
 */
export function ErrorView({ locale, onRetry }: { locale: Locale; onRetry: () => void }) {
  const t = messages[locale].reader.error;

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <meta name="robots" content="noindex" />
      <EmptyState
        level={1}
        kicker={t.kicker}
        title={t.title}
        body={t.body}
        action={
          <button type="button" className="empty-state-retry" onClick={onRetry}>
            {t.retry}
          </button>
        }
      />
    </main>
  );
}
