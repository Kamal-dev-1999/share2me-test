import type { ExtractedTextItem } from "../types";

let workerConfigured = false;

async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
  return pdfjsLib;
}

/**
 * Extracts text items from PDF pages using PDF.js text layer APIs.
 */
export async function extractTextItemsFromPdf(
  pdfBuffer: ArrayBuffer,
  maxPages = 100
): Promise<ExtractedTextItem[]> {
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const items: ExtractedTextItem[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    for (let j = 0; j < textContent.items.length; j++) {
      const item = textContent.items[j] as any;
      if (!item.str || !item.str.trim()) continue;

      const transform = item.transform; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const tx = transform[4];
      const ty = transform[5];
      const fontHeight = Math.abs(transform[3] || transform[0] || 12);

      // PDF coordinate system (0,0 at bottom-left) -> Viewport screen fraction (0,0 at top-left)
      const xFrac = Math.max(0, Math.min(1, tx / viewport.width));
      const yFrac = Math.max(0, Math.min(1, (viewport.height - ty - fontHeight) / viewport.height));
      const wFrac = Math.max(0.02, Math.min(1 - xFrac, (item.width || item.str.length * fontHeight * 0.5) / viewport.width));
      const hFrac = Math.max(0.01, Math.min(1 - yFrac, (fontHeight * 1.2) / viewport.height));

      items.push({
        id: `extracted-${i - 1}-${j}-${Date.now()}`,
        pageIndex: i - 1,
        text: item.str,
        xFrac,
        yFrac,
        wFrac,
        hFrac,
        fontSize: Math.round(fontHeight),
        fontName: item.fontName || "Helvetica",
        color: "#000000",
      });
    }
  }

  try {
    await pdf.cleanup?.();
  } catch {
    // Non-fatal
  }

  return items;
}
