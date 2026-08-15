let puppeteer;
let chromium;
try {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} catch (e) {
  // Graceful fallback
}

/**
 * Converts HTML string to PDF using Puppeteer
 * @param {Buffer} inputBuffer (HTML string buffer)
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer
 */
async function processHtmlToPdf(inputBuffer, emitProgress) {
  if (!puppeteer) throw new Error('puppeteer-core is not installed');

  emitProgress(20, "Launching Chrome rendering engine...");
  
  let browser;
  try {
    const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RENDER;
    
    // Use local Edge/Chrome on Windows dev, and sparticuz/chromium on Render/Linux
    const executablePath = isLocal 
      ? (process.env.CHROME_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
      : await chromium.executablePath();
    
    browser = await puppeteer.launch({ 
      executablePath,
      headless: isLocal ? true : chromium.headless,
      args: isLocal ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
      defaultViewport: chromium ? chromium.defaultViewport : { width: 1920, height: 1080 }
    });

    emitProgress(40, "Loading HTML content...");
    const page = await browser.newPage();
    const htmlContent = inputBuffer.toString('utf-8');
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    emitProgress(70, "Rendering PDF...");
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
    
    emitProgress(90, "Finalizing PDF...");
    return pdfBuf;
  } catch (err) {
    console.error('Puppeteer conversion failed:', err);
    throw new Error('Failed to convert HTML: ' + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  processHtmlToPdf
};
