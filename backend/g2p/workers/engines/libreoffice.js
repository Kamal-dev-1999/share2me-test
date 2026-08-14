const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');
let libre;
try {
  libre = require('libreoffice-convert');
  libre.convertAsync = promisify(libre.convert);
  libre.convertWithOptionsAsync = promisify(libre.convertWithOptions);
} catch (e) {
  // Graceful fallback if not installed
}

/**
 * Converts a document to PDF using LibreOffice Headless
 * @param {Buffer} inputBuffer 
 * @param {string} ext 
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer
 */
async function processDocxToPdf(inputBuffer, ext, emitProgress) {
  if (!libre) throw new Error('libreoffice-convert is not installed');

  emitProgress(20, "Initializing LibreOffice engine...");
  
  try {
    // Convert to PDF
    emitProgress(50, "Converting document to PDF...");
    const pdfBuf = await libre.convertAsync(inputBuffer, '.pdf', undefined);
    
    emitProgress(90, "Finalizing PDF...");
    return pdfBuf;
  } catch (err) {
    console.error('LibreOffice conversion failed:', err);
    throw new Error('Failed to convert document: ' + err.message);
  }
}

/**
 * Converts a PDF to PDF/A using LibreOffice Draw
 * @param {Buffer} inputBuffer 
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer
 */
async function processPdfToPdfA(inputBuffer, emitProgress) {
  if (!libre) throw new Error('libreoffice-convert is not installed');

  emitProgress(20, "Initializing LibreOffice Draw engine...");
  
  try {
    emitProgress(50, "Converting to archival PDF/A format...");
    // Filter draw_pdf_Export with SelectPdfVersion=1 generates PDF/A-1b
    const pdfBuf = await libre.convertWithOptionsAsync(
      inputBuffer, 
      '.pdf', 
      'draw_pdf_Export:{"SelectPdfVersion":{"type":"integer","value":1}}', 
      undefined
    );
    
    emitProgress(90, "Finalizing PDF/A document...");
    return pdfBuf;
  } catch (err) {
    console.error('LibreOffice PDF/A conversion failed:', err);
    throw new Error('Failed to convert to PDF/A: ' + err.message);
  }
}

module.exports = {
  processDocxToPdf,
  processPdfToPdfA
};
