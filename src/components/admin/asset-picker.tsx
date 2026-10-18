"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails come from our own
   /media route handler; next/image would add an optimizer hop for no gain. */

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { formatByteSize } from "@/domain/asset-display";
import type { AssetSummary } from "@/services/assets";

import {
  ACCEPTED_IMAGE_TYPES,
  fetchAssetList,
  thumbAddress,
  uploadAssetFile,
  type AssetLabels,
} from "./asset-library";

export interface AssetPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: AssetSummary) => void;
  labels: AssetLabels;
}

type UploadStatus = { fileName: string; failed: boolean } | null;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function AssetPicker({ open, onClose, onSelect, labels }: AssetPickerProps) {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<Element | null>(null);
  const uploadInputId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    restoreFocusRef.current = document.activeElement;
    setAssets(null);
    setLoadFailed(false);
    setUploadStatus(null);
    dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void fetchAssetList().then((list) => {
      if (cancelled) {
        return;
      }
      if (list === null) {
        setLoadFailed(true);
        return;
      }
      setAssets(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, reloadToken]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const dialog = dialogRef.current;
      if (dialog === null) {
        return;
      }
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      return;
    }
    const previous = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (previous instanceof HTMLElement && previous.isConnected) {
      previous.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleSelect(asset: AssetSummary) {
    onSelect(asset);
    onClose();
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) {
      return;
    }

    setUploadStatus({ fileName: file.name, failed: false });
    const outcome = await uploadAssetFile(file);
    if (outcome.ok) {
      setUploadStatus(null);
      setReloadToken((token) => token + 1);
      return;
    }
    setUploadStatus({ fileName: file.name, failed: true });
  }

  return (
    <div className="asset-picker-backdrop">
      <div
        className="asset-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="asset-picker-header">
          <h2 id={titleId}>{labels.picker.title}</h2>
          <button type="button" className="asset-button" onClick={onClose}>
            {labels.picker.close}
          </button>
        </div>

        <div className="asset-uploader">
          <label htmlFor={uploadInputId}>{labels.upload.label}</label>
          <input
            id={uploadInputId}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            onChange={handleFiles}
          />
        </div>

        <p className="asset-notice" role="status" aria-live="polite">
          {uploadStatus === null
            ? ""
            : uploadStatus.failed
              ? `${labels.picker.uploadFailed} — ${uploadStatus.fileName}`
              : `${labels.picker.uploading} — ${uploadStatus.fileName}`}
        </p>

        {loadFailed ? (
          <p className="asset-notice" role="alert">
            {labels.picker.loadFailed}
          </p>
        ) : assets === null ? (
          <p aria-live="polite">{labels.picker.loading}</p>
        ) : assets.length === 0 ? (
          <p className="asset-empty">{labels.picker.empty}</p>
        ) : (
          <ul className="asset-grid asset-picker-grid">
            {assets.map((asset) => {
              const address = thumbAddress(asset);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="asset-pick-button"
                    onClick={() => handleSelect(asset)}
                    title={labels.picker.select}
                  >
                    {address === null ? (
                      <span className="asset-thumb asset-thumb-missing" />
                    ) : (
                      <img
                        className="asset-thumb"
                        src={address}
                        alt=""
                        width={asset.width}
                        height={asset.height}
                        loading="lazy"
                      />
                    )}
                    <span className="asset-file-name">{asset.fileName}</span>
                    <span className="asset-facts">
                      {asset.width}×{asset.height} · {formatByteSize(asset.byteSize)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AssetPicker;
