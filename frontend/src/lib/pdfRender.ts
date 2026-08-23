/**
 * Shared client-side PDF page renderer (pdfjs-dist) for the interactive
 * tools (Sign, Redact, Compare). Renders every page to a canvas.
 *
 * Coordinate contract: canvases are rendered at `scale`× the PDF's point
 * size, so `canvasPx / scale` converts back to PDF points (pdf-lib's unit).
 */

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** Page size in PDF points (pdf-lib units). */
  widthPts: number;
  heightPts: number;
}

let workerConfigured = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPdfjs(): Promise<any> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
  return pdfjsLib;
}

export interface RenderResult {
  pages: RenderedPage[];
  /** Real page count in the document (may exceed pages.length when capped). */
  totalPages: number;
}

export async function renderPdfToCanvases(
  bytes: ArrayBuffer,
  scale = 1.5,
  onProgress?: (done: number, total: number) => void,
  maxPages = 100
): Promise<RenderResult> {
  const pdfjsLib = await getPdfjs();
  // pdfjs transfers (detaches) the buffer it receives — hand it a copy so the
  // caller's ArrayBuffer stays usable (pdf-lib needs it again later).
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const base = page.getViewport({ scale: 1 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    pages.push({ canvas, widthPts: base.width, heightPts: base.height });
    onProgress?.(i, total);
  }

  const totalPages = pdf.numPages;
  // pdfjs v6: document cleanup moved off the proxy — call it if present.
  try { await pdf.cleanup?.(); } catch { /* non-fatal */ }
  return { pages, totalPages };
}

/** Reads a File into an ArrayBuffer. */
export const fileToArrayBuffer = (f: File): Promise<ArrayBuffer> => f.arrayBuffer();

/** Triggers a browser download of raw bytes. */
export function downloadBytes(bytes: Uint8Array | ArrayBuffer, filename: string, mime = "application/pdf") {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
