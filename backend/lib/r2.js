const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Ensure these are loaded in your .env
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'g2p-tools';

let s3Client;

if (accountId && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
} else {
  console.warn('[R2] Missing Cloudflare R2 credentials. R2 operations will fail if called.');
}

/**
 * Generate a presigned URL for uploading a file directly to R2.
 * @param {string} key - The destination key (e.g., 'tools/input/1234-file.pdf')
 * @param {number} expiresIn - Expiration in seconds
 */
async function getUploadUrl(key, expiresIn = 3600) {
  if (!s3Client) throw new Error('R2 Client not configured');
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading a file directly from R2.
 * @param {string} key - The file key
 * @param {number} expiresIn - Expiration in seconds
 */
async function getDownloadUrl(key, expiresIn = 3600) {
  if (!s3Client) throw new Error('R2 Client not configured');
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

module.exports = {
  s3Client,
  bucketName,
  getUploadUrl,
  getDownloadUrl,
};
