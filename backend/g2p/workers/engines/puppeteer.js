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
    // In production, we'd need to specify executablePath to the installed chromium
    // locally, it might fail unless we use standard puppeteer.
    // For this tier, we'll try to find a local edge/chrome if executablePath isn't explicitly set.
    // The safest cross-platform way for puppeteer-core is to use chrome launcher or specific paths.
    // For now, we will use a common Windows path as a fallback.
    const executablePath = process.env.CHROME_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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
