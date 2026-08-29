import { PDFDocument, rgb, StandardFonts, degrees, PDFPage } from "pdf-lib";
import type { PdfObject, PageState, TextPdfObject, ImagePdfObject, ShapePdfObject, DrawingPdfObject, SignaturePdfObject } from "../types";

/** Convert hex color (#RRGGBB) to pdf-lib RGB object (0..1) */
function hexToPdfRgb(hex: string, defaultColor = rgb(0, 0, 0)) {
  if (!hex || hex === "transparent") return undefined;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return defaultColor;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Converts base64 / dataUrl image to Uint8Array bytes */
async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  if (dataUrl.startsWith("data:image/webp")) {
    // Convert WebP dataUrl to PNG dataUrl via Canvas for pdf-lib compatibility
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    dataUrl = canvas.toDataURL("image/png");
  }

  const base64Str = dataUrl.split(",")[1];
  const binaryStr = atob(base64Str);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compiles original PDF + Editor Objects into a final Uint8Array PDF file using pdf-lib.
 */
export async function exportEditedPdf(
  originalPdfBuffer: ArrayBuffer,
  objects: PdfObject[],
  pagesState: PageState[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer.slice(0));

  // 1. Embed Standard Fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontHelveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  const getFont = (family: string, bold: boolean, italic: boolean) => {
    if (family.includes("Times")) return fontTimes;
    if (family.includes("Courier")) return fontCourier;
    if (bold && italic) return fontHelveticaBoldOblique;
    if (bold) return fontHelveticaBold;
    if (italic) return fontHelveticaOblique;
    return fontHelvetica;
  };

  // 2. Perform Page Management Operations (Reorder, Rotate, Delete, Add Blank Pages)
  const finalDoc = await PDFDocument.create();

  // Map of old page index -> newly inserted page object in finalDoc
  const pageMap: PDFPage[] = [];

  for (let i = 0; i < pagesState.length; i++) {
    const pageState = pagesState[i];
    if (pageState.isDeleted) continue;

    let targetPage: PDFPage;

    if (pageState.isCustomBlank) {
      targetPage = finalDoc.addPage([595.28, 841.89]); // A4 Size in PDF points
    } else {
      const [copiedPage] = await finalDoc.copyPages(pdfDoc, [pageState.pageIndex]);
      targetPage = finalDoc.addPage(copiedPage);
    }

    if (pageState.rotation !== 0) {
      const currentRot = targetPage.getRotation().angle;
      targetPage.setRotation(degrees((currentRot + pageState.rotation) % 360));
    }

    pageMap.push(targetPage);
  }

  // 3. Group objects by Page Index and draw onto pages
  for (let i = 0; i < pagesState.length; i++) {
    const pageState = pagesState[i];
    if (pageState.isDeleted) continue;

    // Find corresponding target page in finalDoc
    const targetPage = pageMap.find((_, idx) => pagesState.filter(p => !p.isDeleted)[idx] === pageState);
    if (!targetPage) continue;

    const { width: pageW, height: pageH } = targetPage.getSize();

    // Get all objects on this page sorted by zIndex
    const pageObjects = objects
      .filter((o) => o.pageIndex === i)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const obj of pageObjects) {
      // Calculate coordinates in PDF point space (0,0 is bottom-left)
      const objX = obj.xFrac * pageW;
      const objY = pageH - obj.yFrac * pageH - obj.hFrac * pageH;
      const objW = obj.wFrac * pageW;
      const objH = obj.hFrac * pageH;

      const pdfColor = hexToPdfRgb((obj as any).color || "#000000");

      if (obj.type === "whiteout") {
        // Draw white solid rectangle over existing content
        targetPage.drawRectangle({
          x: objX,
          y: objY,
          width: objW,
          height: objH,
          color: rgb(1, 1, 1),
          opacity: 1.0,
        });
      } else if (obj.type === "text") {
        const textObj = obj as TextPdfObject;
        const font = getFont(textObj.fontFamily, textObj.bold, textObj.italic);
        const textRgb = hexToPdfRgb(textObj.color, rgb(0, 0, 0))!;
        
        // Handle multiline text
        const lines = textObj.text.split("\n");
        const fontSize = textObj.fontSize || 16;
        const lineHeight = fontSize * 1.2;

        lines.forEach((line, lineIdx) => {
          targetPage.drawText(line, {
            x: objX,
            y: objY + objH - (lineIdx + 1) * fontSize,
            size: fontSize,
            font,
            color: textRgb,
            opacity: textObj.opacity ?? 1.0,
            rotate: textObj.rotation ? degrees(textObj.rotation) : undefined,
          });
        });
      } else if (obj.type === "image" || obj.type === "signature") {
        const imgObj = obj as ImagePdfObject | SignaturePdfObject;
        try {
          const imgBytes = await dataUrlToBytes(imgObj.dataUrl);
          const embeddedImage = imgObj.dataUrl.includes("image/jpeg") || imgObj.dataUrl.includes("image/jpg")
            ? await finalDoc.embedJpg(imgBytes)
            : await finalDoc.embedPng(imgBytes);

          targetPage.drawImage(embeddedImage, {
            x: objX,
            y: objY,
            width: objW,
            height: objH,
            opacity: imgObj.opacity ?? 1.0,
            rotate: imgObj.rotation ? degrees(imgObj.rotation) : undefined,
          });
        } catch (err) {
          console.warn("[PDF_EXPORT] Failed to embed image object:", err);
        }
      } else if (obj.type === "shape") {
        const shapeObj = obj as ShapePdfObject;
        const fillColor = hexToPdfRgb(shapeObj.fillColor);
        const strokeColor = hexToPdfRgb(shapeObj.strokeColor);
        const borderWidth = shapeObj.strokeWidth || 1;

        if (shapeObj.shapeType === "rectangle" || shapeObj.shapeType === "rounded-rect") {
          targetPage.drawRectangle({
            x: objX,
            y: objY,
            width: objW,
            height: objH,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: strokeColor ? borderWidth : 0,
            opacity: shapeObj.opacity ?? 1.0,
          });
        } else if (shapeObj.shapeType === "circle" || shapeObj.shapeType === "ellipse") {
          targetPage.drawEllipse({
            x: objX + objW / 2,
            y: objY + objH / 2,
            xScale: objW / 2,
            yScale: objH / 2,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: strokeColor ? borderWidth : 0,
            opacity: shapeObj.opacity ?? 1.0,
          });
        } else if (shapeObj.shapeType === "line") {
          targetPage.drawLine({
            start: { x: objX, y: objY + objH },
            end: { x: objX + objW, y: objY },
            thickness: borderWidth,
            color: strokeColor || rgb(0, 0, 0),
            opacity: shapeObj.opacity ?? 1.0,
          });
        } else if (shapeObj.shapeType === "arrow") {
          targetPage.drawLine({
            start: { x: objX, y: objY + objH / 2 },
            end: { x: objX + objW, y: objY + objH / 2 },
            thickness: borderWidth,
            color: strokeColor || rgb(0, 0, 0),
            opacity: shapeObj.opacity ?? 1.0,
          });
        }
      } else if (obj.type === "drawing") {
        const drawObj = obj as DrawingPdfObject;
        const strokeRgb = hexToPdfRgb(drawObj.strokeColor, rgb(0, 0, 0))!;
        const pts = drawObj.points;

        if (pts.length > 1) {
          for (let p = 0; p < pts.length - 1; p++) {
            const p1 = pts[p];
            const p2 = pts[p + 1];
            targetPage.drawLine({
              start: { x: objX + p1.x * objW, y: objY + (1 - p1.y) * objH },
              end: { x: objX + p2.x * objW, y: objY + (1 - p2.y) * objH },
              thickness: drawObj.strokeWidth || 2,
              color: strokeRgb,
              opacity: drawObj.opacity ?? 1.0,
            });
          }
        }
      } else if (obj.type === "highlight") {
        const highlightRgb = hexToPdfRgb(obj.color || "#ffeb3b", rgb(1, 0.92, 0.23))!;
        targetPage.drawRectangle({
          x: objX,
          y: objY,
          width: objW,
          height: objH,
          color: highlightRgb,
          opacity: 0.45,
        });
      } else if (obj.type === "underline") {
        const lineRgb = hexToPdfRgb(obj.color || "#000000", rgb(0, 0, 0))!;
        targetPage.drawLine({
          start: { x: objX, y: objY },
          end: { x: objX + objW, y: objY },
          thickness: 2,
          color: lineRgb,
          opacity: obj.opacity ?? 1.0,
        });
      } else if (obj.type === "strikethrough") {
        const lineRgb = hexToPdfRgb(obj.color || "#ef4444", rgb(0.93, 0.26, 0.26))!;
        targetPage.drawLine({
          start: { x: objX, y: objY + objH / 2 },
          end: { x: objX + objW, y: objY + objH / 2 },
          thickness: 2,
          color: lineRgb,
          opacity: obj.opacity ?? 1.0,
        });
      }
    }
  }

  // 4. Save and return compiled PDF bytes
  return await finalDoc.save();
}
