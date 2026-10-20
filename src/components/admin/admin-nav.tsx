"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_ENTRIES, ADMIN_ENTRY_PATHS, adminEntryFor } from "@/domain/admin-entry";
import type { Messages } from "@/messages";

export type AdminNavLabels = Messages["admin"]["shell"];

/**
 * The console's horizontal navigation. It is a client component for one reason
 * only: `aria-current` needs the pathname, and a layout is not given it. The
 * markup is still server-rendered, so the marker is in the HTML a browser
 * receives before any script runs.
 */
export function AdminNav({ shell }: { shell: AdminNavLabels }) {
  const current = adminEntryFor(usePathname() ?? "");

  return (
    <nav className="admin-nav" aria-label={shell.navLabel}>
      <ul>
        {ADMIN_ENTRIES.map((entry) => (
          <li key={entry}>
            <Link
              href={ADMIN_ENTRY_PATHS[entry]}
              aria-current={entry === current ? "page" : undefined}
            >
              {shell.nav[entry]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
