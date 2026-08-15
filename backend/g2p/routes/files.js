const express = require('express');
const crypto = require('crypto');
const { getTransactionClient, query } = require('../lib/db');
const { isMimeAllowed } = require('../lib/validate');
const { generatePresignedPutUrl, verifyObjectExistsAndSize } = require('../lib/storage');
const RateLimiter = require('../../lib/RateLimiter');

const router = express.Router();
const presignLimiter = new RateLimiter(60_000, 40); // 40 presign calls/min per IP

// Generate presigned URL for upload
router.post('/presign', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (presignLimiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { requestId, statusToken, originalName, mimeType, sizeBytes } = req.body;
  if (!requestId || !statusToken || !originalName || !mimeType || !sizeBytes) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  
  if (!isMimeAllowed(mimeType)) {
    return res.status(400).json({ error: 'invalid_file_type' });
  }

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    // Verify request ownership and get vendor plan_type
    const reqCheck = await client.query(`
      SELECT r.id, r.vendor_id, v.plan_type 
      FROM requests r
      JOIN vendors v ON r.vendor_id = v.id
      WHERE r.id = $1 AND r.status_token = $2 AND r.deleted_at IS NULL
      FOR UPDATE
    `, [requestId, statusToken]);

    if (reqCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'request_not_found' });
    }
    const vendorId = reqCheck.rows[0].vendor_id;
    const planType = reqCheck.rows[0].plan_type || 'FREE';

    // Enforce plan-aware quotas
    const MAX_SIZES = {
      FREE: 50 * 1024 * 1024,
      PRO: 500 * 1024 * 1024
    };
    const maxSize = MAX_SIZES[planType] || MAX_SIZES.FREE;

    if (sizeBytes > maxSize) {
      await client.query('ROLLBACK');
      return res.status(413).json({ 
        error: 'payload_too_large', 
        maxSize, 
        message: `File exceeds the maximum limit for ${planType} plan.`
      });
    }

    // Retry flow check: delete stale pending_upload rows for this exact file request to avoid cap collisions
    await client.query(`
      DELETE FROM files 
      WHERE request_id = $1 AND original_name = $2 AND size_bytes = $3 AND status = 'pending_upload'
    `, [requestId, originalName, sizeBytes]);

    // Cap 1: 10 files per request
    const fileCountRes = await client.query('SELECT COUNT(*) FROM files WHERE request_id = $1', [requestId]);
    if (parseInt(fileCountRes.rows[0].count, 10) >= 10) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'too_many_files' });
    }

    // Cap 2: 1GB total active storage per vendor
    const vendorStorageRes = await client.query(`
      SELECT COALESCE(SUM(f.size_bytes), 0) as total_bytes 
      FROM files f
      JOIN requests r ON r.id = f.request_id
      WHERE r.vendor_id = $1 AND r.deleted_at IS NULL AND f.status != 'deleted'
    `, [vendorId]);
    
    const totalBytes = parseInt(vendorStorageRes.rows[0].total_bytes, 10);
    if (totalBytes + sizeBytes > 1024 * 1024 * 1024) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'vendor_storage_full' });
    }

    // Generate unique R2 key
    const r2Key = `g2p/${vendorId}/${requestId}/${crypto.randomUUID()}`;

    // Insert pending file
    const insertRes = await client.query(`
      INSERT INTO files (request_id, original_name, size_bytes, mime_type, r2_key)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [requestId, originalName, sizeBytes, mimeType, r2Key]);

    const fileId = insertRes.rows[0].id;

    await client.query('COMMIT');

    const presignedUrl = await generatePresignedPutUrl(r2Key, mimeType, sizeBytes);

    res.json({ fileId, presignedUrl });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[G2P] Presign error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// Confirm upload
router.post('/:fileId/complete', async (req, res) => {
  const { fileId } = req.params;
  const { statusToken } = req.body;

  try {
    // 1. Fetch file and verify ownership
    const fileRes = await query(`
      SELECT f.id, f.r2_key, f.size_bytes, f.mime_type, f.original_name, r.status_token, r.vendor_id, r.id as request_id, r.device_metadata
      FROM files f
      JOIN requests r ON f.request_id = r.id
      WHERE f.id = $1 AND f.status = 'pending_upload'
    `, [fileId]);

    if (fileRes.rowCount === 0) return res.status(404).json({ error: 'file_not_found' });
    
    const fileRow = fileRes.rows[0];
    if (fileRow.status_token !== statusToken) return res.status(403).json({ error: 'unauthorized' });

    // 2. Layer 1 Validation: Check R2
    const objectCheck = await verifyObjectExistsAndSize(fileRow.r2_key);
    
    if (!objectCheck.exists) {
      // The file was not actually uploaded to R2, or upload failed.
      return res.status(400).json({ error: 'upload_not_found' });
    }
    
    if (objectCheck.size !== parseInt(fileRow.size_bytes, 10)) {
      console.warn(`[G2P] Size mismatch for ${fileId}: declared ${fileRow.size_bytes}, actual ${objectCheck.size}. Rejecting.`);
      return res.status(400).json({ error: 'upload_size_mismatch' });
    }

    // 3. Mark as received
    await query(`UPDATE files SET status = 'received' WHERE id = $1`, [fileId]);

    // 3.5 Log Analytics Event
    const senderName = fileRow.device_metadata?.senderName || 'Anonymous';
    await query(`
      INSERT INTO g2p_analytics_events 
      (vendor_id, sender_name, event_type, file_size_bytes, file_type, user_agent, file_name)
      VALUES ($1, $2, 'upload_received', $3, $4, $5, $6)
    `, [
      fileRow.vendor_id,
      senderName,
      fileRow.size_bytes,
      fileRow.mime_type,
      req.headers['user-agent'] || 'Unknown',
      fileRow.original_name
    ]).catch(err => console.error('[G2P] Analytics insert error:', err));

    // 4. Broadcast 'g2p:new_submission' to vendor socket room
    const { emitToVendor } = require('../socket');
    emitToVendor(fileRow.vendor_id, 'g2p:new_submission', { request_id: fileRow.request_id });
    
    res.json({ success: true });
  } catch (err) {
    console.error('[G2P] Complete upload error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Proxy Upload (Bypasses Browser CORS / Adblockers)
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3, R2_BUCKET } = require('../lib/storage');

router.put('/:fileId/upload', async (req, res) => {
  const { fileId } = req.params;
  const statusToken = req.headers['x-status-token'];

  try {
    const fileRes = await query(`
      SELECT f.id, f.r2_key, f.size_bytes, f.mime_type, r.status_token 
      FROM files f JOIN requests r ON f.request_id = r.id 
      WHERE f.id = $1 AND f.status = 'pending_upload'
    `, [fileId]);

    if (fileRes.rowCount === 0) return res.status(404).json({ error: 'file_not_found' });
    if (fileRes.rows[0].status_token !== statusToken) return res.status(403).json({ error: 'unauthorized' });

    // Stream the incoming request directly to Cloudflare R2
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileRes.rows[0].r2_key,
      ContentType: fileRes.rows[0].mime_type,
      ContentLength: parseInt(fileRes.rows[0].size_bytes, 10),
      Body: req
    }));

    res.json({ success: true });
  } catch (err) {
    console.error('[G2P] Proxy upload error:', err);
    res.status(500).json({ error: 'upload_failed' });
  }
});

module.exports = router;
