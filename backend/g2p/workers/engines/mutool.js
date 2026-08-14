const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const execFileAsync = promisify(execFile);

/**
 * Repairs a corrupted PDF using mutool clean
 * @param {Buffer} inputBuffer 
 * @param {function} emitProgress 
 * @returns {Buffer} outputBuffer
 */
async function processRepairPdf(inputBuffer, emitProgress) {
  emitProgress(20, "Initializing mutool engine...");

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${uuidv4()}.pdf`);
  const outputPath = path.join(tempDir, `output-${uuidv4()}.pdf`);

  await fs.writeFile(inputPath, inputBuffer);

  try {
    emitProgress(50, "Repairing PDF structure...");
    // mutool clean -d (decompress) or just mutool clean to repair
    await execFileAsync('mutool', ['clean', '-d', inputPath, outputPath]);

    emitProgress(90, "Finalizing repaired PDF...");
    const outputBuffer = await fs.readFile(outputPath);
    return outputBuffer;
  } catch (err) {
    console.error('Mutool repair failed:', err);
    throw new Error('Failed to repair document: ' + err.message);
  } finally {
    // Cleanup
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

module.exports = {
  processRepairPdf
};
