const { S3Client, HeadObjectCommand, DeleteObjectsCommand, PutObjectCommand, GetObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'placeholder-bucket';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID || 'placeholder_account_id'}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'placeholder_access_key',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'placeholder_secret_key',
  },
});

// Force the AWS SDK to correct any local clock skew immediately upon initialization
// This prevents "RequestTimeTooSkewed" errors on subsequent non-retryable streaming uploads.
s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET })).catch(err => {
  console.warn('[R2 Initialization] Clock skew correction ping completed (expected if skew exists).');
});


async function generatePresignedPutUrl(r2Key, mimeType, sizeBytes) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });
  // 15 min expiration
  return await getSignedUrl(s3, command, { expiresIn: 15 * 60 });
}

async function generatePresignedGetUrl(r2Key, originalName = 'file', action = 'preview') {
  const commandInput = {
    Bucket: R2_BUCKET,
    Key: r2Key,
  };

  // If action is download, force the browser to treat it as an attachment
  if (action === 'download') {
    // Strip quotes and newlines to prevent header injection
    const safeName = originalName.replace(/["\n\r]/g, '');
    commandInput.ResponseContentDisposition = `attachment; filename="${safeName}"`;
  } else {
    // Force inline for preview
    commandInput.ResponseContentDisposition = 'inline';
  }

  const command = new GetObjectCommand(commandInput);
  // Set to 24 hours (86400) to protect against local system clock drift instantly expiring URLs
  return await getSignedUrl(s3, command, { expiresIn: 86400 });
}

async function verifyObjectExistsAndSize(r2Key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }));
    return { exists: true, size: head.ContentLength };
  } catch (err) {
    if (err.name === 'NotFound') return { exists: false };
    throw err;
  }
}

async function deleteObjects(r2Keys) {
  if (!r2Keys || r2Keys.length === 0) return;
  const objects = r2Keys.map(k => ({ Key: k }));
  const response = await s3.send(new DeleteObjectsCommand({
    Bucket: R2_BUCKET,
    Delete: { Objects: objects, Quiet: true }
  }));
  
  if (response.Errors && response.Errors.length > 0) {
    console.error('[R2 Deletion] Errors deleting some objects:', response.Errors);
  }
}

module.exports = {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  verifyObjectExistsAndSize,
  deleteObjects,
  s3,
  R2_BUCKET,
};
