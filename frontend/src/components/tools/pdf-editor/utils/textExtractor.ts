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

interface RawTextChunk {
  str: string;
  tx: number;
  ty: number;
  width: number;
  fontHeight: number;
  fontName: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Resolves PDF.js / PostScript font names into clean CSS web font family stacks.
 */
export function resolvePdfFontFamily(rawFontName: string): string {
  if (!rawFontName) return '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const f = rawFontName.toLowerCase();

  if (f.includes("times") || f.includes("serif") || f.includes("cambria") || f.includes("georgia") || f.includes("garamond")) {
    if (f.includes("georgia")) return "Georgia, serif";
    if (f.includes("garamond")) return "Garamond, Baskerville, serif";
    if (f.includes("cambria")) return "Cambria, Georgia, serif";
    return '"Times New Roman", Times, serif';
  }
  if (f.includes("courier") || f.includes("mono") || f.includes("code") || f.includes("consolas")) {
    if (f.includes("consolas")) return "Consolas, monospace";
    return '"Courier New", Courier, monospace';
  }
  if (f.includes("calibri")) return 'Calibri, "Liberation Sans", Arial, sans-serif';
  if (f.includes("verdana")) return 'Verdana, Geneva, sans-serif';
  if (f.includes("trebuchet")) return '"Trebuchet MS", sans-serif';
  if (f.includes("tahoma")) return 'Tahoma, Geneva, sans-serif';
  if (f.includes("arial")) return 'Arial, "Helvetica Neue", Helvetica, sans-serif';

  return '"Helvetica Neue", Helvetica, Arial, sans-serif';
}

/**
 * Extracts text items from PDF pages using PDF.js text layer APIs
 * and groups words on the same line into coherent editable text blocks.
 */
export async function extractTextItemsFromPdf(
  pdfBuffer: ArrayBuffer,
  maxPages = 100
): Promise<ExtractedTextItem[]> {
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const result: ExtractedTextItem[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const rawChunks: RawTextChunk[] = [];

    for (let j = 0; j < textContent.items.length; j++) {
      const item = textContent.items[j] as any;
      if (!item.str || item.str.trim().length === 0) continue;

      const transform = item.transform; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const tx = transform[4];
      const ty = transform[5];
      const fontHeight = Math.abs(transform[3] || transform[0] || 12);
      const fontName = item.fontName || "Helvetica";
      const isBold = /bold|black|heavy|medium/i.test(fontName);
      const isItalic = /italic|oblique|slanted/i.test(fontName);

      rawChunks.push({
        str: item.str,
        tx,
        ty,
        width: item.width || item.str.length * fontHeight * 0.5,
        fontHeight: Math.round(fontHeight),
        fontName,
        bold: isBold,
        italic: isItalic,
      });
    }

    // Sort raw chunks on page by Y (top to bottom) then X (left to right)
    rawChunks.sort((a, b) => {
      const yDiff = Math.abs(a.ty - b.ty);
      if (yDiff < Math.min(a.fontHeight, b.fontHeight) * 0.3) {
        return a.tx - b.tx;
      }
      return b.ty - a.ty;
    });

    // Group adjacent chunks into runs ONLY IF they share identical font styling and are directly contiguous
    const runs: RawTextChunk[][] = [];
    for (const chunk of rawChunks) {
      if (runs.length === 0) {
        runs.push([chunk]);
        continue;
      }

      const currentRun = runs[runs.length - 1];
      const lastChunk = currentRun[currentRun.length - 1];

      const sameBaseline = Math.abs(chunk.ty - lastChunk.ty) < Math.min(chunk.fontHeight, lastChunk.fontHeight) * 0.25;
      const sameFontHeight = Math.abs(chunk.fontHeight - lastChunk.fontHeight) <= 1;
      const sameFontName = chunk.fontName === lastChunk.fontName;
      const sameBold = chunk.bold === lastChunk.bold;
      const sameItalic = chunk.italic === lastChunk.italic;

      const gap = chunk.tx - (lastChunk.tx + lastChunk.width);
      // Contiguous if on same baseline, same font/style, and natural word gap (< fontHeight * 1.5)
      const isContiguous = sameBaseline && sameFontHeight && sameFontName && sameBold && sameItalic && gap >= -3 && gap < chunk.fontHeight * 1.5;

      if (isContiguous) {
        currentRun.push(chunk);
      } else {
        runs.push([chunk]);
      }
    }

    // Convert granular text runs into ExtractedTextItems
    runs.forEach((lineChunks, lineIdx) => {
      const first = lineChunks[0];
      const last = lineChunks[lineChunks.length - 1];

      const combinedText = lineChunks.map(c => c.str).join(first.str.endsWith(" ") ? "" : " ").replace(/\s+/g, " ").trim();
      if (!combinedText) return;

      const tx = first.tx;
      const ty = first.ty;
      const fontHeight = first.fontHeight;
      const totalWidth = Math.max(10, last.tx + last.width - tx);

      // Map PDF points to viewport fractions (viewport origin 0,0 is top-left)
      const xFrac = Math.max(0, Math.min(1, tx / viewport.width));
      const yFrac = Math.max(0, Math.min(1, (viewport.height - ty - fontHeight) / viewport.height));
      const wFrac = Math.max(0.01, Math.min(1 - xFrac, totalWidth / viewport.width));
      const hFrac = Math.max(0.01, Math.min(1 - yFrac, (fontHeight * 1.2) / viewport.height));

      const resolvedFont = resolvePdfFontFamily(first.fontName);

      result.push({
        id: `ext-${i - 1}-${lineIdx}-${Date.now()}`,
        pageIndex: i - 1,
        text: combinedText,
        xFrac,
        yFrac,
        wFrac,
        hFrac,
        fontSize: fontHeight,
        fontName: resolvedFont,
        color: "#000000",
        xPt: tx,
        yPt: ty,
        wPt: totalWidth,
        hPt: fontHeight * 1.2,
        bold: first.bold,
        italic: first.italic,
      });
    });
  }

  try {
    await pdf.cleanup?.();
  } catch {
    // Non-fatal
  }

  return result;
}

