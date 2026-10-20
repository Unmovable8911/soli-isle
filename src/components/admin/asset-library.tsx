"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails come from our own
   /media route handler; next/image would add an optimizer hop for no gain. */

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

import type { Locale } from "@/config/site";
import {
  formatByteSize,
  formatUploadedAt,
  uploadFailureKey,
  type UploadFailureKey,
} from "@/domain/asset-display";
import type { Messages } from "@/messages";
import type { AssetSummary } from "@/services/assets";

import { EmptyState } from "../empty-state";

export type AssetLabels = Messages["admin"]["assets"];

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/gif";

const UPLOAD_INPUT_ID = "asset-library-upload";

export function thumbAddress(asset: AssetSummary): string | null {
  const thumb = asset.variants.find((variant) => variant.variant === "thumb");
  return thumb?.address ?? null;
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      const { error } = payload as { error?: unknown };
      return typeof error === "string" ? error : null;
    }
  } catch {
    // A non-JSON body carries no code, so the status alone decides the message.
  }
  return null;
}

export type UploadOutcome =
  | { ok: true; asset: AssetSummary }
  | { ok: false; failure: UploadFailureKey };

export async function uploadAssetFile(file: File): Promise<UploadOutcome> {
  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch("/api/admin/assets", { method: "POST", body });
    if (!response.ok) {
      const code = await readErrorCode(response);
      return { ok: false, failure: uploadFailureKey(response.status, code) };
    }
    return { ok: true, asset: (await response.json()) as AssetSummary };
  } catch {
    return { ok: false, failure: "failed" };
  }
}

export async function fetchAssetList(): Promise<AssetSummary[] | null> {
  try {
    const response = await fetch("/api/admin/assets", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { assets?: unknown };
    return Array.isArray(payload.assets) ? (payload.assets as AssetSummary[]) : null;
  } catch {
    return null;
  }
}

const FAILURE_LABEL: Record<UploadFailureKey, keyof AssetLabels["upload"]> = {
  unsupportedType: "errorUnsupportedType",
  tooLarge: "errorTooLarge",
  invalidImage: "errorInvalidImage",
  failed: "errorGeneric",
};

interface UploadRecord {
  key: string;
  fileName: string;
  status: "uploading" | "success" | "error";
  failure: UploadFailureKey | null;
}

export interface AssetLibraryProps {
  assets: AssetSummary[];
  locale: Locale;
  labels: AssetLabels;
}

function shortenContentId(contentId: string): string {
  return contentId.length <= 12 ? contentId : `${contentId.slice(0, 12)}…`;
}

function AssetThumb({ asset }: Readonly<{ asset: AssetSummary }>) {
  const address = thumbAddress(asset);
  if (address === null) {
    return <div className="asset-thumb asset-thumb-missing" />;
  }
  return (
    <img
      className="asset-thumb"
      src={address}
      alt={asset.fileName}
      width={asset.width}
      height={asset.height}
      loading="lazy"
    />
  );
}

function AssetFacts({
  asset,
  locale,
  labels,
}: Readonly<{ asset: AssetSummary; locale: Locale; labels: AssetLabels }>) {
  return (
    <p className="asset-facts">
      <span>
        {labels.list.dimensions}: {asset.width}×{asset.height}
      </span>
      <span>
        {labels.list.size}: {formatByteSize(asset.byteSize)}
      </span>
      <span>
        {labels.list.uploadedAt}: {formatUploadedAt(asset.uploadedAt, locale)}
      </span>
    </p>
  );
}

function AssetReferences({
  asset,
  labels,
}: Readonly<{ asset: AssetSummary; labels: AssetLabels }>) {
  if (asset.references.length === 0) {
    return (
      <p className="asset-refs">
        <span className="asset-badge">{labels.references.none}</span>
      </p>
    );
  }

  return (
    <div className="asset-refs">
      <span className="asset-refs-title">{labels.references.title}:</span>
      <ul className="asset-ref-list">
        {asset.references.map((reference) => (
          <li key={`${reference.contentKind}:${reference.contentId}`}>
            <span className="asset-ref-kind">{reference.contentKind}</span>
            <code className="asset-ref-id" title={reference.contentId}>
              {shortenContentId(reference.contentId)}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssetLibrary({ assets, locale, labels }: AssetLibraryProps) {
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const uploadKeySeq = useRef(0);

  const orphans = assets.filter((asset) => asset.isOrphan);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) {
      return;
    }

    const batch = files.map((file) => {
      uploadKeySeq.current += 1;
      return { key: `upload-${uploadKeySeq.current}`, file };
    });

    setUploads((current) => [
      ...batch.map(({ key, file }) => ({
        key,
        fileName: file.name,
        status: "uploading" as const,
        failure: null,
      })),
      ...current,
    ]);

    let uploaded = false;
    for (const { key, file } of batch) {
      const outcome = await uploadAssetFile(file);
      uploaded = uploaded || outcome.ok;
      setUploads((current) =>
        current.map((record) =>
          record.key === key
            ? {
                ...record,
                status: outcome.ok ? "success" : "error",
                failure: outcome.ok ? null : outcome.failure,
              }
            : record,
        ),
      );
    }

    if (uploaded) {
      router.refresh();
    }
  }

  async function handleDelete(asset: AssetSummary) {
    setPendingDeleteId(null);
    setDeleteNotice(null);
    setDeletingId(asset.id);

    try {
      const response = await fetch(`/api/admin/assets/${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });
      if (response.status === 204) {
        router.refresh();
        return;
      }
      setDeleteNotice(
        response.status === 409 ? labels.orphans.referenced : labels.orphans.deleteFailed,
      );
      if (response.status === 409) {
        router.refresh();
      }
    } catch {
      setDeleteNotice(labels.orphans.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="asset-library">
      <section className="asset-section" id="asset-upload">
        <h2>{labels.upload.label}</h2>
        <p className="asset-hint">{labels.upload.hint}</p>
        <div className="asset-uploader">
          <label htmlFor={UPLOAD_INPUT_ID}>{labels.upload.label}</label>
          <input
            id={UPLOAD_INPUT_ID}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            onChange={handleFiles}
          />
        </div>
        <ul className="asset-upload-list" aria-live="polite">
          {uploads.map((record) => (
            <li key={record.key} className={`asset-upload-item asset-upload-${record.status}`}>
              <span className="asset-upload-name">{record.fileName}</span>
              <span className="asset-upload-status">
                {record.status === "uploading"
                  ? labels.upload.uploading
                  : record.status === "success"
                    ? labels.upload.success
                    : `${labels.upload.failed} — ${labels.upload[FAILURE_LABEL[record.failure ?? "failed"]]}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="asset-section">
        <h2>{labels.list.title}</h2>
        {assets.length === 0 ? (
          <EmptyState title={labels.list.emptyTitle} body={labels.list.empty} />
        ) : (
          <ul className="asset-grid">
            {assets.map((asset) => (
              <li key={asset.id} className="asset-card">
                <AssetThumb asset={asset} />
                <div className="asset-card-body">
                  <p className="asset-file-name">{asset.fileName}</p>
                  <AssetFacts asset={asset} locale={locale} labels={labels} />
                  <AssetReferences asset={asset} labels={labels} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="asset-section">
        <h2>{labels.orphans.title}</h2>
        <p className="asset-hint">{labels.orphans.description}</p>
        <p className="asset-notice" role="status" aria-live="polite">
          {deleteNotice ?? ""}
        </p>
        {orphans.length === 0 ? (
          <EmptyState title={labels.orphans.emptyTitle} body={labels.orphans.empty} />
        ) : (
          <ul className="asset-grid">
            {orphans.map((asset) => (
              <li key={asset.id} className="asset-card">
                <AssetThumb asset={asset} />
                <div className="asset-card-body">
                  <p className="asset-file-name">{asset.fileName}</p>
                  <AssetFacts asset={asset} locale={locale} labels={labels} />
                  <div className="asset-actions">
                    {pendingDeleteId === asset.id ? (
                      <>
                        <button
                          type="button"
                          className="asset-button asset-button-danger"
                          disabled={deletingId === asset.id}
                          onClick={() => void handleDelete(asset)}
                        >
                          {labels.orphans.confirmDelete}
                        </button>
                        <button
                          type="button"
                          className="asset-button"
                          onClick={() => setPendingDeleteId(null)}
                        >
                          {labels.orphans.cancel}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="asset-button"
                        disabled={deletingId !== null}
                        onClick={() => {
                          setDeleteNotice(null);
                          setPendingDeleteId(asset.id);
                        }}
                      >
                        {labels.orphans.delete}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default AssetLibrary;
