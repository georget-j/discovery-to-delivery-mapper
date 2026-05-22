// Render a PDF's pages to PNG data-URLs and POST them to /api/vision/describe.
// The returned descriptions get added to the KB as a new "vision" doc — same
// pipeline as plain-text upload, just sourced from a different surface.

const MAX_PAGES_PER_RUN = 8;
const RENDER_SCALE = 1.4; // smaller than OCR (we don't need pixel-perfect text)

export type VisionDescribeResult = {
  pageCount: number;
  descriptions: { page: number; text: string }[];
};

export async function describePdfPages(
  file: File | Blob,
  opts: { onProgress?: (done: number, total: number) => void } = {},
): Promise<VisionDescribeResult> {
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
      /* read-only */
    }
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsMod.getDocument({ data, isEvalSupported: false })
    .promise;
  const cap = Math.min(doc.numPages, MAX_PAGES_PER_RUN);

  const images: { id: string; dataUrl: string; label: string }[] = [];
  for (let p = 1; p <= cap; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable for vision pass");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push({
      id: `p${p}`,
      dataUrl: canvas.toDataURL("image/png"),
      label: `Page ${p}`,
    });
    opts.onProgress?.(p, cap);
  }

  const res = await fetch("/api/vision/describe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  const data2 = await res.json();
  if (data2.error || !Array.isArray(data2.descriptions)) {
    throw new Error(data2.message ?? data2.error ?? "Vision call failed");
  }
  const descriptions: { page: number; text: string }[] = data2.descriptions.map(
    (d: { id: string; text: string }) => {
      const page = Number(d.id.replace(/^p/, "")) || 0;
      return { page, text: d.text };
    },
  );
  return { pageCount: cap, descriptions };
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => {
      width: number;
      height: number;
    };
    render: (opts: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
      canvas: HTMLCanvasElement;
    }) => { promise: Promise<void> };
  }>;
};
