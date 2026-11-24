'use strict';

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, R2_BUCKET } = require('./storage');

const HEAD_BYTES = 4096;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.ms-powerpoint', // ppt
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/plain',
  'text/csv',
]);

const ZIP_MIMES = ['application/zip', 'application/x-zip-compressed'];
const OLE_MIME = 'application/x-ole-storage';

// Detected signature → declared MIME types that may legitimately use it.
// A ZIP may be a plain zip or an Office Open XML file whose central directory
// falls outside the first 4 KB we read, so we accept ZIP for those too.
const ACCEPTED_SIGNATURES = {
  'application/pdf': ['application/pdf'],
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/gif': ['image/gif'],
  'image/webp': ['image/webp'],
  OLE_MIME: [
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
  ],
  'application/zip': [
    ...ZIP_MIMES,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
};

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE2_SIG = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ELF_SIG = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

function startsWith(buf, sig) {
  return buf.length >= sig.length && buf.subarray(0, sig.length).equals(sig);
}

function asciiAt(buf, offset, text) {
  return (
    buf.length >= offset + text.length &&
    buf.subarray(offset, offset + text.length).toString('latin1') === text
  );
}

/**
 * Identify a file from its leading bytes. No external dependency is used:
 * `file-type` v22 requires Node >= 22 while production Docker runs Node 20.
 * Returns a MIME string, or null when the bytes look like plain text.
 */
function detectMimeFromHead(head) {
  if (!head || head.length === 0) return null;

  if (asciiAt(head, 0, '%PDF-')) return 'application/pdf';
  if (startsWith(head, PNG_SIG)) return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (asciiAt(head, 0, 'GIF87a') || asciiAt(head, 0, 'GIF89a')) return 'image/gif';
  if (asciiAt(head, 0, 'RIFF') && asciiAt(head, 8, 'WEBP')) return 'image/webp';
  if (startsWith(head, OLE2_SIG)) return OLE_MIME;
  if (startsWith(head, ELF_SIG)) return 'application/x-executable';
  if (asciiAt(head, 0, 'MZ')) return 'application/x-executable';
  if (asciiAt(head, 0, '#!')) return 'application/x-script';

  if (
    asciiAt(head, 0, 'PK\x03\x04') ||
    asciiAt(head, 0, 'PK\x05\x06') ||
    asciiAt(head, 0, 'PK\x07\x08')
  ) {
    const text = head.toString('latin1');
    if (text.includes('word/document.xml')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (text.includes('xl/workbook.xml')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (text.includes('ppt/presentation.xml')) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    return 'application/zip';
  }

  return null;
}

function looksLikeText(head) {
  if (!head || head.length === 0) return false;
  const slice = head.subarray(0, Math.min(head.length, 2048));
  if (slice.includes(0)) return false;
  let controlChars = 0;
  for (const byte of slice) {
    if (byte < 9 || (byte > 13 && byte < 32)) controlChars++;
  }
  return controlChars / slice.length < 0.02;
}

function isMimeAllowed(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

async function readHeadFromR2(r2Key) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Range: `bytes=0-${HEAD_BYTES - 1}`,
  });
  const response = await s3.send(command);
  const chunks = [];
  try {
    for await (const chunk of response.Body) {
      chunks.push(Buffer.from(chunk));
      if (Buffer.concat(chunks).length >= HEAD_BYTES) break;
    }
  } finally {
    if (response.Body && typeof response.Body.destroy === 'function') {
      response.Body.destroy();
    }
  }
  return Buffer.concat(chunks).subarray(0, HEAD_BYTES);
}

/** Detailed result, useful for logs and tests. */
async function inspectMagicBytesFromR2(r2Key, declaredMimeType) {
  if (process.env.DISABLE_MAGIC_BYTE_CHECK === 'true') {
    return { ok: true, detected: null, reason: 'check_disabled_by_env' };
  }

  try {
    const head = await readHeadFromR2(r2Key);
    const detected = detectMimeFromHead(head);

    if (declaredMimeType === 'application/json') {
      const first = head.toString('utf8').trimStart()[0];
      const ok = detected === null && (first === '{' || first === '[');
      return { ok, detected, reason: ok ? 'ok' : 'not_json' };
    }

    if (declaredMimeType === 'text/plain' || declaredMimeType === 'text/csv') {
      const ok = detected === null && looksLikeText(head);
      return { ok, detected, reason: ok ? 'ok' : 'not_text' };
    }

    const allowed = ACCEPTED_SIGNATURES[detected] || [];
    const ok = allowed.includes(declaredMimeType);
    return {
      ok,
      detected,
      reason: ok ? 'ok' : `signature_mismatch:${detected || 'unknown'}`,
    };
  } catch (err) {
    console.error('[Validation] Magic byte check failed:', err.message);
    return { ok: false, detected: null, reason: 'read_error' };
  }
}

/** Boolean convenience wrapper used by upload-completion routes. */
async function verifyMagicBytesFromR2(r2Key, declaredMimeType) {
  const result = await inspectMagicBytesFromR2(r2Key, declaredMimeType);
  if (!result.ok) {
    console.warn(
      `[Validation] Rejected ${r2Key}: declared=${declaredMimeType}, ` +
        `detected=${result.detected || 'unknown'}, reason=${result.reason}`
    );
  }
  return result.ok;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  detectMimeFromHead,
  inspectMagicBytesFromR2,
  isMimeAllowed,
  verifyMagicBytesFromR2,
};
