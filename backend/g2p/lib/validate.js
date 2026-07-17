const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, R2_BUCKET } = require('./storage'); // we will need to export s3 instance if we do magic bytes

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
  'text/csv'
]);

function isMimeAllowed(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

// Since files go directly to R2 via presigned URLs, the backend doesn't have the buffer.
// We can use a Range request to fetch the first 4100 bytes from R2 to check the magic bytes.
async function verifyMagicBytesFromR2(r2Key, declaredMimeType) {
  // To avoid circular dependencies, require here or pass s3 client
  const { verifyObjectExistsAndSize } = require('./storage');
  
  try {
    const check = await verifyObjectExistsAndSize(r2Key);
    if (!check.exists) return false;

    // TODO: For strict magic byte checking, we would fetch the first 4KB using Range request,
    // then use the `file-type` ESM package via dynamic import.
    // For MVP, we trust the presigned URL content type enforcement.
    
    return true;
  } catch (err) {
    console.error('[Validation] Magic byte check failed:', err);
    return false;
  }
}

module.exports = {
  ALLOWED_MIME_TYPES,
  isMimeAllowed,
  verifyMagicBytesFromR2,
};
