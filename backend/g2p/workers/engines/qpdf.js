const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const execFileAsync = promisify(execFile);

/**
 * Resolves qpdf binary cross-platform.
 */
function getQpdfBinary() {
  if (process.platform === 'win32') {
    const wingetPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'qpdf.exe');
    if (fsSync.existsSync(wingetPath)) return wingetPath;
    return 'qpdf.exe';
  }
  return 'qpdf';
}

/**
 * Encrypts a PDF with AES-256 using qpdf.
 * 
 * @param {Buffer} inputBuffer 
 * @param {object} config - { userPassword: string, ownerPassword?: string }
 * @param {function} emitProgress 
 * @returns {Promise<Buffer>} outputBuffer
 */
async function processProtectPdf(inputBuffer, config, emitProgress) {
  if (!config || !config.userPassword || typeof config.userPassword !== 'string' || !config.userPassword.trim()) {
    throw new Error('A user password is required to encrypt the PDF.');
  }

  const userPassword = config.userPassword;
  const ownerPassword = (config.ownerPassword && typeof config.ownerPassword === 'string' && config.ownerPassword.trim())
    ? config.ownerPassword
    : userPassword;

  emitProgress(25, 'Writing temporary files for encryption...');
  const tempDir = os.tmpdir();
  const fileId = uuidv4();
  const inputPath = path.join(tempDir, `protect-in-${fileId}.pdf`);
  const outputPath = path.join(tempDir, `protect-out-${fileId}.pdf`);

  await fs.writeFile(inputPath, inputBuffer);

  try {
    emitProgress(55, 'Applying 256-bit AES encryption via QPDF...');
    const bin = getQpdfBinary();
    const args = ['--encrypt', userPassword, ownerPassword, '256', '--', inputPath, outputPath];

    try {
      await execFileAsync(bin, args);
    } catch (execErr) {
      // Intentionally sanitize error message to avoid logging or exposing passwords
      console.error('[QPDF Protect] Encryption execution failed:', execErr.code || execErr.message);
      throw new Error('QPDF engine failed to encrypt the document. Ensure document is not already damaged or encrypted.');
    }

    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat || stat.size === 0) {
      throw new Error('Encrypted output file is empty or missing.');
    }

    emitProgress(90, 'Reading encrypted output...');
    const outputBuffer = await fs.readFile(outputPath);
    return outputBuffer;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

module.exports = {
  processProtectPdf,
  getQpdfBinary,
};
