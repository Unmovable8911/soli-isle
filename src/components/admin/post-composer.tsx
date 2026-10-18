"use client";

/* eslint-disable @next/next/no-img-element -- composer thumbnails come from our
   own /media route handler; next/image would add an optimizer hop for no gain. */

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AssetPicker } from "@/components/admin/asset-picker";
import type { AssetLabels } from "@/components/admin/asset-library";
import { siteConfig, type Locale } from "@/config/site";
import { buildAssetAddress } from "@/domain/asset-address";
import { articleExtensions } from "@/editor/extensions";
import { looksLikeMarkdown, parseMarkdown } from "@/editor/markdown";
import type { Messages } from "@/messages";
import type { AssetSummary } from "@/services/assets";
import type { PostDetail } from "@/services/posts";
import type { TagView } from "@/services/tags";

export type PostLabels = Messages["admin"]["posts"];

type SaveStatus = "idle" | "saving" | "saved" | "failed" | "stale";

const EMPTY_BODY = '{"type":"doc","content":[{"type":"paragraph"}]}';

export interface PostComposerProps {
  post: PostDetail;
  /** The Locale the console is being read in; the version the composer opens on. */
  locale: Locale;
  labels: PostLabels;
  assetLabels: AssetLabels;
}

/**
 * The Admin composer: body, an ordered image set, Tags and the same
 * draft/schedule/archive/permanent-delete lifecycle Articles have.
 *
 * It has no Slug, no Category, no Revision panel and no Character Count —
 * nothing here measures or limits what the Author wrote.
 */
export default function PostComposer({ post, locale, labels, assetLabels }: PostComposerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(post);
  const [activeLocale, setActiveLocale] = useState<Locale>(() => {
    const preferred = post.translations.find((translation) => translation.locale === locale);
    return preferred?.locale ?? post.translations[0]?.locale ?? locale;
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagView[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingLocaleRemove, setPendingLocaleRemove] = useState(false);
  const [localeRemoveBusy, setLocaleRemoveBusy] = useState(false);
  const [publishInput, setPublishInput] = useState("");

  const translation = detail.translations.find((candidate) => candidate.locale === activeLocale);
  const bodyRef = useRef<string>(translation?.bodyJson ?? EMPTY_BODY);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: articleExtensions,
    content: JSON.parse(bodyRef.current) as JSONContent,
    editorProps: {
      attributes: {
        class: "post-composer-surface",
        "aria-label": labels.body.placeholder,
      },
      handlePaste(view, event) {
        const clipboard = event.clipboardData;
        if (clipboard === null) {
          return false;
        }
        const text = clipboard.getData("text/plain");
        const html = clipboard.getData("text/html");
        if (text.length === 0 || html.length > 0 || !looksLikeMarkdown(text)) {
          return false;
        }
        event.preventDefault();
        editorRef.current?.commands.insertContent(parseMarkdown(text));
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      bodyRef.current = JSON.stringify(instance.getJSON());
      setStatus("idle");
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/tags")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { tags?: TagView[] } | null) => {
        if (!cancelled && payload !== null && payload.tags !== undefined) {
          setAvailableTags(payload.tags);
        }
      })
      .catch(() => {
        // The Tag list is a convenience; a failed read must not block writing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function adopt(next: PostDetail) {
    setDetail(next);
    const current = next.translations.find((candidate) => candidate.locale === activeLocale);
    if (current !== undefined) {
      bodyRef.current = current.bodyJson;
    }
  }

  async function readPost(response: Response): Promise<PostDetail | null> {
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error === "stale-content" ? "stale" : "failed");
      return null;
    }
    const payload = (await response.json()) as { post: PostDetail };
    adopt(payload.post);
    return payload.post;
  }

  function switchLocale(next: Locale, from: PostDetail = detail) {
    setActiveLocale(next);
    setStatus("idle");
    const target = from.translations.find((candidate) => candidate.locale === next);
    bodyRef.current = target?.bodyJson ?? EMPTY_BODY;
    editor?.commands.setContent(JSON.parse(bodyRef.current) as JSONContent, { emitUpdate: false });
  }

  /** Every write goes through here, so the body being edited is the body saved. */
  async function saveBody(): Promise<PostDetail | null> {
    const current = detail.translations.find((candidate) => candidate.locale === activeLocale);
    setError(null);

    if (current === undefined) {
      const added = await fetch(`/api/admin/posts/${detail.id}/translations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: activeLocale, bodyJson: bodyRef.current }),
      });
      return readPost(added);
    }

    setStatus("saving");
    const response = await fetch(`/api/admin/posts/${detail.id}/translations/${activeLocale}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseVersion: current.version, bodyJson: bodyRef.current }),
    });
    const saved = await readPost(response);
    if (saved !== null) {
      setStatus("saved");
    }
    return saved;
  }

  async function putImages(assetIds: string[]) {
    setError(null);
    const response = await fetch(`/api/admin/posts/${detail.id}/images`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetIds }),
    });
    if ((await readPost(response)) === null) {
      setError(labels.saveFailed);
    }
  }

  async function putTags(tagIds: string[]) {
    setError(null);
    const response = await fetch(`/api/admin/posts/${detail.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagIds }),
    });
    if ((await readPost(response)) === null) {
      setError(labels.saveFailed);
    }
  }

  /** Why this Locale version cannot be deleted, or null when it can. */
  function localeRemoveLock(locale: Locale): string | null {
    if (locale === detail.defaultLocale) {
      return labels.languages.lockedDefault;
    }
    if (detail.translations.length <= 1) {
      return labels.languages.lockedLast;
    }
    return null;
  }

  async function changeDefaultLocale(next: string) {
    setError(null);
    const response = await fetch(`/api/admin/posts/${detail.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultLocale: next }),
    });
    if ((await readPost(response)) === null) {
      setError(labels.saveFailed);
    }
  }

  async function removeLocaleVersion() {
    const locale = activeLocale;
    setPendingLocaleRemove(false);
    setLocaleRemoveBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/posts/${detail.id}/translations/${locale}`, {
        method: "DELETE",
      });
      const remaining = await readPost(response);
      if (remaining === null) {
        setError(labels.languages.removeFailed);
        return;
      }
      const target =
        remaining.translations.find(
          (candidate) => candidate.locale === remaining.defaultLocale,
        ) ?? remaining.translations[0];
      if (target !== undefined) {
        switchLocale(target.locale, remaining);
      }
    } finally {
      setLocaleRemoveBusy(false);
    }
  }

  async function publication(payload: Record<string, unknown>) {
    setError(null);
    const response = await fetch(`/api/admin/posts/${detail.id}/publication`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if ((await readPost(response)) === null) {
      setError(labels.publish.publishFailed);
    }
  }

  async function saveThenPublish(payload: Record<string, unknown>) {
    if ((await saveBody()) === null) {
      return;
    }
    await publication(payload);
  }

  async function deletePost() {
    setError(null);
    const response = await fetch(`/api/admin/posts/${detail.id}`, { method: "DELETE" });
    if (response.status === 204) {
      router.push("/admin/posts");
      return;
    }
    setError(labels.publish.deleteFailed);
  }

  async function createTag() {
    const name = newTagName.trim();
    if (name.length === 0) {
      return;
    }
    setTagBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: activeLocale, name }),
      });
      if (!response.ok) {
        setError(labels.tags.createFailed);
        return;
      }
      const payload = (await response.json()) as { tag: TagView };
      setAvailableTags((current) => [
        ...current.filter((tag) => tag.id !== payload.tag.id),
        payload.tag,
      ]);
      setNewTagName("");
      await putTags([...detail.tags.map((tag) => tag.id), payload.tag.id]);
    } finally {
      setTagBusy(false);
    }
  }

  function moveImage(index: number, delta: number) {
    const assetIds = detail.images.map((image) => image.assetId);
    const target = index + delta;
    if (target < 0 || target >= assetIds.length) {
      return;
    }
    const moved = assetIds.splice(index, 1)[0];
    if (moved === undefined) {
      return;
    }
    assetIds.splice(target, 0, moved);
    void putImages(assetIds);
  }

  const attachedTagIds = new Set(detail.tags.map((tag) => tag.id));
  const addableTags = availableTags.filter((tag) => !attachedTagIds.has(tag.id));

  return (
    <div className="post-composer">
      <div className="post-composer-header">
        <Link href="/admin/posts">{labels.backToList}</Link>
        <span className="post-composer-state">
          {labels.state[detail.publicationState]} · {labels.visibility[detail.visibility]}
        </span>
        <span className="post-composer-save" role="status" aria-live="polite">
          {
            {
              idle: "",
              saving: labels.saving,
              saved: labels.saved,
              failed: labels.saveFailed,
              stale: labels.stale,
            }[status]
          }
        </span>
        <button type="button" onClick={() => void saveBody()} disabled={status === "saving"}>
          {labels.save}
        </button>
      </div>

      {error !== null && (
        <p className="post-composer-error" role="alert">
          {error}
        </p>
      )}

      <div className="post-composer-locales">
        <span>{labels.languages.label}</span>
        {siteConfig.locales.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={candidate === activeLocale}
            onClick={() => switchLocale(candidate)}
          >
            {candidate}
          </button>
        ))}
        {translation === undefined && (
          <span className="post-composer-hint">{labels.languages.missing}</span>
        )}
        {translation === undefined ? null : pendingLocaleRemove ? (
          <span className="post-composer-remove-locale">
            <button
              type="button"
              disabled={localeRemoveBusy}
              onClick={() => void removeLocaleVersion()}
            >
              {labels.languages.confirmRemove}
            </button>
            <button type="button" onClick={() => setPendingLocaleRemove(false)}>
              {labels.languages.cancel}
            </button>
          </span>
        ) : (
          <span className="post-composer-remove-locale">
            <button
              type="button"
              disabled={localeRemoveLock(activeLocale) !== null || localeRemoveBusy}
              onClick={() => setPendingLocaleRemove(true)}
            >
              {labels.languages.remove}
            </button>
            {localeRemoveLock(activeLocale) === null ? null : (
              <span className="post-composer-hint">{localeRemoveLock(activeLocale)}</span>
            )}
          </span>
        )}
        <label className="post-composer-default-locale">
          <span>{labels.meta.defaultLocale}</span>
          <select
            value={detail.defaultLocale}
            onChange={(event) => void changeDefaultLocale(event.target.value)}
          >
            {detail.translations.map((candidate) => (
              <option key={candidate.locale} value={candidate.locale}>
                {candidate.locale}
              </option>
            ))}
          </select>
          <span className="post-composer-hint">{labels.meta.defaultLocaleHint}</span>
        </label>
      </div>

      {/* Deliberately no character count and no length limit: nothing here
          measures or caps what the Author wrote. */}
      <EditorContent editor={editor} />

      <div className="post-composer-main">
        <section className="post-composer-panel">
          <h2>{labels.images.title}</h2>
          {detail.images.length === 0 ? (
            <p className="post-composer-empty">{labels.images.empty}</p>
          ) : (
            <ul className="post-images">
              {detail.images.map((image, index) => (
                <li key={image.assetId}>
                  <img
                    src={buildAssetAddress({
                      assetId: image.assetId,
                      variant: "thumb",
                      format: "webp",
                    })}
                    alt=""
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                  />
                  <span className="post-images-name">{image.fileName}</span>
                  <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>
                    {labels.images.up}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === detail.images.length - 1}
                  >
                    {labels.images.down}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void putImages(
                        detail.images
                          .map((candidate) => candidate.assetId)
                          .filter((assetId) => assetId !== image.assetId),
                      )
                    }
                  >
                    {labels.images.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="post-composer-hint">{labels.images.hint}</p>
          <div>
            <button type="button" onClick={() => setPickerOpen(true)}>
              {labels.images.add}
            </button>
          </div>
        </section>

        <section className="post-composer-panel">
          <h2>{labels.tags.title}</h2>
          {detail.tags.length === 0 ? (
            <p className="post-composer-empty">{labels.tags.empty}</p>
          ) : (
            <ul className="post-composer-tags">
              {detail.tags.map((tag) => (
                <li key={tag.id}>
                  <span>{tag.names[locale] ?? tag.slug}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void putTags(
                        detail.tags
                          .map((candidate) => candidate.id)
                          .filter((tagId) => tagId !== tag.id),
                      )
                    }
                  >
                    {labels.tags.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="post-composer-inline">
            <select
              aria-label={labels.tags.select}
              value=""
              onChange={(event) => {
                const tagId = event.currentTarget.value;
                if (tagId.length > 0) {
                  void putTags([...detail.tags.map((tag) => tag.id), tagId]);
                }
              }}
            >
              <option value="">{labels.tags.select}</option>
              {addableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.names[locale] ?? tag.slug}
                </option>
              ))}
            </select>
            <input
              value={newTagName}
              placeholder={labels.tags.newPlaceholder}
              aria-label={labels.tags.newPlaceholder}
              onChange={(event) => setNewTagName(event.currentTarget.value)}
            />
            <button type="button" onClick={() => void createTag()} disabled={tagBusy}>
              {tagBusy ? labels.tags.creating : labels.tags.create}
            </button>
          </div>
        </section>
      </div>

      <section className="post-composer-panel post-composer-publish">
        <h2>{labels.publish.panel}</h2>
        <div className="post-composer-actions">
          <button type="button" onClick={() => void saveThenPublish({ action: "publish" })}>
            {labels.publish.publishNow}
          </button>
          {detail.publicationState === "archived" ? (
            <button type="button" onClick={() => void publication({ action: "unarchive" })}>
              {labels.publish.unarchive}
            </button>
          ) : (
            <button type="button" onClick={() => void publication({ action: "archive" })}>
              {labels.publish.archive}
            </button>
          )}
        </div>
        <label>
          {labels.publish.publishTime}{" "}
          <input
            type="datetime-local"
            value={publishInput}
            onChange={(event) => setPublishInput(event.currentTarget.value)}
          />
        </label>
        <div className="post-composer-actions">
          <button
            type="button"
            disabled={publishInput.length === 0}
            onClick={() => void saveThenPublish({ action: "publish", publishTime: publishInput })}
          >
            {labels.publish.schedule}
          </button>
        </div>
        <p className="post-composer-hint">{labels.publish.hintScheduled}</p>

        <div className="post-composer-actions">
          {confirmDelete ? (
            <>
              <button type="button" onClick={() => void deletePost()}>
                {labels.publish.confirmDelete}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                {labels.publish.cancel}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}>
              {labels.publish.delete}
            </button>
          )}
        </div>
      </section>

      <AssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset: AssetSummary) =>
          void putImages([...detail.images.map((image) => image.assetId), asset.id])
        }
        labels={assetLabels}
      />
    </div>
  );
}
