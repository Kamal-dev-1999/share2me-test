const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');

const execFileAsync = promisify(execFile);

/**
 * Resolves mutool binary path cross-platform.
 */
function getMutoolBinary() {
  if (process.platform === 'win32') {
    const wingetPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'mutool.exe');
    if (fsSync.existsSync(wingetPath)) return wingetPath;
    return 'mutool.exe';
  }
  return 'mutool';
}

/**
 * Repairs a corrupted PDF using mutool clean, qpdf, or pure JS pdf-lib fallback.
 * @param {Buffer} inputBuffer 
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer
 */
async function processRepairPdf(inputBuffer, emitProgress) {
  emitProgress(20, "Analyzing damaged PDF structure...");

  const tempDir = os.tmpdir();
  const fileId = uuidv4();
  const inputPath = path.join(tempDir, `input-${fileId}.pdf`);
  const outputPath = path.join(tempDir, `output-${fileId}.pdf`);

  await fs.writeFile(inputPath, inputBuffer);

  try {
    // Strategy 1: MuPDF mutool clean
    try {
      emitProgress(40, "Repairing PDF with MuPDF engine...");
      const bin = getMutoolBinary();
      // -gg compacts/rebuilds xref table, -d decompresses and fixes streams
      await execFileAsync(bin, ['clean', '-gg', '-d', inputPath, outputPath]);
      const stat = await fs.stat(outputPath).catch(() => null);
      if (stat && stat.size > 0) {
        emitProgress(90, "MuPDF repair successful! Finalizing...");
        return await fs.readFile(outputPath);
      }
    } catch (mutoolErr) {
      console.warn('[PDF Repair] Mutool failed or not available:', mutoolErr.message);
    }

    // Strategy 2: QPDF repair & linearization
    try {
      emitProgress(60, "Attempting QPDF structural reconstruction...");
      await execFileAsync('qpdf', ['--warning-exit-0', inputPath, outputPath]);
      const stat = await fs.stat(outputPath).catch(() => null);
      if (stat && stat.size > 0) {
        emitProgress(90, "QPDF repair successful! Finalizing...");
        return await fs.readFile(outputPath);
      }
    } catch (qpdfErr) {
      console.warn('[PDF Repair] QPDF failed or not available:', qpdfErr.message);
    }

    // Strategy 3: Pure JavaScript pdf-lib recovery
    try {
      emitProgress(80, "Attempting in-memory object recovery...");
      const doc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
      const repairedBytes = await doc.save();
      if (repairedBytes && repairedBytes.length > 0) {
        emitProgress(95, "In-memory recovery successful! Finalizing...");
        return Buffer.from(repairedBytes);
      }
    } catch (pdfLibErr) {
      console.warn('[PDF Repair] In-memory recovery failed:', pdfLibErr.message);
    }

    throw new Error('The uploaded PDF is severely damaged or unreadable by all repair engines.');
  } catch (err) {
    console.error('PDF repair failed:', err);
    throw new Error('Failed to repair document: ' + err.message);
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

module.exports = {
  processRepairPdf
};
