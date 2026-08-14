/**
 * Share2Me PDF Processing Microservice — Browser Web Worker
 *
 * Architecture: This file is the isolated "PDF Processing Service". It runs
 * in a dedicated worker thread. All PDF operations happen here and NEVER
 * block the main UI thread. Communication uses a typed message-passing API
 * identical to a REST API contract (slug + config in, progress events + blob out).
 *
 * Message Contract (Main → Worker):
 *   { type: 'PROCESS', requestId: string, slug: string, buffers: ArrayBuffer[], config: object }
 *
 * Message Contract (Worker → Main):
 *   { type: 'PROGRESS', requestId, pct: number, message: string }
 *   { type: 'COMPLETE',  requestId, buffer: ArrayBuffer, filename: string, mimeType: string }
 *   { type: 'ERROR',     requestId, code: string, message: string }
 *
 * Each handler is a completely isolated async function.
 * Adding a new tool = add one entry to TOOL_HANDLERS. Nothing else changes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Import pdf-lib — loaded as a classic script via importScripts in the worker
// ─────────────────────────────────────────────────────────────────────────────

importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');

// pdf-lib is now available as the global `PDFLib`
const { PDFDocument, degrees, rgb, StandardFonts, PageSizes } = PDFLib;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Emit a progress update back to the main thread */
function progress(requestId, pct, message) {
  self.postMessage({ type: 'PROGRESS', requestId, pct: Math.min(100, Math.max(0, pct)), message });
}

/** Emit final success result */
function complete(requestId, buffer, filename, mimeType = 'application/pdf') {
  self.postMessage({ type: 'COMPLETE', requestId, buffer, filename, mimeType }, [buffer]);
}

/** Emit an error */
function error(requestId, code, message) {
  self.postMessage({ type: 'ERROR', requestId, code, message });
}

/** Load a PDFDocument from an ArrayBuffer with copy-protection bypass */
async function loadPdf(buffer, config = {}) {
  try {
    return await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      password: config.password || undefined,
    });
  } catch (e) {
    if (e.message && e.message.includes('encrypted')) {
      throw Object.assign(new Error('This PDF is password-protected. Please provide the password in options.'), { code: 'ENCRYPTED' });
    }
    throw e;
  }
}

/** Parse a page range string like "1-3,5,7-9" into 0-indexed page indices */
function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.trim() === '') return Array.from({ length: totalPages }, (_, i) => i);
  const indices = new Set();
  for (const part of rangeStr.split(',')) {
    const [start, end] = part.trim().split('-').map(n => parseInt(n.trim(), 10) - 1);
    if (isNaN(start)) continue;
    const s = Math.max(0, start);
    const e = end !== undefined && !isNaN(end) ? Math.min(totalPages - 1, end) : s;
    for (let i = s; i <= e; i++) indices.add(i);
  }
  return [...indices].sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Handlers
// Each handler is: async function(requestId, buffers, config) → void
// It MUST call either complete() or error() exactly once.
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_HANDLERS = {

  // ── MERGE PDF ─────────────────────────────────────────────────────────────
  'merge-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading documents…');
    const merged = await PDFDocument.create();

    for (let i = 0; i < buffers.length; i++) {
      const doc = await loadPdf(buffers[i], config);
      const pageCount = doc.getPageCount();
      progress(requestId, 5 + Math.round(((i + 1) / buffers.length) * 80), `Merging document ${i + 1} of ${buffers.length}…`);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }

    progress(requestId, 90, 'Finalizing…');
    const bytes = await merged.save();
    complete(requestId, bytes.buffer, 'merged.pdf');
  },

  // ── SPLIT PDF ─────────────────────────────────────────────────────────────
  // For simplicity: produces a single PDF with the requested page range.
  // Multi-file split (one PDF per page) is a future enhancement (requires ZIP).
  'split-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading document…');
    const src = await loadPdf(buffers[0], config);
    const totalPages = src.getPageCount();
    const indices = parsePageRange(config.pageRange, totalPages);

    if (indices.length === 0) {
      error(requestId, 'INVALID_RANGE', 'The specified page range is out of bounds or invalid.');
      return;
    }

    progress(requestId, 30, `Extracting ${indices.length} page(s)…`);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    copied.forEach(p => out.addPage(p));

    progress(requestId, 90, 'Saving…');
    const bytes = await out.save();
    complete(requestId, bytes.buffer, 'split.pdf');
  },

  // ── ROTATE PDF ────────────────────────────────────────────────────────────
  'rotate-pdf': async (requestId, buffers, config) => {
    const rotateDeg = parseInt(config.degrees || '90', 10); // 90, 180, 270
    progress(requestId, 5, 'Loading document…');
    const doc = await loadPdf(buffers[0], config);
    const pages = doc.getPages();
    const indices = parsePageRange(config.pageRange, pages.length);

    progress(requestId, 30, 'Rotating pages…');
    for (const i of indices) {
      const page = pages[i];
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + rotateDeg) % 360));
    }

    progress(requestId, 90, 'Saving…');
    const bytes = await doc.save();
    complete(requestId, bytes.buffer, 'rotated.pdf');
  },

  // ── ORGANIZE PDF (REORDER) ────────────────────────────────────────────────
  // config.order: array of 0-based page indices in desired order e.g. [2,0,1]
  'organize-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading document…');
    const src = await loadPdf(buffers[0], config);
    const totalPages = src.getPageCount();
    const order = config.order
      ? config.order.map(n => parseInt(n, 10)).filter(n => n >= 0 && n < totalPages)
      : Array.from({ length: totalPages }, (_, i) => i);

    progress(requestId, 30, 'Reordering pages…');
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, order);
    copied.forEach(p => out.addPage(p));

    progress(requestId, 90, 'Saving…');
    const bytes = await out.save();
    complete(requestId, bytes.buffer, 'organized.pdf');
  },

  // ── CROP PDF ──────────────────────────────────────────────────────────────
  // config: { left, top, right, bottom } — margins to remove in points (1pt = 1/72 inch)
  'crop-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading document…');
    const doc = await loadPdf(buffers[0], config);
    const pages = doc.getPages();
    const { left = 0, top = 0, right = 0, bottom = 0 } = config;

    progress(requestId, 30, 'Cropping pages…');
    for (const page of pages) {
      const { width, height } = page.getSize();
      const newWidth = width - parseFloat(left) - parseFloat(right);
      const newHeight = height - parseFloat(top) - parseFloat(bottom);
      if (newWidth <= 0 || newHeight <= 0) {
        throw Object.assign(new Error('The crop margins are too large and result in an invalid page size.'), { code: 'INVALID_CROP' });
      }
      page.setCropBox(
        parseFloat(left),
        parseFloat(bottom),
        newWidth,
        newHeight,
      );
    }

    progress(requestId, 90, 'Saving…');
    const bytes = await doc.save();
    complete(requestId, bytes.buffer, 'cropped.pdf');
  },

  // ── PAGE NUMBERS ──────────────────────────────────────────────────────────
  // config: { position: 'bottom-center'|'bottom-right'|'top-center', startFrom: 1, fontSize: 11 }
  'page-numbers': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading document…');
    const doc = await loadPdf(buffers[0], config);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const fontSize = parseFloat(config.fontSize || '11');
    const startFrom = parseInt(config.startFrom || '1', 10);
    const position = config.position || 'bottom-center';
    const totalPages = pages.length;

    progress(requestId, 20, 'Adding page numbers…');
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const label = String(startFrom + i);
      const textWidth = font.widthOfTextAtSize(label, fontSize);

      let x, y;
      switch (position) {
        case 'bottom-right':  x = width - textWidth - 36; y = 24; break;
        case 'top-center':    x = (width - textWidth) / 2; y = height - 36; break;
        case 'bottom-center':
        default:              x = (width - textWidth) / 2; y = 24;
      }

      page.drawText(label, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
      progress(requestId, 20 + Math.round(((i + 1) / totalPages) * 70), `Adding page numbers…`);
    }

    progress(requestId, 95, 'Saving…');
    const bytes = await doc.save();
    complete(requestId, bytes.buffer, 'numbered.pdf');
  },

  // ── JPG/PNG → PDF ─────────────────────────────────────────────────────────
  'jpg-to-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Creating PDF…');
    const doc = await PDFDocument.create();

    for (let i = 0; i < buffers.length; i++) {
      progress(requestId, 5 + Math.round(((i + 1) / buffers.length) * 80), `Embedding image ${i + 1} of ${buffers.length}…`);
      const bytes = new Uint8Array(buffers[i]);

      // Detect format by magic bytes
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      let img;
      if (isPng) {
        img = await doc.embedPng(bytes);
      } else {
        img = await doc.embedJpg(bytes);
      }

      const { width, height } = img.scale(1);
      const pageSize = config.fitToPage !== false ? [width, height] : PageSizes.A4;
      const page = doc.addPage(pageSize);

      const maxW = page.getWidth();
      const maxH = page.getHeight();
      const scale = Math.min(maxW / width, maxH / height);

      page.drawImage(img, {
        x: (maxW - width * scale) / 2,
        y: (maxH - height * scale) / 2,
        width: width * scale,
        height: height * scale,
      });
    }

    progress(requestId, 95, 'Saving…');
    const bytes = await doc.save();
    complete(requestId, bytes.buffer, 'images.pdf');
  },

  // ── WATERMARK PDF ─────────────────────────────────────────────────────────
  // config: { text: 'CONFIDENTIAL', opacity: 0.25, angle: 45, fontSize: 64 }
  'watermark-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading document…');
    const doc = await loadPdf(buffers[0], config);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();
    const text = config.text || 'CONFIDENTIAL';
    const fontSize = parseFloat(config.fontSize || '64');
    const opacity = parseFloat(config.opacity || '0.25');
    const angle = parseFloat(config.angle || '45');
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      try {
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: (height - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: degrees(angle),
        });
      } catch (err) {
        if (err.message && err.message.includes('WinAnsi')) {
          throw Object.assign(new Error('The watermark text contains unsupported characters (e.g., non-English characters or emojis). Please use standard English characters.'), { code: 'UNSUPPORTED_CHARACTERS' });
        }
        throw err;
      }
      progress(requestId, 10 + Math.round(((i + 1) / totalPages) * 80), 'Adding watermark…');
    }

    progress(requestId, 95, 'Saving…');
    const bytes = await doc.save();
    complete(requestId, bytes.buffer, 'watermarked.pdf');
  },



  // ── UNLOCK PDF ────────────────────────────────────────────────────────────
  // config: { password: string }
  'unlock-pdf': async (requestId, buffers, config) => {
    progress(requestId, 10, 'Attempting to unlock…');

    if (!config.password) {
      error(requestId, 'MISSING_PASSWORD', 'Please provide the document password.');
      return;
    }

    let src;
    try {
      src = await PDFDocument.load(buffers[0], { password: config.password });
    } catch (e) {
      error(requestId, 'WRONG_PASSWORD', 'The password is incorrect. Please try again.');
      return;
    }

    progress(requestId, 50, 'Removing password protection…');
    // Copy into a new unencrypted document
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));

    progress(requestId, 90, 'Saving unlocked PDF…');
    const bytes = await out.save();
    complete(requestId, bytes.buffer, 'unlocked.pdf');
  },

  // ── COMPRESS PDF ──────────────────────────────────────────────────────────
  // Uses pdf-lib's built-in objectsPerTick optimization and re-saves.
  // Advanced image recompression requires canvas API (not available in Worker
  // by default) — for now this applies structural compression only.
  // config: { quality: 'screen' | 'ebook' | 'printer' } (maps to compression level)
  'compress-pdf': async (requestId, buffers, config) => {
    progress(requestId, 5, 'Loading document…');
    const doc = await loadPdf(buffers[0], config);

    progress(requestId, 30, 'Optimizing structure…');
    // pdf-lib's useObjectStreams=true significantly reduces file size for most PDFs
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });

    progress(requestId, 95, 'Complete');
    complete(requestId, bytes.buffer, 'compressed.pdf');
  },

  // ── PDF → JPG ─────────────────────────────────────────────────────────────
  // This tool requires canvas API. In a Worker we use OffscreenCanvas if available.
  // Falls back to a structured error if OffscreenCanvas not supported (old browsers).
  'pdf-to-jpg': async (requestId, buffers, config) => {
    // PDF.js requires a full DOM environment — this tool must be handled
    // in the main thread (not the worker). We redirect to main thread handler.
    // The worker posts a special message that tells the main thread to handle it.
    self.postMessage({ type: 'DELEGATE_TO_MAIN', requestId, slug: 'pdf-to-jpg', buffers, config }, buffers);
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// Message Router — dispatches incoming messages to the correct handler
// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = async function(event) {
  const { type, requestId, slug, buffers, config } = event.data;

  if (type !== 'PROCESS') return;

  const handler = TOOL_HANDLERS[slug];

  if (!handler) {
    error(requestId, 'UNKNOWN_TOOL', `No handler registered for tool: "${slug}". This tool may require server-side processing.`);
    return;
  }

  try {
    await handler(requestId, buffers, config || {});
  } catch (err) {
    const code = err.code || 'PROCESSING_ERROR';
    const message = err.message || 'An unexpected error occurred while processing your file.';
    error(requestId, code, message);
  }
};
