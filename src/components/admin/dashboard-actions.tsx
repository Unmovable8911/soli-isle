"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PublicationVisibility } from "@/domain/publication";
import { publicationActions } from "@/domain/publication-actions";
import type { Messages } from "@/messages";

import { ConfirmDialog } from "./confirm-dialog";

export type DashboardLabels = Messages["admin"]["dashboard"];

export interface LifecycleActionsProps {
  kind: "article" | "post";
  targetId: string;
  /** The derived Publication State; the buttons are read off it, not guessed. */
  visibility: PublicationVisibility;
  labels: DashboardLabels;
}

type Failure = keyof DashboardLabels["actions"];

function endpoint(kind: "article" | "post", id: string): string {
  return kind === "article" ? `/api/admin/articles/${id}` : `/api/admin/posts/${id}`;
}

/**
 * Publish, schedule, archive, unarchive and delete, from the row itself. Every
 * control is a native button or input, so Tab reaches it and Enter or Space
 * runs it; the destructive one goes through the confirmation dialog.
 */
export function LifecycleActions({ kind, targetId, visibility, labels }: LifecycleActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publishTime, setPublishTime] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const offers = publicationActions(visibility);
  const base = endpoint(kind, targetId);

  async function send(path: string, init: RequestInit, onFailure: Failure): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        setFailure(onFailure);
        return;
      }
      router.refresh();
    } catch {
      setFailure(onFailure);
    } finally {
      setBusy(false);
    }
  }

  function publish(action: "publish", withTime?: string): void {
    const body =
      withTime === undefined || withTime.length === 0 ? { action } : { action, publishTime: withTime };
    void send(
      `${base}/publication`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      withTime === undefined ? "publishFailed" : "scheduleFailed",
    );
  }

  function archive(action: "archive" | "unarchive"): void {
    void send(
      `${base}/publication`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      },
      action === "archive" ? "archiveFailed" : "unarchiveFailed",
    );
  }

  function deletePermanently(): void {
    setConfirming(false);
    void send(base, { method: "DELETE" }, "deleteFailed");
  }

  return (
    <div className="row-actions">
      {offers.publishNow ? (
        <button type="button" disabled={busy} onClick={() => publish("publish")}>
          {labels.actions.publishNow}
        </button>
      ) : null}

      {offers.schedule ? (
        <span className="row-schedule">
          <input
            type="datetime-local"
            value={publishTime}
            aria-label={labels.actions.scheduleLabel}
            onChange={(event) => setPublishTime(event.currentTarget.value)}
          />
          <button
            type="button"
            disabled={busy || publishTime.length === 0}
            onClick={() => publish("publish", publishTime)}
          >
            {labels.actions.schedule}
          </button>
        </span>
      ) : null}

      {offers.archive ? (
        <button type="button" disabled={busy} onClick={() => archive("archive")}>
          {labels.actions.archive}
        </button>
      ) : null}

      {offers.unarchive ? (
        <button type="button" disabled={busy} onClick={() => archive("unarchive")}>
          {labels.actions.unarchive}
        </button>
      ) : null}

      <button type="button" disabled={busy} onClick={() => setConfirming(true)}>
        {labels.actions.delete}
      </button>

      {failure === null ? null : (
        <p role="alert" className="article-error">
          {labels.actions[failure]}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        title={labels.actions.confirmDeleteTitle}
        body={labels.actions.confirmDeleteBody}
        confirmLabel={labels.actions.confirmDelete}
        cancelLabel={labels.actions.cancel}
        onConfirm={deletePermanently}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
