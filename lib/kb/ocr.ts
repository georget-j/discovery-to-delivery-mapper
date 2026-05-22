// OCR for scanned PDFs. Lazy-loads tesseract.js and pdfjs (the latter is
// already a dep used in the parser worker but we re-import on the main
// thread here since canvas rendering needs `document` / `OffscreenCanvas`).
//
// This is opt-in per file because Tesseract is heavy (~5 MB on first
// load) and slow (~5-10 s per page). The intake queue surfaces a "Run
// OCR" action on rows that failed with the scanned-image error.

import { chunkSources } from "./chunker";
import type { ChunkBlueprint } from "./chunker";

export type OcrOptions = {
  langs?: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
};

export type OcrResult = {
  chunks: ChunkBlueprint[];
  pageCount: number;
};

export async function ocrPdf(
  file: File | Blob,
  opts: OcrOptions = {},
): Promise<OcrResult> {
  const { langs = "eng", onProgress, signal } = opts;
  if (signal?.aborted) throw new Error("OCR cancelled");

  // pdfjs in main thread so we can render to canvas.
  const pdfjsMod =
    (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
      getDocument: (opts: { data: Uint8Array; isEvalSupported?: boolean }) => {
        promise: Promise<PdfDoc>;
      };
      GlobalWorkerOptions?: { workerSrc: string };
    };
  if (pdfjsMod.GlobalWorkerOptions) {
    try {
      pdfjsMod.GlobalWorkerOptions.workerSrc = "";
    } catch {
      /* read-only on some builds */
    }
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsMod.getDocument({ data, isEvalSupported: false })
    .promise;
  const pageCount = doc.numPages;

  // tesseract.js dynamic import.
  const tessMod =
    (await import("tesseract.js")) as unknown as typeof import("tesseract.js");
  const sources: { text: string; page: number }[] = [];

  for (let p = 1; p <= pageCount; p++) {
    if (signal?.aborted) throw new Error("OCR cancelled");
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(viewport.width, viewport.height)
        : Object.assign(document.createElement("canvas"), {
            width: viewport.width,
            height: viewport.height,
          });
    const ctx = (canvas as HTMLCanvasElement).getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable for OCR");
    }
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const ocr = await tessMod.recognize(canvas as unknown as ImageLike, langs, {
      logger: () => {
        /* swallow internal logger noise */
      },
    });
    const text = (ocr.data.text ?? "").replace(/\s+/g, " ").trim();
    if (text.length > 0) sources.push({ text, page: p });

    onProgress?.(p, pageCount);
  }

  return {
    pageCount,
    chunks: chunkSources(sources),
  };
}

// Local shapes — tesseract.js types are heavy, this keeps imports light.
type ImageLike = HTMLCanvasElement | OffscreenCanvas | Blob | string;
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => {
      width: number;
      height: number;
    };
    render: (opts: {
      canvasContext:
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D;
      viewport: { width: number; height: number };
      canvas: HTMLCanvasElement | OffscreenCanvas;
    }) => { promise: Promise<void> };
  }>;
};
