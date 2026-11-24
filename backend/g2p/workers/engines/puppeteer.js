'use strict';

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  // Graceful fallback — engine reports a clear error when invoked.
}

function resolveExecutablePath() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RENDER;
  return isLocal
    ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    : '/usr/bin/chromium-browser';
}

/** Block file inclusion, non-HTTP schemes and private/metadata hosts. */
function isBlockedHost(host) {
  return (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    (host.startsWith('172.') && /^172\.(1[6-9]|2\d|3[01])\./.test(host))
  );
}

/**
 * Render fully assembled, already-sanitized HTML to PDF.
 *
 * @param {string} html print-ready HTML document
 * @param {object} options Puppeteer PDFOptions plus `remoteResources` and `timeout`
 * @param {function} emitProgress (pct, message) => void
 * @returns {Promise<Buffer>}
 */
async function renderHtmlToPdf(html, options = {}, emitProgress = () => {}) {
  if (!puppeteer) throw new Error('puppeteer-core is not installed');

  const allowRemote = options.remoteResources === true;
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 30000;

  emitProgress(20, 'Launching Chrome rendering engine…');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    emitProgress(40, 'Loading content…');
    const page = await browser.newPage();

    // SSRF / LFI guard. Requests are blocked unless explicitly allowed, and even
    // when allowed, private/metadata hosts remain unreachable.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const urlStr = req.url().toLowerCase();
        if (/^(data:|about:|blob:)/.test(urlStr)) return req.continue();
        if (/^(file:|gopher:|ftp:)/.test(urlStr)) return req.abort();
        if (!allowRemote) return req.abort();
        if (isBlockedHost(new URL(urlStr).hostname)) return req.abort();
        return req.continue();
      } catch (_e) {
        return req.abort();
      }
    });

    await page.setContent(html, { waitUntil: 'networkidle0', timeout });

    emitProgress(70, 'Rendering PDF…');
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape === true,
      margin: options.margin,
      scale: Number.isFinite(options.scale) ? options.scale : 1,
      printBackground: options.printBackground !== false,
      preferCSSPageSize: options.preferCSSPageSize !== false,
      displayHeaderFooter: options.displayHeaderFooter === true,
      headerTemplate: options.headerTemplate || '<div></div>',
      footerTemplate: options.footerTemplate || '<div></div>',
      outline: options.outline === true,
      tagged: options.tagged !== false,
      timeout,
    });

    emitProgress(90, 'Finalizing PDF…');
    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Converts an HTML buffer to PDF. Kept as a compatibility wrapper for
 * html-to-pdf and the AI report engine; behaviour matches the original engine.
 */
async function processHtmlToPdf(inputBuffer, emitProgress = () => {}) {
  try {
    return await renderHtmlToPdf(inputBuffer.toString('utf-8'), {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      outline: false,
      tagged: true,
      remoteResources: true,
    }, emitProgress);
  } catch (err) {
    console.error('Puppeteer conversion failed:', err);
    throw new Error('Failed to convert HTML: ' + err.message);
  }
}

module.exports = {
  renderHtmlToPdf,
  processHtmlToPdf,
};
