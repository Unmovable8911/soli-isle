"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Locale } from "@/config/site";

export interface NewWorkButtonProps {
  kind: "article" | "post";
  locale: Locale;
  label: string;
  failedLabel: string;
}

/**
 * The one primary action a list page has: create a work and open it. It lives
 * in the page head rather than inside the list, so the list is a list and the
 * page has exactly one place to start a new thing.
 */
export function NewWorkButton({ kind, locale, label, failedLabel }: NewWorkButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/admin/${kind}s`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const payload = (await response.json()) as {
        article?: { id: string };
        post?: { id: string };
      };
      const created = kind === "article" ? payload.article : payload.post;
      if (created === undefined) {
        setFailed(true);
        return;
      }
      router.push(`/admin/${kind}s/${created.id}`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="admin-page-action admin-page-action-primary"
        disabled={busy}
        onClick={() => void create()}
      >
        {label}
      </button>
      {failed ? (
        <p role="alert" className="article-error">
          {failedLabel}
        </p>
      ) : null}
    </>
  );
}
