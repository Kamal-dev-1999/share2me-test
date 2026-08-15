let puppeteer;
try {
  puppeteer = require('puppeteer-core');
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
    
    // Use local Edge/Chrome on Windows dev, or CHROME_BIN in Docker/Linux
    const executablePath = process.env.CHROME_BIN || (isLocal ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '/usr/bin/chromium-browser');
    
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
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
