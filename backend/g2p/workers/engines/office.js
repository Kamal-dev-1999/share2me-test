'use strict';
/**
 * office.js — PDF → DOCX / XLSX / PPTX conversion engine
 *
 * Strategy:
 *   1. Use @pdf2md/core (pdfjs-based) to extract structured text + page layout natively.
 *   2. Build a real Office document from that structure using:
 *      - docx     → DOCX (Microsoft Word)
 *      - xlsx     → XLSX (Microsoft Excel)  
 *      - pptxgenjs → PPTX (Microsoft PowerPoint)
 *   This runs 100% locally — no API calls, no external services.
 */

const pdfParse = require('pdf-parse');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract per-page text arrays from a PDF buffer.
 * Falls back from @pdf2md/core structured extraction to plain pdf-parse.
 */
async function extractPageText(inputBuffer) {
  // Try structured extraction first (preserves headings, lists)
  try {
    const { convert } = await import('@pdf2md/core');
    const result = await convert(new Uint8Array(inputBuffer));
    if (result.chunks && result.chunks.length > 0) {
      // chunks are page-level content blocks
      const pages = [];
      let current = [];
      for (const chunk of result.chunks) {
        if (chunk.type === 'page_break') {
          pages.push(current);
          current = [];
        } else {
          current.push(chunk.text || '');
        }
      }
      if (current.length) pages.push(current);
      return { pages, markdown: result.markdown || '' };
    }
  } catch (e) {
    console.warn('[Office] @pdf2md/core failed, falling back to pdf-parse:', e.message);
  }

  // Fallback: plain pdf-parse (text-only)
  const data = await pdfParse(inputBuffer);
  const rawPages = data.text.split(/\f/).map(p => p.trim()).filter(Boolean);
  return {
    pages: rawPages.map(p => p.split('\n').filter(l => l.trim())),
    markdown: data.text,
  };
}

// ── PDF → DOCX ───────────────────────────────────────────────────────────────

async function processPdfToDocx(inputBuffer, emitProgress) {
  emitProgress(10, 'Extracting text from PDF...');

  const { pages, markdown } = await extractPageText(inputBuffer);

  emitProgress(40, 'Building Word document...');

  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    PageBreak, AlignmentType, BorderStyle, TableRow, TableCell, Table, WidthType,
  } = require('docx');

  const children = [];

  // Parse the markdown output line-by-line to produce proper Word structure
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        text: line.slice(2).trim(),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.slice(3).trim(),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.slice(4).trim(),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 80 },
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        text: line.slice(2).trim(),
        bullet: { level: 0 },
      }));
    } else if (/^\d+\.\s/.test(line)) {
      children.push(new Paragraph({
        text: line.replace(/^\d+\.\s/, '').trim(),
        numbering: { reference: 'default-numbering', level: 0 },
      }));
    } else if (line.trim() === '' || line.trim() === '---') {
      children.push(new Paragraph({ text: '', spacing: { before: 80, after: 80 } }));
    } else {
      // Detect bold (**text**) inline
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const runs = parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), bold: true });
        }
        return new TextRun({ text: part });
      });
      children.push(new Paragraph({ children: runs }));
    }
  }

  const doc = new Document({
    creator: 'Share2Me PDF Tools',
    title: 'Converted Document',
    description: 'Converted from PDF by Share2Me',
    sections: [{ properties: {}, children }],
  });

  emitProgress(80, 'Packaging DOCX file...');
  const buffer = await Packer.toBuffer(doc);
  emitProgress(100, 'DOCX ready!');
  return buffer;
}

// ── PDF → XLSX ───────────────────────────────────────────────────────────────

async function processPdfToXlsx(inputBuffer, emitProgress) {
  emitProgress(10, 'Extracting text from PDF...');

  const { pages } = await extractPageText(inputBuffer);

  emitProgress(40, 'Parsing table data...');

  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();

  // Heuristic: split each page's lines by 2+ consecutive spaces (tab-like columns)
  pages.forEach((pageLines, pageIdx) => {
    const rows = pageLines.map(line => {
      // Split by 2+ spaces (columnar text detection)
      const cols = line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
      return cols.length > 1 ? cols : [line.trim()];
    }).filter(r => r.some(c => c.length > 0));

    if (rows.length === 0) return;

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Auto-size columns
    const colWidths = rows.reduce((widths, row) => {
      row.forEach((cell, i) => {
        widths[i] = Math.max(widths[i] || 10, String(cell).length + 2);
      });
      return widths;
    }, []);
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 60) }));

    const sheetName = pages.length === 1 ? 'Sheet1' : `Page ${pageIdx + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Fallback: at least one sheet
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No tabular data found in this PDF']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  }

  emitProgress(80, 'Writing Excel file...');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  emitProgress(100, 'XLSX ready!');
  return buffer;
}

// ── PDF → PPTX ───────────────────────────────────────────────────────────────

async function processPdfToPptx(inputBuffer, emitProgress) {
  emitProgress(10, 'Extracting pages from PDF...');

  const { pages } = await extractPageText(inputBuffer);

  emitProgress(40, 'Building PowerPoint slides...');

  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Share2Me PDF Tools';
  pptx.title = 'Converted Presentation';

  const BRAND_YELLOW = 'FBC02D';
  const TEXT_DARK = '1A1A1A';

  // One slide per page of the original PDF
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageLines = pages[pageIdx];
    const slide = pptx.addSlide();

    // Slide background
    slide.background = { color: 'FFFFFF' };

    // Detect if first line is a heading
    const firstLine = pageLines[0] || '';
    const isHeading = firstLine.startsWith('#') || (firstLine.length < 80 && firstLine === firstLine.toUpperCase());
    const title = firstLine.replace(/^#+\s*/, '').trim() || `Slide ${pageIdx + 1}`;
    const bodyLines = isHeading ? pageLines.slice(1) : pageLines;

    // Title box
    slide.addText(title, {
      x: 0.3, y: 0.2, w: 12.4, h: 0.8,
      fontSize: 24,
      bold: true,
      color: TEXT_DARK,
      fontFace: 'Calibri',
    });

    // Yellow accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: 1.05, w: 12.4, h: 0.06,
      fill: { color: BRAND_YELLOW },
      line: { color: BRAND_YELLOW },
    });

    // Body text
    const bodyText = bodyLines
      .filter(l => l.trim())
      .slice(0, 25) // cap at 25 lines per slide
      .join('\n');

    if (bodyText) {
      slide.addText(bodyText, {
        x: 0.3, y: 1.3, w: 12.4, h: 5.8,
        fontSize: 13,
        color: TEXT_DARK,
        fontFace: 'Calibri',
        valign: 'top',
        wrap: true,
      });
    }

    // Page number
    slide.addText(`${pageIdx + 1} / ${pages.length}`, {
      x: 11.5, y: 7.2, w: 1.2, h: 0.3,
      fontSize: 9,
      color: '999999',
      align: 'right',
    });

    // Share2Me watermark
    slide.addText('share2me', {
      x: 0.3, y: 7.2, w: 2, h: 0.3,
      fontSize: 9,
      color: BRAND_YELLOW,
      bold: true,
    });

    emitProgress(40 + Math.round((pageIdx / pages.length) * 40), `Building slide ${pageIdx + 1}/${pages.length}...`);
  }

  if (pages.length === 0) {
    const slide = pptx.addSlide();
    slide.addText('No content found in this PDF.', { x: 1, y: 3, w: 11, h: 1, fontSize: 18, color: TEXT_DARK });
  }

  emitProgress(85, 'Packaging PPTX file...');
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  emitProgress(100, 'PPTX ready!');
  return buffer;
}

module.exports = {
  processPdfToDocx,
  processPdfToXlsx,
  processPdfToPptx,
};
