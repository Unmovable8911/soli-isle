"use client";

import type { JSONContent } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { articleConfig } from "@/config/article";
import { siteConfig, type Locale } from "@/config/site";
import type { ServerArticleState } from "@/domain/article-sync";
import { systemClock } from "@/domain/clock";
import { pickLocalised } from "@/domain/localised";
import { EMPTY_DOCUMENT } from "@/domain/rich-text";
import { instantToSiteLocal } from "@/domain/site-time";
import { flattenTree } from "@/domain/tree";
import { articleExtensions } from "@/editor/extensions";
import { looksLikeMarkdown, parseMarkdown } from "@/editor/markdown";
import { CALLOUT_TONES } from "@/editor/nodes/callout";
import type { Messages } from "@/messages";
import type { ArticleDetail, ArticleTranslationView } from "@/services/articles";
import type { CategoryNode } from "@/services/categories";
import type { TagView } from "@/services/tags";
import type { AssetSummary } from "@/services/assets";

import { ArticleBody } from "../article-body";
import { AssetPicker } from "./asset-picker";
import type { AssetLabels } from "./asset-library";
import { CoverField } from "./cover-field";
import {
  getArticleDraftStore,
  type ArticleDraftStore,
  type PendingArticleEdit,
} from "./article-local-store";
import {
  createArticleSyncEngine,
  createTimeoutSchedule,
  type ArticleSyncEngine,
  type SyncStatus,
} from "./article-sync-engine";
import { createArticleSyncTransport } from "./article-sync-transport";
import { createSlashCommand, createSlashItems } from "./slash-menu";

export type ArticleLabels = Messages["admin"]["articles"];

interface EditorSession {
  engine: ArticleSyncEngine;
  store: ArticleDraftStore;
}

function toServerState(translation: ArticleTranslationView): ServerArticleState {
  return {
    version: translation.version,
    title: translation.title,
    summary: translation.summary,
    bodyJson: translation.bodyJson,
  };
}

/** Keeps the read model in step with a translation the server has just acknowledged. */
function withSavedTranslation(
  article: ArticleDetail,
  locale: Locale,
  translation: ServerArticleState,
): ArticleDetail {
  return {
    ...article,
    translations: article.translations.map((candidate) =>
      candidate.locale === locale
        ? {
            ...candidate,
            version: translation.version,
            title: translation.title,
            summary: translation.summary,
            bodyJson: translation.bodyJson,
          }
        : candidate,
    ),
  };
}

export interface ArticleEditorProps {
  article: ArticleDetail;
  categories: CategoryNode[];
  tags: TagView[];
  locale: Locale;
  labels: ArticleLabels;
  assetLabels: AssetLabels;
}

interface LatestSnapshot {
  locale: Locale;
  title: string;
  summary: string;
  bodyJson: string;
}

function toPublishTimeInput(publishTime: string | null): string {
  return publishTime === null
    ? ""
    : instantToSiteLocal(new Date(publishTime), siteConfig.timeZone);
}

export default function ArticleEditor({
  article,
  categories,
  tags,
  locale,
  labels,
  assetLabels,
}: ArticleEditorProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<ArticleDetail>(article);
  const [activeLocale, setActiveLocale] = useState<Locale>(article.defaultLocale);
  const translation =
    detail.translations.find((candidate) => candidate.locale === activeLocale) ?? null;

  const [title, setTitle] = useState(translation?.title ?? "");
  const [summary, setSummary] = useState(translation?.summary ?? "");
  const [slug, setSlug] = useState(article.slug);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [recovered, setRecovered] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const conflictRef = useRef<HTMLElement | null>(null);
  const conflictReturnFocus = useRef<HTMLElement | null>(null);
  const [newDraftBusy, setNewDraftBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingLocaleRemove, setPendingLocaleRemove] = useState(false);
  const [localeRemoveBusy, setLocaleRemoveBusy] = useState(false);
  const [publishTimeInput, setPublishTimeInput] = useState(
    toPublishTimeInput(article.publishTime),
  );
  const [tree, setTree] = useState<CategoryNode[]>(categories);
  const [tagList, setTagList] = useState<TagView[]>(tags);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");

  const latest = useRef<LatestSnapshot>({
    locale: activeLocale,
    title,
    summary,
    bodyJson: translation?.bodyJson ?? EMPTY_DOCUMENT,
  });
  const editorRef = useRef<Editor | null>(null);
  const sessionRef = useRef<EditorSession | null>(null);
  const detailRef = useRef<ArticleDetail>(detail);
  /** A recovered body the editor could not take yet because it mounted later. */
  const recoveredBody = useRef<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  // The conflict panel is a dialog the author has to answer, so it takes focus
  // when it opens, closes with Esc, and hands focus back to the control that
  // opened it — the same contract the Asset picker keeps.
  useEffect(() => {
    if (!conflictOpen) {
      return;
    }
    conflictReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    conflictRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setConflictOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previous = conflictReturnFocus.current;
      if (previous !== null && previous.isConnected) {
        previous.focus();
      }
    };
  }, [conflictOpen]);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const pushEdit = useCallback(() => {
    const snapshot = latest.current;
    const session = sessionRef.current;
    if (session !== null) {
      void session.engine.edit({
        title: snapshot.title,
        summary: snapshot.summary,
        bodyJson: snapshot.bodyJson,
      });
      return;
    }
    // No Locale version exists yet, so there is nothing to sync against — the
    // bytes still go to the durable store, and creating the version picks them
    // up instead of showing an empty page.
    setStatus("local");
    void getArticleDraftStore().save({
      articleId: article.id,
      locale: snapshot.locale,
      title: snapshot.title,
      summary: snapshot.summary,
      bodyJson: snapshot.bodyJson,
      baseVersion: 0,
      savedAt: systemClock.now().toISOString(),
    });
  }, [article.id]);

  /** Puts a body the Author cannot see yet back into the editor. */
  const adoptBody = useCallback((bodyJson: string) => {
    latest.current.bodyJson = bodyJson;
    const instance = editorRef.current;
    if (instance === null) {
      recoveredBody.current = bodyJson;
      return;
    }
    instance.commands.setContent(JSON.parse(bodyJson) as JSONContent, { emitUpdate: false });
  }, []);

  const adoptTranslation = useCallback(
    (next: ArticleTranslationView) => {
      setTitle(next.title);
      setSummary(next.summary);
      latest.current.title = next.title;
      latest.current.summary = next.summary;
      adoptBody(next.bodyJson);
    },
    [adoptBody],
  );

  const applyRecovered = useCallback(
    (draft: PendingArticleEdit) => {
      setTitle(draft.title);
      setSummary(draft.summary);
      latest.current.title = draft.title;
      latest.current.summary = draft.summary;
      adoptBody(draft.bodyJson);
      setRecovered(true);
    },
    [adoptBody],
  );

  // One session per Locale: it owns the local queue for that translation.
  useEffect(() => {
    const row = detailRef.current.translations.find(
      (candidate) => candidate.locale === activeLocale,
    );
    if (row === undefined) {
      sessionRef.current = null;
      setStatus("idle");
      return;
    }

    const store = getArticleDraftStore();
    const engine = createArticleSyncEngine({
      articleId: article.id,
      locale: activeLocale,
      store,
      transport: createArticleSyncTransport({ articleId: article.id, locale: activeLocale }),
      clock: systemClock,
      schedule: createTimeoutSchedule(),
      throttleMs: articleConfig.autosaveThrottleMs,
      retryBaseMs: articleConfig.syncRetryBaseMs,
      retryMaxMs: articleConfig.syncRetryMaxMs,
      onSaved: (translation) => {
        // Mirror the acknowledgement so a later session starts from the
        // version the server actually holds.
        setDetail((current) => withSavedTranslation(current, activeLocale, translation));
        // The service throttles this to one automatic snapshot per window.
        void fetch(`/api/admin/articles/${article.id}/revisions`, { method: "POST" });
      },
    });
    sessionRef.current = { engine, store };
    const unsubscribe = engine.subscribe(setStatus);

    let cancelled = false;
    void engine.start(toServerState(row)).then((outcome) => {
      if (cancelled) {
        return;
      }
      if (outcome.kind === "recovered") {
        applyRecovered(outcome.draft);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      engine.dispose();
      if (sessionRef.current?.engine === engine) {
        sessionRef.current = null;
      }
    };
  }, [article.id, activeLocale, sessionKey, applyRecovered]);

  useEffect(() => {
    const goOnline = () => sessionRef.current?.engine.setOnline(true);
    const goOffline = () => sessionRef.current?.engine.setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    setConflictOpen(status === "conflict");
  }, [status]);

  async function adoptServerCopy() {
    const session = sessionRef.current;
    const response = await fetch(`/api/admin/articles/${article.id}`);
    if (!response.ok) {
      setError(labels.sync.discardFailed);
      return;
    }
    const payload = (await response.json()) as { article: ArticleDetail };
    setDetail(payload.article);
    const next = payload.article.translations.find(
      (candidate) => candidate.locale === activeLocale,
    );
    if (next !== undefined) {
      adoptTranslation(next);
      session?.engine.adoptServer(toServerState(next));
    }
    await session?.engine.discardLocal();
    setRecovered(false);
  }

  async function saveLocalAsNewDraft() {
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    const draft = await session.store.load(article.id, activeLocale);
    if (draft === null) {
      return;
    }
    setNewDraftBusy(true);
    try {
      const response = await fetch("/api/admin/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          summary: draft.summary,
          bodyJson: draft.bodyJson,
          locale: activeLocale,
        }),
      });
      if (!response.ok) {
        setError(labels.sync.newDraftFailed);
        return;
      }
      const payload = (await response.json()) as { article: ArticleDetail };
      // Only once the new Article exists are the queued bytes no longer owed
      // to this one.
      await session.engine.discardLocal();
      router.push(`/admin/articles/${payload.article.id}`);
    } finally {
      setNewDraftBusy(false);
    }
  }

  const slashItems = useRef(
    createSlashItems(labels.slash, labels.editor, { onInsertImage: () => setPickerOpen(true) }),
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...articleExtensions,
      createSlashCommand(() => slashItems.current, labels.slash.empty),
    ],
    content: JSON.parse(latest.current.bodyJson) as JSONContent,
    editorProps: {
      attributes: {
        class: "article-editor-surface",
        "aria-label": labels.editor.bodyPlaceholder,
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
      latest.current.bodyJson = JSON.stringify(instance.getJSON());
      pushEdit();
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    const pendingBody = recoveredBody.current;
    if (editor !== null && pendingBody !== null) {
      recoveredBody.current = null;
      editor.commands.setContent(JSON.parse(pendingBody) as JSONContent, { emitUpdate: false });
    }
  }, [editor]);

  function switchLocale(next: Locale, from: ArticleDetail = detail) {
    const target = from.translations.find((candidate) => candidate.locale === next);
    setActiveLocale(next);
    setRecovered(false);
    recoveredBody.current = null;
    latest.current.locale = next;
    setTitle(target?.title ?? "");
    setSummary(target?.summary ?? "");
    latest.current.title = target?.title ?? "";
    latest.current.summary = target?.summary ?? "";
    latest.current.bodyJson = target?.bodyJson ?? EMPTY_DOCUMENT;
    if (target !== undefined) {
      editor?.commands.setContent(JSON.parse(target.bodyJson) as JSONContent, {
        emitUpdate: false,
      });
    }
  }

  async function addLocaleVersion() {
    const response = await fetch(`/api/admin/articles/${article.id}/translations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: activeLocale, title: "", bodyJson: EMPTY_DOCUMENT }),
    });
    if (!response.ok) {
      setError(labels.saveFailed);
      return;
    }
    const payload = (await response.json()) as { article: ArticleDetail };
    setDetail(payload.article);
    const created = payload.article.translations.find(
      (candidate) => candidate.locale === activeLocale,
    );

    // Bytes typed while the version did not exist are newer than the empty row
    // that was just created: send them instead of blanking the editor.
    const store = getArticleDraftStore();
    const draft = await store.load(article.id, activeLocale);
    if (draft !== null && created !== undefined) {
      const outcome = await createArticleSyncTransport({
        articleId: article.id,
        locale: activeLocale,
      }).save({ ...draft, baseVersion: created.version });
      if (outcome.kind === "saved") {
        await store.clear(article.id, activeLocale);
        setDetail(withSavedTranslation(payload.article, activeLocale, outcome.translation));
      }
    } else {
      editor?.commands.setContent(JSON.parse(created?.bodyJson ?? EMPTY_DOCUMENT) as JSONContent, {
        emitUpdate: false,
      });
    }
    setSessionKey((key) => key + 1);
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

  async function removeLocaleVersion() {
    const locale = activeLocale;
    setPendingLocaleRemove(false);
    setLocaleRemoveBusy(true);
    try {
      const response = await fetch(
        `/api/admin/articles/${article.id}/translations/${locale}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(labels.languages.removeFailed);
        return;
      }
      const payload = (await response.json()) as { article: ArticleDetail };
      setDetail(payload.article);
      // The deleted version's queued bytes are not owed to anything any more.
      await getArticleDraftStore().clear(article.id, locale);
      const remaining =
        payload.article.translations.find(
          (candidate) => candidate.locale === payload.article.defaultLocale,
        ) ?? payload.article.translations[0];
      if (remaining !== undefined) {
        switchLocale(remaining.locale, payload.article);
      }
      setSessionKey((key) => key + 1);
    } finally {
      setLocaleRemoveBusy(false);
    }
  }

  async function patchMeta(input: Record<string, unknown>) {
    const response = await fetch(`/api/admin/articles/${article.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      setError(labels.saveFailed);
      return null;
    }
    const payload = (await response.json()) as { article: ArticleDetail };
    setDetail(payload.article);
    setSlug(payload.article.slug);
    return payload.article;
  }

  async function postPublication(body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/articles/${article.id}/publication`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError(labels.publish.publishFailed);
      return;
    }
    const payload = (await response.json()) as { article: ArticleDetail };
    setDetail(payload.article);
    setPublishTimeInput(toPublishTimeInput(payload.article.publishTime));
  }

  async function deleteArticle() {
    const response = await fetch(`/api/admin/articles/${article.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(labels.publish.deleteFailed);
      return;
    }
    router.push("/admin/articles");
  }

  async function openPreview() {
    setPreviewOpen(true);
    setPreviewBusy(true);
    setPreviewHtml(null);
    try {
      const response = await fetch(`/api/admin/articles/${article.id}/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bodyJson: latest.current.bodyJson }),
      });
      if (!response.ok) {
        setError(labels.preview.loadFailed);
        return;
      }
      const payload = (await response.json()) as { html: string };
      setPreviewHtml(payload.html);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function createCategoryInline() {
    const name = newCategoryName.trim();
    if (name.length === 0) {
      return;
    }
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, locale: activeLocale }),
    });
    if (!response.ok) {
      setError(labels.meta.createFailed);
      return;
    }
    const payload = (await response.json()) as { category: CategoryNode };
    setTree((current) => [
      ...current,
      { ...payload.category, children: [] },
    ]);
    setNewCategoryName("");
    await patchMeta({ categoryId: payload.category.id });
  }

  async function createTagInline() {
    const name = newTagName.trim();
    if (name.length === 0) {
      return;
    }
    const response = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, locale: activeLocale }),
    });
    if (!response.ok) {
      setError(labels.meta.createFailed);
      return;
    }
    const payload = (await response.json()) as { tag: TagView };
    setTagList((current) => [...current.filter((tag) => tag.id !== payload.tag.id), payload.tag]);
    setNewTagName("");
    await patchMeta({ tagIds: [...detail.tags.map((tag) => tag.id), payload.tag.id] });
  }

  function insertAsset(asset: AssetSummary) {
    const display =
      asset.variants.find((variant) => variant.variant === "display") ?? asset.variants[0];
    if (display === undefined) {
      return;
    }
    editorRef.current
      ?.chain()
      .focus()
      .setImage({
        src: display.address,
        // No authored description exists yet, so the picture goes in without an
        // alt: the upload's file name is metadata about the Asset, not a
        // sentence a screen reader should read out.
        alt: "",
        width: asset.width,
        height: asset.height,
      })
      .run();
    setPickerOpen(false);
  }

  // The Cover is one Asset, chosen through the same library the body images come
  // from: the picker hands back an Asset, and the metadata path registers the
  // reference (services/articles.ts, syncArticleAssets) so a chosen Cover is
  // never an unreferenced image.
  function chooseCover(asset: AssetSummary) {
    setCoverPickerOpen(false);
    void patchMeta({ coverAssetId: asset.id });
  }

  function removeCover() {
    void patchMeta({ coverAssetId: null });
  }

  function applyLink() {
    const href = window.prompt(labels.editor.linkPrompt, "https://");
    if (href === null) {
      return;
    }
    if (href.trim().length === 0) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function applyCodeLanguage() {
    const language = window.prompt(labels.editor.codeLanguagePrompt, "typescript");
    if (language === null) {
      return;
    }
    editor?.chain().focus().updateAttributes("codeBlock", { language }).run();
  }

  const flatTree = flattenTree(tree);
  const statusLabel =
    status === "syncing"
      ? labels.saving
      : status === "saved"
        ? labels.saved
        : status === "local"
          ? labels.localSave
          : status === "offline"
            ? labels.sync.offline
            : status === "conflict"
              ? labels.sync.conflict
              : "";

  return (
    <div className="article-editor">
      <div className="article-editor-header">
        <Link href="/admin/articles">{labels.backToList}</Link>
        <span aria-live="polite" className={`article-save article-save-${status}`}>
          {statusLabel}
        </span>
        {status === "conflict" ? (
          <button type="button" onClick={() => setConflictOpen(true)}>
            {labels.sync.resolve}
          </button>
        ) : null}
        <button type="button" onClick={() => void openPreview()}>
          {labels.preview.open}
        </button>
      </div>

      {error === null ? null : (
        <p role="alert" className="article-error">
          {error}
        </p>
      )}

      {recovered ? (
        <p role="status" className="article-sync-notice">
          {labels.sync.recovered}
        </p>
      ) : null}

      {conflictOpen && status === "conflict" ? (
        <section
          className="article-conflict"
          role="dialog"
          aria-modal="false"
          aria-labelledby="article-conflict-title"
          aria-describedby="article-conflict-body"
          tabIndex={-1}
          ref={conflictRef}
        >
          <h2 id="article-conflict-title">{labels.sync.conflictTitle}</h2>
          <p id="article-conflict-body">{labels.sync.conflictBody}</p>
          <div className="article-conflict-actions">
            <button type="button" onClick={() => void adoptServerCopy()}>
              {labels.sync.discardLocal}
            </button>
            <button type="button" disabled={newDraftBusy} onClick={() => void saveLocalAsNewDraft()}>
              {newDraftBusy ? labels.sync.savingNewDraft : labels.sync.saveAsNewDraft}
            </button>
            <button type="button" onClick={() => setConflictOpen(false)}>
              {labels.sync.keepEditing}
            </button>
          </div>
        </section>
      ) : null}

      <div className="article-editor-locales" role="group" aria-label={labels.languages.label}>
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
        {translation === null ? (
          <button type="button" onClick={() => void addLocaleVersion()}>
            {labels.languages.add}
          </button>
        ) : (
          <span className="article-editor-remove-locale">
            {pendingLocaleRemove ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                disabled={localeRemoveLock(activeLocale) !== null || localeRemoveBusy}
                onClick={() => setPendingLocaleRemove(true)}
              >
                {labels.languages.remove}
              </button>
            )}
            {localeRemoveLock(activeLocale) === null ? null : (
              <span className="article-editor-hint">{localeRemoveLock(activeLocale)}</span>
            )}
          </span>
        )}
      </div>

      <div className="article-editor-main">
        <div className="article-editor-writing">
          {editor === null ? null : (
            <div className="article-toolbar" role="toolbar" aria-label={labels.editor.bodyPlaceholder}>
              <ToolbarButton
                label={labels.editor.toolbar.bold}
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.italic}
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.underline}
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.strike}
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.highlight}
                active={editor.isActive("highlight")}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.heading2}
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.heading3}
                active={editor.isActive("heading", { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.bulletList}
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.orderedList}
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.taskList}
                active={editor.isActive("taskList")}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.blockquote}
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.codeBlock}
                active={editor.isActive("codeBlock")}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.link}
                active={editor.isActive("link")}
                onClick={applyLink}
              />
              <ToolbarButton
                label={labels.editor.toolbar.image}
                active={false}
                onClick={() => setPickerOpen(true)}
              />
              <ToolbarButton
                label={labels.editor.toolbar.horizontalRule}
                active={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.undo}
                active={false}
                onClick={() => editor.chain().focus().undo().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.redo}
                active={false}
                onClick={() => editor.chain().focus().redo().run()}
              />
              <ToolbarButton
                label={labels.editor.toolbar.codeLanguage}
                active={false}
                onClick={applyCodeLanguage}
              />
              {editor.isActive("callout") ? (
                <label className="article-callout-tone">
                  <span>{labels.editor.calloutTone}</span>
                  <select
                    value={String(editor.getAttributes("callout").tone ?? "note")}
                    onChange={(event) =>
                      editor
                        .chain()
                        .focus()
                        .updateAttributes("callout", { tone: event.target.value })
                        .run()
                    }
                  >
                    {CALLOUT_TONES.map((tone) => (
                      <option key={tone} value={tone}>
                        {labels.editor.calloutTones[tone]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          )}

          <input
            className="article-title-input"
            aria-label={labels.meta.title}
            placeholder={labels.editor.titlePlaceholder}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              latest.current.title = event.target.value;
              pushEdit();
            }}
          />

          <div className="article-editor-content">
            <EditorContent editor={editor} />
            {editor === null ? null : (
              <DragHandle editor={editor} className="article-drag-handle">
                <span aria-hidden="true">⠿</span>
              </DragHandle>
            )}
          </div>
        </div>

        <aside className="article-meta" aria-label={labels.meta.title}>
          <label className="article-field">
            <span>{labels.meta.slug}</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              onBlur={() => {
                if (slug !== detail.slug) {
                  void patchMeta({ slug });
                }
              }}
            />
          </label>

          <label className="article-field">
            <span>{labels.meta.summary}</span>
            <textarea
              value={summary}
              rows={4}
              onChange={(event) => {
                setSummary(event.target.value);
                latest.current.summary = event.target.value;
                pushEdit();
              }}
            />
          </label>

          <CoverField
            coverAssetId={detail.coverAssetId}
            labels={labels.meta}
            onChoose={() => setCoverPickerOpen(true)}
            onRemove={removeCover}
          />

          <label className="article-field">
            <span>{labels.meta.defaultLocale}</span>
            <select
              value={detail.defaultLocale}
              onChange={(event) => void patchMeta({ defaultLocale: event.target.value })}
            >
              {detail.translations.map((candidate) => (
                <option key={candidate.locale} value={candidate.locale}>
                  {candidate.locale}
                </option>
              ))}
            </select>
            <span className="article-editor-hint">{labels.meta.defaultLocaleHint}</span>
          </label>

          <label className="article-field">
            <span>{labels.meta.category}</span>
            <select
              value={detail.categoryId ?? ""}
              onChange={(event) =>
                void patchMeta({ categoryId: event.target.value === "" ? null : event.target.value })
              }
            >
              <option value="">{labels.meta.noCategory}</option>
              {flatTree.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {`${"—".repeat(depth)}${depth > 0 ? " " : ""}${pickLocalised(
                    node.names,
                    locale,
                    node.slug,
                  )}`}
                </option>
              ))}
            </select>
          </label>

          <div className="article-inline-create">
            <input
              aria-label={labels.meta.newCategoryPlaceholder}
              placeholder={labels.meta.newCategoryPlaceholder}
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <button type="button" onClick={() => void createCategoryInline()}>
              {labels.meta.create}
            </button>
          </div>

          <fieldset className="article-field article-tags">
            <legend>{labels.meta.tags}</legend>
            {tagList.length === 0 ? <p>{labels.meta.noTags}</p> : null}
            {tagList.map((tag) => (
              <label key={tag.id} className="article-tag">
                <input
                  type="checkbox"
                  checked={detail.tags.some((tagged) => tagged.id === tag.id)}
                  onChange={(event) => {
                    const currentIds = detail.tags.map((tagged) => tagged.id);
                    const nextIds = event.target.checked
                      ? [...currentIds, tag.id]
                      : currentIds.filter((id) => id !== tag.id);
                    void patchMeta({ tagIds: nextIds });
                  }}
                />
                <span>{pickLocalised(tag.names, locale, tag.slug)}</span>
              </label>
            ))}
          </fieldset>

          <div className="article-inline-create">
            <input
              aria-label={labels.meta.newTagPlaceholder}
              placeholder={labels.meta.newTagPlaceholder}
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <button type="button" onClick={() => void createTagInline()}>
              {labels.meta.create}
            </button>
          </div>

          <section className="article-publish" aria-label={labels.publish.panel}>
            <h2>{labels.publish.panel}</h2>
            <p className="article-state">
              {labels.state[detail.publicationState]} · {labels.visibility[detail.visibility]}
            </p>
            {detail.publishTime === null ? (
              <p>{labels.publish.notPublished}</p>
            ) : (
              <p>
                {labels.publish.currentPublishTime}:{" "}
                {instantToSiteLocal(new Date(detail.publishTime), siteConfig.timeZone)}
              </p>
            )}
            {detail.visibility === "scheduled" ? <p>{labels.publish.hintScheduled}</p> : null}

            <button
              type="button"
              className="article-publish-primary"
              onClick={() => void postPublication({ action: "publish" })}
            >
              {labels.publish.publishNow}
            </button>

            <label className="article-field">
              <span>{labels.publish.publishTime}</span>
              <input
                type="datetime-local"
                value={publishTimeInput}
                onChange={(event) => setPublishTimeInput(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={publishTimeInput === ""}
              onClick={() =>
                void postPublication({ action: "publish", publishTime: publishTimeInput })
              }
            >
              {labels.publish.schedule}
            </button>

            {detail.publicationState === "archived" ? (
              <button type="button" onClick={() => void postPublication({ action: "unarchive" })}>
                {labels.publish.unarchive}
              </button>
            ) : (
              <button
                type="button"
                disabled={detail.publicationState !== "published"}
                onClick={() => void postPublication({ action: "archive" })}
              >
                {labels.publish.archive}
              </button>
            )}

            {pendingDelete ? (
              <span className="article-delete-confirm">
                <button type="button" onClick={() => void deleteArticle()}>
                  {labels.publish.confirmDelete}
                </button>
                <button type="button" onClick={() => setPendingDelete(false)}>
                  {labels.publish.cancel}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setPendingDelete(true)}>
                {labels.publish.delete}
              </button>
            )}
          </section>
        </aside>
      </div>

      {previewOpen ? (
        <section className="article-preview" aria-label={labels.preview.title}>
          <div className="article-preview-header">
            <h2>{labels.preview.title}</h2>
            <button type="button" onClick={() => setPreviewOpen(false)}>
              {labels.preview.close}
            </button>
          </div>
          {previewBusy ? <p>{labels.preview.loading}</p> : null}
          {previewHtml === null ? null : <ArticleBody html={previewHtml} />}
        </section>
      ) : null}

      <AssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={insertAsset}
        labels={assetLabels}
      />

      <AssetPicker
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        onSelect={chooseCover}
        labels={assetLabels}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}
