"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { siteConfig, type Locale } from "@/config/site";
import { pickLocalised } from "@/domain/localised";
import type { Messages } from "@/messages";
import type { CategoryNode } from "@/services/categories";

import { categoryDeleteNotice, type CategoryLabels } from "./catalogue-notices";
import { ConfirmDialog } from "./confirm-dialog";

export type LocaleNames = Messages["chrome"]["localeNames"];

export interface CategoryManagerProps {
  tree: CategoryNode[];
  locale: Locale;
  labels: CategoryLabels;
  localeNames: LocaleNames;
}

interface FlatCategory {
  id: string;
  path: string;
  depth: number;
}

/** The tree as an ordered list, which is what a parent `select` needs. */
export function flattenCategories(nodes: readonly CategoryNode[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { id: node.id, path: node.path, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

const INDENT = "\u00a0\u00a0\u00a0";

/** Every Category the given one cannot move under: itself and its subtree. */
export function forbiddenParents(node: CategoryNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of forbiddenParents(child)) {
      ids.add(id);
    }
  }
  return ids;
}

function optionLabel(category: FlatCategory): string {
  return `${INDENT.repeat(category.depth)}${category.path}`;
}

/**
 * The Category tree: create, rename per Locale, re-parent, reorder and delete.
 * Every control is a native form control, and the moves are buttons rather
 * than drag handles, so the whole tree is operable from the keyboard.
 */
export function CategoryManager({ tree, locale, labels, localeNames }: CategoryManagerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
  const [articlesTo, setArticlesTo] = useState("");
  const nameId = useId();
  const slugId = useId();
  const createParentId = useId();
  const moveToId = useId();
  const flat = flattenCategories(tree);

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

  function patch(id: string, body: unknown, failure: string): Promise<boolean> {
    return write(
      `/api/admin/categories/${id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      failure,
    );
  }

  function createCategory(form: FormData): void {
    const parent = form.get("parentId");
    const slug = form.get("slug");
    void write(
      "/api/admin/categories",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          name: String(form.get("name") ?? ""),
          parentId: parent === "" || parent === null ? null : String(parent),
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

    const query = articlesTo.length === 0 ? "" : `?moveArticlesTo=${encodeURIComponent(articlesTo)}`;
    setArticlesTo("");
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/categories/${target.id}${query}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setNotice(categoryDeleteNotice(labels, await response.json().catch(() => null)));
        return;
      }
      router.refresh();
    } catch {
      setNotice(labels.delete.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="category-manager">
      {notice === null ? null : (
        <p role="alert" className="article-error">
          {notice}
        </p>
      )}

      <section
        className="category-create"
        id="category-create"
        aria-labelledby={`${nameId}-heading`}
      >
        <h2 id={`${nameId}-heading`}>{labels.create.title}</h2>
        <form
          className="category-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            event.currentTarget.reset();
            createCategory(form);
          }}
        >
          <label htmlFor={nameId}>{labels.create.name}</label>
          <input id={nameId} name="name" required aria-describedby={`${nameId}-hint`} />
          <p className="category-hint" id={`${nameId}-hint`}>
            {labels.create.nameHint}
          </p>

          <label htmlFor={slugId}>{labels.create.slug}</label>
          <input id={slugId} name="slug" />

          <label htmlFor={createParentId}>{labels.create.parent}</label>
          <select id={createParentId} name="parentId" defaultValue="">
            <option value="">{labels.create.root}</option>
            {flat.map((category) => (
              <option key={category.id} value={category.id}>
                {optionLabel(category)}
              </option>
            ))}
          </select>

          <button type="submit" disabled={busy}>
            {busy ? labels.create.creating : labels.create.submit}
          </button>
        </form>
      </section>

      {tree.length === 0 ? (
        <p className="article-empty">{labels.empty}</p>
      ) : (
        <CategoryTree
          tree={tree}
          locale={locale}
          labels={labels}
          localeNames={localeNames}
          flat={flat}
          busy={busy}
          onPatch={patch}
          onDelete={setDeleteTarget}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={labels.delete.title}
        body={labels.delete.body}
        confirmLabel={labels.delete.confirm}
        cancelLabel={labels.delete.cancel}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setDeleteTarget(null);
          setArticlesTo("");
        }}
      >
        <p>
          <label htmlFor={moveToId}>{labels.delete.articlesTo}</label>
        </p>
        <select
          id={moveToId}
          value={articlesTo}
          onChange={(event) => setArticlesTo(event.currentTarget.value)}
        >
          <option value="">{labels.delete.choose}</option>
          {flat
            .filter((category) => category.id !== deleteTarget?.id)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {optionLabel(category)}
              </option>
            ))}
        </select>
      </ConfirmDialog>
    </div>
  );
}

export interface CategoryTreeProps {
  tree: CategoryNode[];
  locale: Locale;
  labels: CategoryLabels;
  localeNames: LocaleNames;
  flat: FlatCategory[];
  busy: boolean;
  onPatch: (id: string, body: unknown, failure: string) => Promise<boolean>;
  onDelete: (node: CategoryNode) => void;
}

/**
 * The tree itself, free of browser state so it can be asserted on rendered
 * output. Children are nested under their parent — never a flat list.
 */
export function CategoryTree(props: CategoryTreeProps) {
  return (
    <ul className="category-tree">
      {props.tree.map((node) => (
        <CategoryItem
          key={node.id}
          node={node}
          locale={props.locale}
          labels={props.labels}
          localeNames={props.localeNames}
          flat={props.flat}
          busy={props.busy}
          onPatch={props.onPatch}
          onDelete={props.onDelete}
        />
      ))}
    </ul>
  );
}

interface CategoryItemProps {
  node: CategoryNode;
  locale: Locale;
  labels: CategoryLabels;
  localeNames: LocaleNames;
  flat: FlatCategory[];
  busy: boolean;
  onPatch: (id: string, body: unknown, failure: string) => Promise<boolean>;
  onDelete: (node: CategoryNode) => void;
}

function CategoryItem({
  node,
  locale,
  labels,
  localeNames,
  flat,
  busy,
  onPatch,
  onDelete,
}: CategoryItemProps) {
  const baseId = useId();
  const parentSelectId = `${baseId}-parent`;
  const forbidden = forbiddenParents(node);

  return (
    <li className="category-node">
      <div className="category-node-row">
        <span className="category-node-name">{pickLocalised(node.names, locale, node.slug)}</span>{" "}
        <code className="category-node-path">{node.path}</code>
      </div>

      <details className="category-node-editor">
        <summary>{labels.node.edit}</summary>

        {siteConfig.locales.map((entry) => (
          <form
            key={entry}
            className="category-name-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("name");
              void onPatch(
                node.id,
                { action: "rename", locale: entry, name: String(value ?? "") },
                labels.node.renameFailed,
              );
            }}
          >
            <label htmlFor={`${baseId}-${entry}`}>
              {labels.node.names} · {localeNames[entry]}
            </label>
            <input
              id={`${baseId}-${entry}`}
              name="name"
              defaultValue={node.names[entry] ?? ""}
              placeholder={node.slug}
            />
            <button type="submit" disabled={busy}>
              {labels.node.save}
            </button>
          </form>
        ))}

        <form
          className="category-move-form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("parentId");
            void onPatch(
              node.id,
              { action: "move", parentId: value === "" ? null : String(value) },
              labels.node.moveFailed,
            );
          }}
        >
          <label htmlFor={parentSelectId}>{labels.node.parent}</label>
          <select id={parentSelectId} name="parentId" defaultValue={node.parentId ?? ""}>
            <option value="">{labels.node.root}</option>
            {flat
              .filter((category) => !forbidden.has(category.id))
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {optionLabel(category)}
                </option>
              ))}
          </select>
          <button type="submit" disabled={busy}>
            {labels.node.move}
          </button>
        </form>

        <div className="category-node-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onPatch(
                node.id,
                { action: "reorder", direction: "up" },
                labels.node.reorderFailed,
              )
            }
          >
            {labels.node.up}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onPatch(
                node.id,
                { action: "reorder", direction: "down" },
                labels.node.reorderFailed,
              )
            }
          >
            {labels.node.down}
          </button>
          <button type="button" disabled={busy} onClick={() => onDelete(node)}>
            {labels.node.delete}
          </button>
        </div>
      </details>

      {node.children.length === 0 ? null : (
        <ul className="category-tree">
          {node.children.map((child) => (
            <CategoryItem
              key={child.id}
              node={child}
              locale={locale}
              labels={labels}
              localeNames={localeNames}
              flat={flat}
              busy={busy}
              onPatch={onPatch}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
