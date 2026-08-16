/**
 * Client-side page counting for the print flow.
 *
 * - PDF   → real page count via pdf-lib
 * - DOCX  → Word's own page count from docProps/app.xml; falls back to a
 *           word-count estimate (~450 words/page) when the property is absent
 * - PPTX  → number of slides
 * - XLSX  → number of worksheets
 * - TXT/CSV → ~48 lines per printed page
 * - images & everything else → 1 page
 */

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export async function countPages(file: File): Promise<number> {
  const e = ext(file.name);
  try {
    if (file.type === "application/pdf" || e === "pdf") return await countPdf(file);
    if (e === "docx") return await countDocx(file);
    if (e === "pptx") return await countZipEntries(file, /^ppt\/slides\/slide\d+\.xml$/);
    if (e === "xlsx") return await countZipEntries(file, /^xl\/worksheets\/sheet\d+\.xml$/);
    if (e === "txt" || e === "csv" || file.type.startsWith("text/")) return await countText(file);
    return 1; // images (1 print each) and unknown formats
  } catch {
    return 1;
  }
}

async function countPdf(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  return Math.max(1, doc.getPageCount());
}

async function countDocx(file: File): Promise<number> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Word stores the last-rendered page count here (present in almost every
  // file saved by Word/Google Docs/LibreOffice).
  const app = zip.file("docProps/app.xml");
  if (app) {
    const xml = await app.async("string");
    const m = xml.match(/<Pages>(\d+)<\/Pages>/);
    if (m && Number(m[1]) > 0) return Number(m[1]);
  }

  // Fallback: estimate from the document text (~450 words per A4 page).
  const doc = zip.file("word/document.xml");
  if (doc) {
    const xml = await doc.async("string");
    const text = xml.replace(/<[^>]+>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 450));
  }
  return 1;
}

async function countZipEntries(file: File, pattern: RegExp): Promise<number> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const count = Object.keys(zip.files).filter((p) => pattern.test(p)).length;
  return Math.max(1, count);
}

async function countText(file: File): Promise<number> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).length;
  return Math.max(1, Math.ceil(lines / 48));
}
