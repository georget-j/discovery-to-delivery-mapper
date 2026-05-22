/// <reference lib="webworker" />
// Web worker that parses uploaded documents off the main thread. Each file
// type's heavy library is dynamically imported on-demand so we don't bundle
// pdfjs / mammoth / xlsx into the main page chunk.
//
// Lifecycle:
//   1. Main thread posts { type: "parse", jobId, data, mimeType, ext, docType, name }
//   2. Worker emits { type: "progress", jobId, progress, stage } updates while
//      it walks pages / sheets.
//   3. Worker emits { type: "result", jobId, chunks } or { type: "error", jobId,
//      message, recoverable } when done.
//   4. Main thread can post { type: "cancel", jobId } at any time — the worker
//      flips an in-memory cancellation flag and bails on the next checkpoint.

import { chunkSources, chunkText } from "@/lib/kb/chunker";
import type { ParserRequest, ParserResponse } from "@/lib/kb/parser-protocol";

declare const self: DedicatedWorkerGlobalScope;

// Lightweight structural type for what we use from pdfjs's documentProxy.
// Keeps us out of the upstream type weeds.
type PdfDocumentProxy = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: { str: string }[] }>;
  }>;
};

const cancelled = new Set<string>();

function isCancelled(jobId: string): boolean {
  return cancelled.has(jobId);
}

function post(msg: ParserResponse) {
  self.postMessage(msg);
}

self.addEventListener("message", async (event: MessageEvent<ParserRequest>) => {
  const msg = event.data;
  if (msg.type === "cancel") {
    cancelled.add(msg.jobId);
    return;
  }
  if (msg.type !== "parse") return;

  const { jobId, data, ext, docType, name } = msg;
  try {
    switch (docType) {
      case "pdf":
        await handlePdf(jobId, data);
        break;
      case "docx":
        await handleDocx(jobId, data);
        break;
      case "xlsx":
      case "csv":
        await handleSpreadsheet(jobId, data, docType);
        break;
      case "json":
        handleJson(jobId, data, name);
        break;
      case "txt":
      case "md":
      default:
        handlePlainText(jobId, data);
        break;
    }
  } catch (err) {
    if (!isCancelled(jobId)) {
      post({
        type: "error",
        jobId,
        message: err instanceof Error ? err.message : "Unknown parse error",
        recoverable: true,
      });
    }
    cancelled.delete(jobId);
  }
});

// ── PDF ───────────────────────────────────────────────────────────────────

async function handlePdf(jobId: string, data: ArrayBuffer): Promise<void> {
  // Lazy-load pdfjs in the worker. The legacy entry is the most reliable in
  // worker contexts; the modern build expects a window.
  const pdfjs =
    (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
      getDocument: (opts: { data: Uint8Array; isEvalSupported?: boolean }) => {
        promise: Promise<PdfDocumentProxy>;
      };
      GlobalWorkerOptions?: { workerSrc: string };
    };

  // Disable the inner PDF.js worker (we ARE the worker; nesting another one
  // breaks in some browsers). Synchronous decoding is fine for our doc sizes.
  if (pdfjs.GlobalWorkerOptions) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    } catch {
      /* noop — fields are read-only in some versions */
    }
  }

  let doc: PdfDocumentProxy;
  try {
    const task = pdfjs.getDocument({
      data: new Uint8Array(data),
      isEvalSupported: false,
    });
    doc = await task.promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message)) {
      post({
        type: "error",
        jobId,
        message:
          "This PDF is password-protected. Remove the password and re-upload.",
        recoverable: false,
      });
      return;
    }
    post({
      type: "error",
      jobId,
      message: `Couldn't open PDF: ${message}`,
      recoverable: true,
    });
    return;
  }

  const pageCount = doc.numPages;
  const sources: { text: string; page: number }[] = [];
  let imageOnlyPages = 0;

  for (let p = 1; p <= pageCount; p++) {
    if (isCancelled(jobId)) {
      cancelled.delete(jobId);
      return;
    }
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = (content.items as { str: string }[])
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length === 0) imageOnlyPages++;
    else sources.push({ text, page: p });

    post({
      type: "progress",
      jobId,
      progress: p / pageCount,
      stage: "parsing",
    });
  }

  if (imageOnlyPages === pageCount) {
    post({
      type: "error",
      jobId,
      message:
        "This PDF appears to be a scanned image. OCR isn't supported — try a text-based PDF.",
      recoverable: false,
    });
    return;
  }

  post({ type: "progress", jobId, progress: 0, stage: "chunking" });
  const chunks = chunkSources(sources);
  post({ type: "result", jobId, chunks, pageCount });
}

// ── DOCX ──────────────────────────────────────────────────────────────────

async function handleDocx(jobId: string, data: ArrayBuffer): Promise<void> {
  // Mammoth's browser build is shaped as { extractRawText }.
  // The named import differs between versions; tolerate both.
  const mammothMod = (await import("mammoth/mammoth.browser")) as {
    extractRawText: (opts: {
      arrayBuffer: ArrayBuffer;
    }) => Promise<{ value: string }>;
  };

  post({ type: "progress", jobId, progress: 0.3, stage: "parsing" });
  let value = "";
  try {
    const out = await mammothMod.extractRawText({ arrayBuffer: data });
    value = out.value ?? "";
  } catch (err) {
    post({
      type: "error",
      jobId,
      message: `Couldn't parse DOCX: ${err instanceof Error ? err.message : String(err)}`,
      recoverable: true,
    });
    return;
  }

  if (value.trim().length < 20) {
    post({
      type: "error",
      jobId,
      message: "No readable text found in this DOCX.",
      recoverable: false,
    });
    return;
  }

  post({ type: "progress", jobId, progress: 0.8, stage: "chunking" });
  const chunks = chunkText(value);
  post({ type: "result", jobId, chunks });
}

// ── XLSX / CSV ────────────────────────────────────────────────────────────

async function handleSpreadsheet(
  jobId: string,
  data: ArrayBuffer,
  docType: "xlsx" | "csv",
): Promise<void> {
  const xlsx = await import("xlsx");
  let wb;
  try {
    wb = xlsx.read(new Uint8Array(data), { type: "array", cellDates: true });
  } catch (err) {
    post({
      type: "error",
      jobId,
      message: `Couldn't parse ${docType.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`,
      recoverable: true,
    });
    return;
  }

  const sheetNames = wb.SheetNames;
  const sources: { text: string; sheet?: string; rangeRef?: string }[] = [];

  for (let i = 0; i < sheetNames.length; i++) {
    if (isCancelled(jobId)) {
      cancelled.delete(jobId);
      return;
    }
    const sheetName = sheetNames[i];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const range = sheet["!ref"] ?? "";
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      blankrows: false,
    });
    if (rows.length === 0) continue;

    // Headers come from the keys of the first row; format each row as
    //   Col1: value1 | Col2: value2
    // so the LLM has column context per row.
    const formatted = rows
      .map((row) =>
        Object.entries(row)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | "),
      )
      .join("\n");

    const ROWS_PER_SLICE = 200;
    if (rows.length <= ROWS_PER_SLICE) {
      sources.push({
        text: formatted,
        sheet: sheetName,
        rangeRef: range || undefined,
      });
    } else {
      // Slice large sheets into row-range chunks so each chunk references
      // a manageable portion (and so a single sheet doesn't dominate retrieval).
      for (let start = 0; start < rows.length; start += ROWS_PER_SLICE) {
        const slice = rows.slice(start, start + ROWS_PER_SLICE);
        const sliceText = slice
          .map((row) =>
            Object.entries(row)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" | "),
          )
          .join("\n");
        sources.push({
          text: sliceText,
          sheet: sheetName,
          rangeRef: `rows ${start + 1}-${start + slice.length}`,
        });
      }
    }

    post({
      type: "progress",
      jobId,
      progress: (i + 1) / sheetNames.length,
      stage: "parsing",
    });
  }

  if (sources.length === 0) {
    post({
      type: "error",
      jobId,
      message: "Spreadsheet appears to be empty.",
      recoverable: false,
    });
    return;
  }

  post({ type: "progress", jobId, progress: 0, stage: "chunking" });
  const chunks = chunkSources(sources);
  post({
    type: "result",
    jobId,
    chunks,
    sheetCount: sheetNames.length,
  });
}

// ── JSON ──────────────────────────────────────────────────────────────────

function handleJson(jobId: string, data: ArrayBuffer, name: string): void {
  const decoder = new TextDecoder("utf-8");
  const raw = decoder.decode(data);
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // Fall back to raw — JSON parse failures shouldn't kill ingestion.
    formatted = raw;
  }
  if (formatted.trim().length === 0) {
    post({
      type: "error",
      jobId,
      message: `${name} is empty.`,
      recoverable: false,
    });
    return;
  }
  post({ type: "progress", jobId, progress: 1, stage: "chunking" });
  const chunks = chunkText(formatted);
  post({ type: "result", jobId, chunks });
}

// ── Plain text / Markdown ────────────────────────────────────────────────

function handlePlainText(jobId: string, data: ArrayBuffer): void {
  const decoder = new TextDecoder("utf-8");
  const text = decoder.decode(data);
  if (text.trim().length === 0) {
    post({
      type: "error",
      jobId,
      message: "File is empty.",
      recoverable: false,
    });
    return;
  }
  post({ type: "progress", jobId, progress: 1, stage: "chunking" });
  const chunks = chunkText(text);
  post({ type: "result", jobId, chunks });
}

export {};
