'use strict';

/**
 * Markdown → PDF engine.
 *
 * Deterministic, AI-free pipeline:
 *   UTF-8 validation → marked (CommonMark + GFM) → DOMPurify → jsdom enrichment
 *   → styled print HTML → Chromium via puppeteer → pdf-lib metadata → Buffer
 *
 * The engine never fetches remote resources by default and never executes
 * user-supplied HTML/JavaScript.
 */

const { marked } = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { PDFDocument } = require('pdf-lib');
const puppeteer = require('./puppeteer');

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_PAGES = 200;
const DEFAULT_TIMEOUT_MS = 30000;

function intFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeMarkdown(buffer, maxBytes) {
  let text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');

  // Marked documents that leading zero-width/BOM characters interfere with parsing.
  text = text.replace(/^[\uFEFF\u200B\u200C\u200D\u2060]+/, '');

  if (text.includes('\u0000')) {
    throw new Error('Markdown input contains NUL bytes and cannot be processed.');
  }
  if (!text.trim()) {
    throw new Error('Markdown input is empty.');
  }
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new Error(`Markdown input exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
  }
  return text;
}

function slugify(rawText, used) {
  const base = String(rawText || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`~]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';

  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

/**
 * Sanitize the parser output. Raw HTML in the source is untrusted, so a strict
 * allowlist is applied regardless of what `marked` emitted.
 */
function sanitizeHtml(html, window) {
  const purify = createDOMPurify(window);
  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'srcdoc', 'formaction'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Add stable heading anchors, print-friendly task-list markers and an optional
 * table of contents. Everything inserted here is derived from textContent and
 * escaped, so it cannot reintroduce markup stripped by the sanitizer.
 */
function enrichDocument(container, config, headingsOut) {
  const used = new Set();
  const headings = [];

  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const text = (el.textContent || '').trim();
    const id = slugify(text, used);
    el.setAttribute('id', id);
    headings.push({ depth: Number(el.tagName.charAt(1)), text, id });
  });

  // GFM task lists use <input type="checkbox">. Replace with printable glyphs.
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    const marker = input.hasAttribute('checked') ? '\u2611 ' : '\u2610 ';
    input.replaceWith(container.ownerDocument.createTextNode(marker));
  });

  if (headings.length) {
    headingsOut.push(...headings);
  }
  return headings;
}

function buildTocHtml(headings) {
  if (!headings.length) return '';
  const items = headings
    .map((h) => `<li class="md-toc-d${h.depth}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`)
    .join('');
  return `<nav class="md-toc" aria-label="Table of contents"><p class="md-toc-title">Contents</p><ol>${items}</ol></nav>`;
}

function buildPrintHtml(bodyHtml, config, title, tocHtml) {
  const { pageSize, orientation, marginMm, printBackground } = config;
  const fontSize = 11;
  const showHeader = config.header ? 'block' : 'none';
  const showFooter = config.footer ? 'block' : 'none';

  const headerTemplate = config.header
    ? `<div style="font-family:'Noto Sans','DejaVu Sans',sans-serif;font-size:9px;width:100%;padding:4px 18mm;display:flex;justify-content:space-between;"><span>${escapeHtml(title)}</span><span class="date"></span></div>`
    : '<div></div>';
  const footerTemplate = config.footer
    ? `<div style="font-family:'Noto Sans','DejaVu Sans',sans-serif;font-size:9px;width:100%;padding:4px 18mm;display:flex;justify-content:space-between;"><span>Share2Me</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
    : '<div></div>';

  return {
    html: `<!DOCTYPE html>
<html lang="${escapeHtml(config.language || 'en')}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${pageSize} ${orientation}; margin: ${marginMm}mm; }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Noto Sans', 'DejaVu Sans', 'Segoe UI', sans-serif;
      font-size: ${fontSize}pt;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 { break-after: avoid-page; page-break-after: avoid; color: #111; line-height: 1.25; }
    h1 { font-size: 22pt; border-bottom: 2px solid #fbc02d; padding-bottom: 6px; margin: 0 0 18px; }
    h2 { font-size: 17pt; margin: 26px 0 10px; }
    h3 { font-size: 14pt; margin: 20px 0 8px; }
    h4, h5, h6 { font-size: 12pt; margin: 16px 0 6px; }
    p, ul, ol, blockquote, pre, table, figure { orphans: 3; widows: 3; }
    p { margin: 0 0 10px; }
    ul, ol { margin: 0 0 14px; padding-left: 22px; }
    li { margin-bottom: 4px; }
    a { color: #1d4ed8; text-decoration: none; word-break: break-word; }
    blockquote {
      border-left: 4px solid #fbc02d; background: #fffdf5; color: #444;
      margin: 14px 0; padding: 8px 16px;
    }
    blockquote p:last-child { margin-bottom: 0; }
    code {
      font-family: 'DejaVu Sans Mono', 'Consolas', monospace;
      font-size: 0.88em; background: #f3f4f6; padding: 1px 4px; border-radius: 3px;
    }
    pre {
      break-inside: avoid-page; page-break-inside: avoid;
      background: #f6f7f9; border: 1px solid #d7dbe0; border-radius: 5px;
      padding: 12px 14px; overflow: hidden; white-space: pre-wrap; word-break: break-word;
      margin: 12px 0 16px;
    }
    pre code { background: transparent; padding: 0; font-size: 9.5pt; }
    table {
      break-inside: avoid-page; page-break-inside: avoid;
      border-collapse: collapse; width: 100%; margin: 12px 0 18px; font-size: 10pt;
    }
    th, td { border: 1px solid #cbd0d6; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #eef1f4; font-weight: 700; }
    img { max-width: 100%; break-inside: avoid-page; page-break-inside: avoid; }
    hr { border: 0; border-top: 1px solid #d7dbe0; margin: 24px 0; }
    .md-toc { break-inside: avoid-page; page-break-inside: avoid; margin: 0 0 24px; padding: 14px 18px; background: #fafafa; border: 1px solid #e3e6e9; border-radius: 5px; }
    .md-toc-title { font-weight: 700; font-size: 13pt; margin: 0 0 8px; }
    .md-toc ol { list-style: none; margin: 0; padding: 0; }
    .md-toc li { margin: 3px 0; font-size: 10pt; }
    .md-toc-d2 { padding-left: 14px; } .md-toc-d3 { padding-left: 28px; }
    .md-toc-d4 { padding-left: 42px; } .md-toc-d5, .md-toc-d6 { padding-left: 56px; }
    .md-doc-header { ${showHeader} }
    .md-doc-footer { ${showFooter} }
  </style>
</head>
<body>
  ${tocHtml}
  <main>${bodyHtml}</main>
</body>
</html>`,
    headerTemplate,
    footerTemplate,
  };
}

async function normalizePdf(pdfBuffer, config, title) {
  // Keep our own metadata: pdf-lib otherwise rewrites Producer on save.
  const doc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  const pageCount = doc.getPageCount();
  if (pageCount > config.maxPages) {
    throw new Error(
      `Document exceeded the ${config.maxPages}-page limit (rendered ${pageCount} pages).`
    );
  }

  doc.setTitle(title);
  doc.setAuthor('Share2Me');
  doc.setSubject('Generated from Markdown');
  doc.setCreator('Share2Me Markdown to PDF');
  doc.setProducer('Share2Me');
  if (config.language) doc.setLanguage(config.language);
  if (config.deterministic) {
    doc.setCreationDate(new Date('2020-01-01T00:00:00.000Z'));
    doc.setModificationDate(new Date('2020-01-01T00:00:00.000Z'));
  }
  return Buffer.from(await doc.save());
}

/**
 * @param {Buffer} inputBuffer UTF-8 Markdown bytes
 * @param {object} rawConfig validated tool config
 * @param {function} emitProgress (pct, message) => void
 * @returns {Promise<Buffer>} PDF bytes
 */
async function processMarkdownToPdf(inputBuffer, rawConfig = {}, emitProgress = () => {}) {
  const config = {
    pageSize: rawConfig.pageSize === 'Letter' ? 'Letter' : 'A4',
    orientation: rawConfig.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginMm: Number.isFinite(rawConfig.marginMm)
      ? Math.min(40, Math.max(0, rawConfig.marginMm))
      : 18,
    scale: Number.isFinite(rawConfig.scale)
      ? Math.min(2, Math.max(0.1, rawConfig.scale))
      : 1,
    printBackground: rawConfig.printBackground !== false,
    language: typeof rawConfig.language === 'string' ? rawConfig.language.slice(0, 20) : 'en',
    header: rawConfig.header === true,
    footer: rawConfig.footer === true,
    toc: rawConfig.toc === true,
    remoteResources: rawConfig.remoteResources === true,
    maxPages: Number.isFinite(rawConfig.maxPages)
      ? Math.min(1000, Math.max(1, rawConfig.maxPages))
      : DEFAULT_MAX_PAGES,
    deterministic: rawConfig.deterministic === true,
  };

  const maxBytes = intFromEnv('TOOLS_MD_MAX_BYTES', DEFAULT_MAX_BYTES);
  const timeout = intFromEnv('TOOLS_PDF_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

  emitProgress(10, 'Validating Markdown…');
  const markdown = normalizeMarkdown(inputBuffer, maxBytes);

  emitProgress(25, 'Parsing Markdown…');
  const rawHtml = marked.parse(markdown, { gfm: true, breaks: false });

  emitProgress(40, 'Sanitizing document…');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const container = dom.window.document.createElement('div');
  container.innerHTML = sanitizeHtml(String(rawHtml), dom.window);

  const headings = [];
  enrichDocument(container, config, headings);
  dom.window.document.body.appendChild(container);

  const headingsForToc = headings;

  const title = (typeof rawConfig.title === 'string' && rawConfig.title.trim())
    ? rawConfig.title.trim().slice(0, 200)
    : (headingsForToc.find((h) => h.depth === 1)?.text
        || (typeof rawConfig.filename === 'string' ? rawConfig.filename : 'document.md')
       ).slice(0, 200);

  const bodyHtml = container.innerHTML;
  const tocHtml = config.toc ? buildTocHtml(headingsForToc) : '';
  const print = buildPrintHtml(bodyHtml, config, title, tocHtml);

  emitProgress(55, 'Rendering PDF…');
  const marginTop = config.marginMm + (config.header ? 10 : 0);
  const marginBottom = config.marginMm + (config.footer ? 10 : 0);
  const pdfBuffer = await puppeteer.renderHtmlToPdf(print.html, {
    format: config.pageSize,
    landscape: config.orientation === 'landscape',
    margin: {
      top: `${marginTop}mm`,
      right: `${config.marginMm}mm`,
      bottom: `${marginBottom}mm`,
      left: `${config.marginMm}mm`,
    },
    scale: config.scale,
    printBackground: config.printBackground,
    preferCSSPageSize: true,
    displayHeaderFooter: config.header || config.footer,
    headerTemplate: print.headerTemplate,
    footerTemplate: print.footerTemplate,
    outline: true,
    tagged: true,
    timeout,
    remoteResources: config.remoteResources,
  }, (pct, msg) => emitProgress(55 + Math.round((pct / 100) * 35), msg));

  emitProgress(95, 'Finalizing PDF…');
  const finalBuffer = await normalizePdf(pdfBuffer, config, title);

  emitProgress(100, 'PDF ready.');
  return finalBuffer;
}

module.exports = {
  processMarkdownToPdf,
  // Exported for pure unit tests (no Chromium required).
  _internal: { escapeHtml, normalizeMarkdown, slugify, sanitizeHtml, buildTocHtml, buildPrintHtml },
};
