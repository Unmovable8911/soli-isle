"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { siteConfig, type Locale } from "@/config/site";
import type { Messages } from "@/messages";
import type { TagView } from "@/services/tags";

import { tagDeleteNotice, type TagLabels } from "./catalogue-notices";
import { ConfirmDialog } from "./confirm-dialog";

export type LocaleNames = Messages["chrome"]["localeNames"];

export interface TagManagerProps {
  tags: TagView[];
  locale: Locale;
  labels: TagLabels;
  localeNames: LocaleNames;
}

/**
 * Tags: one Slug, a display name per Locale. A Tag that anything is filed under
 * is not deleted — the refusal says how much work uses it.
 */
export function TagManager({ tags, locale, labels, localeNames }: TagManagerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagView | null>(null);
  const nameId = useId();
  const slugId = useId();

  async function write(path: string, init: RequestInit, failure: string): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        setNotice(failure);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setNotice(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function createTag(form: FormData): void {
    const slug = form.get("slug");
    void write(
      "/api/admin/tags",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          name: String(form.get("name") ?? ""),
          ...(typeof slug === "string" && slug.length > 0 ? { slug } : {}),
        }),
      },
      labels.create.failed,
    );
  }

  async function confirmDelete(): Promise<void> {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target === null) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/tags/${target.id}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice(tagDeleteNotice(labels, await response.json().catch(() => null)));
        return;
      }
      router.refresh();
    } catch {
      setNotice(labels.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tag-manager">
      {notice === null ? null : (
        <p role="alert" className="article-error">
          {notice}
        </p>
      )}

      <section className="tag-create" id="tag-create" aria-labelledby={`${nameId}-heading`}>
        <h2 id={`${nameId}-heading`}>{labels.create.title}</h2>
        <form
          className="tag-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            event.currentTarget.reset();
            createTag(form);
          }}
        >
          <label htmlFor={nameId}>{labels.create.name}</label>
          <input id={nameId} name="name" required />
          <label htmlFor={slugId}>{labels.create.slug}</label>
          <input id={slugId} name="slug" />
          <button type="submit" disabled={busy}>
            {busy ? labels.create.creating : labels.create.submit}
          </button>
        </form>
      </section>

      {tags.length === 0 ? (
        <p className="article-empty">{labels.empty}</p>
      ) : (
        <TagTable
          tags={tags}
          labels={labels}
          localeNames={localeNames}
          busy={busy}
          onSave={(tag, entry, name) =>
            void write(
              `/api/admin/tags/${tag.id}`,
              {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "rename", locale: entry, name }),
              },
              labels.renameFailed,
            )
          }
          onDelete={setDeleteTarget}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={labels.deleteTitle}
        body={labels.deleteBody}
        confirmLabel={labels.confirmDelete}
        cancelLabel={labels.cancel}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export interface TagTableProps {
  tags: TagView[];
  labels: TagLabels;
  localeNames: LocaleNames;
  busy: boolean;
  onSave: (tag: TagView, locale: Locale, name: string) => void;
  onDelete: (tag: TagView) => void;
}

/** The Tag rows, free of browser state so the markup can be asserted. */
export function TagTable({
  tags,
  labels,
  localeNames,
  busy,
  onSave,
  onDelete,
}: TagTableProps) {
  return (
    <div className="table-scroll">
      <table className="article-table tag-table">
        <thead>
          <tr>
            <th scope="col">{labels.columns.slug}</th>
            <th scope="col">{labels.columns.names}</th>
            <th scope="col">{labels.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag.id}>
              <td>
                <code>{tag.slug}</code>
              </td>
              <td>
                <TagNames
                  tag={tag}
                  labels={labels}
                  localeNames={localeNames}
                  busy={busy}
                  onSave={(entry, name) => onSave(tag, entry, name)}
                />
              </td>
              <td>
                <button type="button" disabled={busy} onClick={() => onDelete(tag)}>
                  {labels.delete}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TagNamesProps {
  tag: TagView;
  labels: TagLabels;
  localeNames: LocaleNames;
  busy: boolean;
  onSave: (locale: Locale, name: string) => void;
}

/** One small form per Locale: the name is per Locale, the Slug is the identity. */
function TagNames({ tag, labels, localeNames, busy, onSave }: TagNamesProps) {
  const baseId = useId();

  return (
    <div className="tag-names">
      {siteConfig.locales.map((entry) => {
        const inputId = `${baseId}-${entry}`;
        return (
          <form
            key={entry}
            className="tag-name-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("name");
              onSave(entry, String(value ?? ""));
            }}
          >
            <label htmlFor={inputId}>{localeNames[entry]}</label>
            <input
              id={inputId}
              name="name"
              defaultValue={tag.names[entry] ?? ""}
              placeholder={tag.slug}
            />
            <button type="submit" disabled={busy}>
              {labels.save}
            </button>
          </form>
        );
      })}
    </div>
  );
}
