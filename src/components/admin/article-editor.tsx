"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { articleConfig } from "@/config/article";
import { siteConfig, type Locale } from "@/config/site";
import { pickLocalised } from "@/domain/localised";
import { EMPTY_DOCUMENT } from "@/domain/rich-text";
import { instantToSiteLocal } from "@/domain/site-time";
import { articleExtensions } from "@/editor/extensions";
import { looksLikeMarkdown, parseMarkdown } from "@/editor/markdown";
import type { Messages } from "@/messages";
import type { ArticleDetail } from "@/services/articles";
import type { CategoryNode } from "@/services/categories";
import type { TagView } from "@/services/tags";
import type { AssetSummary } from "@/services/assets";

import { ArticleBody } from "../article-body";
import { AssetPicker } from "./asset-picker";
import type { AssetLabels } from "./asset-library";
import { clearLocalDraft, saveLocalDraft } from "./article-local-store";
import { createSlashCommand, createSlashItems } from "./slash-menu";

export type ArticleLabels = Messages["admin"]["articles"];

type SaveStatus = "idle" | "saving" | "saved" | "local" | "error";

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

function flattenTree(nodes: CategoryNode[], depth = 0): Array<{ node: CategoryNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
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
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
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
  const lastServerSave = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const sendSave = useCallback(async () => {
    const snapshot = latest.current;
    setStatus("saving");
    try {
      const response = await fetch(
        `/api/admin/articles/${article.id}/translations/${snapshot.locale}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: snapshot.title,
            summary: snapshot.summary,
            bodyJson: snapshot.bodyJson,
          }),
        },
      );
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const payload = (await response.json()) as { article: ArticleDetail };
      setDetail(payload.article);
      lastServerSave.current = Date.now();
      setStatus("saved");
      await clearLocalDraft(article.id, snapshot.locale);
      // The service throttles this to one automatic snapshot per window.
      void fetch(`/api/admin/articles/${article.id}/revisions`, { method: "POST" });
    } catch {
      setStatus("error");
    }
  }, [article.id]);

  const queueSave = useCallback(() => {
    const snapshot = latest.current;
    setStatus("local");
    void saveLocalDraft({
      articleId: article.id,
      locale: snapshot.locale,
      title: snapshot.title,
      summary: snapshot.summary,
      bodyJson: snapshot.bodyJson,
      savedAt: new Date().toISOString(),
    });

    const wait = Math.max(
      0,
      articleConfig.autosaveThrottleMs - (Date.now() - lastServerSave.current),
    );
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      void sendSave();
    }, wait);
  }, [article.id, sendSave]);

  const slashItems = useRef(createSlashItems(labels.slash, { onInsertImage: () => setPickerOpen(true) }));

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
      queueSave();
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  function switchLocale(next: Locale) {
    const target = detail.translations.find((candidate) => candidate.locale === next);
    setActiveLocale(next);
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
    editor?.commands.setContent(JSON.parse(created?.bodyJson ?? EMPTY_DOCUMENT) as JSONContent, {
      emitUpdate: false,
    });
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
        alt: asset.fileName,
        width: asset.width,
        height: asset.height,
      })
      .run();
    setPickerOpen(false);
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
    status === "saving"
      ? labels.saving
      : status === "saved"
        ? labels.saved
        : status === "local"
          ? labels.localSave
          : status === "error"
            ? labels.saveFailed
            : "";

  return (
    <div className="article-editor">
      <div className="article-editor-header">
        <Link href="/admin/articles">{labels.backToList}</Link>
        <span aria-live="polite" className={`article-save article-save-${status}`}>
          {statusLabel}
        </span>
        <button type="button" onClick={() => void openPreview()}>
          {labels.preview.open}
        </button>
      </div>

      {error === null ? null : (
        <p role="alert" className="article-error">
          {error}
        </p>
      )}

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
        ) : null}
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
              queueSave();
            }}
          />

          <div className="article-editor-content">
            <EditorContent editor={editor} />
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
                queueSave();
              }}
            />
          </label>

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

            <button type="button" onClick={() => void postPublication({ action: "publish" })}>
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
