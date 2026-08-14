const { createWorker } = require('tesseract.js');

/**
 * Extracts text from an image buffer using Tesseract.js
 * @param {Buffer} inputBuffer 
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer (Text file)
 */
async function processOcr(inputBuffer, emitProgress) {
  emitProgress(10, "Initializing Tesseract engine...");
  
  let worker;
  try {
    worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          // Map Tesseract 0-1 progress to 20-90%
          const pct = 20 + Math.floor(m.progress * 70);
          emitProgress(pct, `Scanning text (${Math.floor(m.progress * 100)}%)`);
        }
      }
    });

    emitProgress(20, "Analyzing image...");
    const { data: { text } } = await worker.recognize(inputBuffer);
    
    emitProgress(95, "Generating text file...");
    return Buffer.from(text, 'utf-8');
  } catch (err) {
    console.error('Tesseract OCR failed:', err);
    throw new Error('Failed to run OCR: ' + err.message);
  } finally {
    if (worker) await worker.terminate();
  }
}

module.exports = {
  processOcr
};
