import Link from "next/link";

import type { Locale } from "@/config/site";
import { buildHomePath } from "@/domain/public-paths";
import { messages } from "@/messages";

import { EmptyState } from "./empty-state";
import { MAIN_CONTENT_ID } from "./skip-link";

/**
 * 404: the address was never here. A real page in the site's own language, with
 * the shell above it and a way back — not the framework's bare fallback, which
 * arrives with no stylesheet and no Locale.
 */
export function NotFoundView({ locale }: { locale: Locale }) {
  const t = messages[locale].reader.notFound;

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <meta name="robots" content="noindex" />
      <EmptyState
        level={1}
        kicker={t.kicker}
        title={t.title}
        body={t.body}
        action={<Link href={buildHomePath(locale)}>{t.back}</Link>}
      />
    </main>
  );
}
