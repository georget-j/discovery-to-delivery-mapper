// Message contract between the main thread and workers/parser.worker.ts.
// Kept in its own module so both sides can import the types cleanly.

import type { KnowledgeBaseDocType } from "@/lib/types";
import type { ChunkBlueprint } from "@/lib/kb/chunker";

export const MAX_PARALLEL_PARSE = 3;
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export type ParserRequest =
  | {
      type: "parse";
      jobId: string;
      data: ArrayBuffer;
      mimeType: string;
      ext: string; // lowercased without the leading dot
      name: string;
      docType: KnowledgeBaseDocType;
    }
  | {
      type: "cancel";
      jobId: string;
    };

export type ParserResponse =
  | {
      type: "progress";
      jobId: string;
      progress: number;
      stage: "parsing" | "chunking";
    }
  | {
      type: "result";
      jobId: string;
      chunks: ChunkBlueprint[];
      pageCount?: number;
      sheetCount?: number;
    }
  | {
      type: "error";
      jobId: string;
      message: string;
      recoverable: boolean;
    };

// Type-detection helpers used on the main thread BEFORE sending to the worker.
const SUPPORTED_EXTS: Record<string, KnowledgeBaseDocType> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  csv: "csv",
  txt: "txt",
  md: "md",
  markdown: "md",
  json: "json",
  pptx: "pptx",
};

const REJECTED_EXTS = new Set([
  "doc", // legacy binary Word
  "ppt", // legacy binary PowerPoint
  "pages",
  "key",
  "rtf",
]);

export type DocTypeDetection =
  | { ok: true; docType: KnowledgeBaseDocType; ext: string }
  | { ok: false; reason: string };

export function detectDocType(
  name: string,
  mimeType: string,
): DocTypeDetection {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (REJECTED_EXTS.has(ext)) {
    return {
      ok: false,
      reason: `Unsupported format (.${ext}). Try exporting as PDF.`,
    };
  }
  if (ext in SUPPORTED_EXTS) {
    return { ok: true, docType: SUPPORTED_EXTS[ext], ext };
  }
  // MIME fallback for browsers that drop the extension.
  if (mimeType === "application/pdf")
    return { ok: true, docType: "pdf", ext: "pdf" };
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return { ok: true, docType: "docx", ext: "docx" };
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return { ok: true, docType: "xlsx", ext: "xlsx" };
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return { ok: true, docType: "pptx", ext: "pptx" };
  if (mimeType === "text/csv") return { ok: true, docType: "csv", ext: "csv" };
  if (mimeType.startsWith("text/"))
    return { ok: true, docType: "txt", ext: ext || "txt" };
  if (mimeType === "application/json")
    return { ok: true, docType: "json", ext: "json" };

  return {
    ok: false,
    reason: `Unsupported file type. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, JSON.`,
  };
}
