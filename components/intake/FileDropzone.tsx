"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

// Shared with IntakeQueue's per-row Re-upload picker.
export const ACCEPT_ATTR = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
  ".md",
  ".json",
  ".pptx",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/json",
].join(",");

export function FileDropzone({ onFiles, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const collectFiles = useCallback(
    async (dt: DataTransferItemList | FileList | null) => {
      if (!dt) return;
      // FileList path (input element).
      if (dt instanceof FileList) {
        return Array.from(dt);
      }
      // DataTransferItemList — may contain entries (for folders).
      const out: File[] = [];
      const items = Array.from(dt) as DataTransferItem[];
      for (const item of items) {
        if (typeof item.webkitGetAsEntry === "function") {
          const entry = item.webkitGetAsEntry();
          if (entry?.isDirectory) {
            await traverseEntry(entry, out);
            continue;
          }
        }
        const f = item.getAsFile();
        if (f) out.push(f);
      }
      return out;
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files =
        (await collectFiles(e.dataTransfer.items)) ??
        Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [collectFiles, disabled, onFiles],
  );

  const handlePicker = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      onFiles(Array.from(files));
      // Reset so picking the same file again re-fires onChange.
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      aria-disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/10 hover:bg-muted/20",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <div className="text-3xl" aria-hidden>
        📎
      </div>
      <p className="text-sm font-medium">Drop files here, or click to browse</p>
      <p className="text-xs text-muted-foreground">
        PDF · DOCX · XLSX · PPTX · CSV · TXT · MD · JSON · Max 20 MB · Up to 10
        files
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={handlePicker}
        className="sr-only"
        disabled={disabled}
      />
    </div>
  );
}

// ── Folder traversal (webkitGetAsEntry) ───────────────────────────────────

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (f: File) => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: FsEntry[]) => void) => void;
  };
};

async function traverseEntry(entry: FsEntry, out: File[]): Promise<void> {
  if (entry.isFile && typeof entry.file === "function") {
    await new Promise<void>((resolve) => {
      entry.file?.((f) => {
        out.push(f);
        resolve();
      });
    });
    return;
  }
  if (entry.isDirectory && typeof entry.createReader === "function") {
    const reader = entry.createReader();
    let done = false;
    while (!done) {
      const children = await new Promise<FsEntry[]>((resolve) =>
        reader.readEntries((entries) => resolve(entries)),
      );
      if (children.length === 0) {
        done = true;
        break;
      }
      for (const child of children) {
        await traverseEntry(child, out);
        if (out.length >= 40) return; // safety cap, surfaced by enqueue rule
      }
    }
  }
}
