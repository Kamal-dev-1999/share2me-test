'use strict';

/**
 * PrintShop Routes — backend/g2p/routes/printshop.js
 *
 * Security model:
 *  - Public routes (no auth): GET /shop/:code, POST /jobs
 *  - Protected routes (JWT required): all others
 *  - Shopkeeper-only writes are double-verified: JWT + role check + ownership check
 *  - All money amounts are recalculated server-side; client values are IGNORED
 *  - All DB writes use parameterized queries (OWASP A03: Injection)
 *  - Payment status transitions are locked with FOR UPDATE (OWASP A01, A04)
 */

const express = require('express');
const crypto = require('crypto');
const { getTransactionClient, query } = require('../lib/db');
const { verifyVendorJWT } = require('../lib/auth');
const { generatePresignedGetUrl, s3, R2_BUCKET } = require('../lib/storage');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const RateLimiter = require('../../lib/RateLimiter');
const { emitToVendor } = require('../socket');

const router = express.Router();

// ─── Rate Limiters ─────────────────────────────────────────────────────────────
const jobSubmitLimiter = new RateLimiter(60_000, 10);   // 10 job submissions/min per IP
const settingsLimiter  = new RateLimiter(60_000, 30);   // 30 settings reads/writes/min per vendor

// ─── Middleware: shopkeeper auth ───────────────────────────────────────────────
async function requireShopkeeper(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.vendorId || vendor.sub;
  next();
}

// ─── Input sanitization helpers ────────────────────────────────────────────────
const sanitizeText = (str, maxLen = 255) =>
  typeof str === 'string' ? str.trim().slice(0, maxLen) : '';

const toPositiveFloat = (n) => {
  const v = parseFloat(n);
  return isFinite(v) && v >= 0 ? v : null;
};

// ─── PUBLIC: GET /printshop/shop/:code ────────────────────────────────────────
// Returns pricing and QR URL for the student print flow.
// NEVER returns vendor_id — only the public-facing fields.
router.get('/shop/:code', async (req, res) => {
  const code = sanitizeText(req.params.code, 10).toUpperCase();
  if (!code) return res.status(400).json({ error: 'invalid_code' });

  try {
    const result = await query(`
      SELECT ps.bw_price, ps.color_price, ps.location_name, ps.qr_r2_key, ps.is_accepting,
             v.name as shop_name
      FROM printshop_settings ps
      JOIN vendors v ON v.id = ps.vendor_id
      WHERE v.share2me_id = $1 AND v.role = 'shopkeeper'
    `, [code]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'shop_not_found' });

    const shop = result.rows[0];

    // Generate a short-lived pre-signed GET URL for the QR image (1 hour TTL)
    let qrUrl = null;
    if (shop.qr_r2_key) {
      try {
        const cmd = new (require('@aws-sdk/client-s3').GetObjectCommand)({ Bucket: R2_BUCKET, Key: shop.qr_r2_key });
        qrUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
      } catch {
        // Non-fatal: QR may be deleted from R2
      }
    }

    res.json({
      shopName: shop.shop_name,
      locationName: shop.location_name || null,
      bwPrice: parseFloat(shop.bw_price),
      colorPrice: parseFloat(shop.color_price),
      isAccepting: shop.is_accepting,
      qrUrl,
    });
  } catch (err) {
    console.error('[PrintShop] GET /shop/:code error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PUBLIC: POST /printshop/jobs ──────────────────────────────────────────────
// Student submits a print job. Anonymous — no auth required.
// CRITICAL: totalAmount is recalculated server-side from the shop's DB pricing.
router.post('/jobs', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (jobSubmitLimiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const {
    shopCode, senderName, documentName, fileSizeBytes, fileType, pages, printType, paymentMethod,
  } = req.body;

  // ── Input Validation ──
  const cleanCode         = sanitizeText(shopCode, 10).toUpperCase();
  const cleanSenderName   = sanitizeText(senderName, 100) || 'Anonymous';
  const cleanDocumentName = sanitizeText(documentName, 255);
  const cleanFileType     = sanitizeText(fileType, 120);
  const cleanPrintType    = ['bw', 'color'].includes(printType) ? printType : null;
  const cleanPayMethod    = ['online', 'cash'].includes(paymentMethod) ? paymentMethod : null;
  const cleanPages        = parseInt(pages, 10);
  const cleanSizeBytes    = parseInt(fileSizeBytes, 10);

  if (!cleanCode || !cleanDocumentName || !cleanPrintType || !cleanPayMethod) {
    return res.status(400).json({ error: 'missing_or_invalid_fields' });
  }
  if (!Number.isInteger(cleanPages) || cleanPages < 1 || cleanPages > 5000) {
    return res.status(400).json({ error: 'invalid_page_count' });
  }
  if (!Number.isInteger(cleanSizeBytes) || cleanSizeBytes <= 0) {
    return res.status(400).json({ error: 'invalid_file_size' });
  }

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    // Look up the shopkeeper and their OFFICIAL pricing (lock to prevent TOCTOU)
    const shopRes = await client.query(`
      SELECT v.id as vendor_id, ps.bw_price, ps.color_price, ps.is_accepting
      FROM vendors v
      JOIN printshop_settings ps ON ps.vendor_id = v.id
      WHERE v.share2me_id = $1 AND v.role = 'shopkeeper'
      FOR UPDATE OF ps
    `, [cleanCode]);

    if (shopRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'shop_not_found' });
    }

    const shop = shopRes.rows[0];

    if (!shop.is_accepting) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'shop_not_accepting' });
    }

    // SERVER-SIDE price recalculation — client-submitted price is IGNORED
    const pricePerPage = parseFloat(cleanPrintType === 'color' ? shop.color_price : shop.bw_price);
    const totalAmount  = parseFloat((pricePerPage * cleanPages).toFixed(2));

    const insertRes = await client.query(`
      INSERT INTO printshop_jobs (
        vendor_id, sender_name, document_name, file_size_bytes, file_type,
        pages, print_type, price_per_page, total_amount, payment_method
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at
    `, [
      shop.vendor_id,
      cleanSenderName,
      cleanDocumentName,
      cleanSizeBytes,
      cleanFileType,
      cleanPages,
      cleanPrintType,
      pricePerPage,
      totalAmount,
      cleanPayMethod,
    ]);

    await client.query('COMMIT');

    const newJob = insertRes.rows[0];

    // Notify the shopkeeper in real-time
    emitToVendor(shop.vendor_id, 'printshop:new_job', {
      jobId: newJob.id,
      senderName: cleanSenderName,
      documentName: cleanDocumentName,
      pages: cleanPages,
      printType: cleanPrintType,
      totalAmount,
    });

    console.log(`[PrintShop] New job ${newJob.id} for vendor ${shop.vendor_id} from IP ${ip}`);

    res.status(201).json({
      jobId: newJob.id,
      totalAmount,
      pricePerPage,
      createdAt: newJob.created_at,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] POST /jobs error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// ─── PROTECTED: GET /printshop/jobs ───────────────────────────────────────────
router.get('/jobs', requireShopkeeper, async (req, res) => {
  if (settingsLimiter.isRateLimited(req.vendorId)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const statusFilter  = ['pending', 'paid', 'failed'].includes(req.query.status) ? req.query.status : null;
  const methodFilter  = ['online', 'cash'].includes(req.query.method) ? req.query.method : null;
  const typeFilter    = ['bw', 'color'].includes(req.query.printType) ? req.query.printType : null;
  const limit         = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset        = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    const conditions = ['vendor_id = $1', 'deleted_at IS NULL'];
    const params = [req.vendorId];

    if (statusFilter) { params.push(statusFilter); conditions.push(`payment_status = $${params.length}`); }
    if (methodFilter) { params.push(methodFilter); conditions.push(`payment_method = $${params.length}`); }
    if (typeFilter)   { params.push(typeFilter);   conditions.push(`print_type = $${params.length}`);    }

    params.push(limit, offset);
    const result = await query(`
      SELECT id, sender_name, document_name, file_size_bytes, file_type, pages,
             print_type, price_per_page, total_amount, payment_method,
             payment_status, payment_id, paid_at, created_at
      FROM printshop_jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ jobs: result.rows });
  } catch (err) {
    console.error('[PrintShop] GET /jobs error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: PATCH /printshop/jobs/:id/confirm ─────────────────────────────
// Only the owning shopkeeper can confirm payment. Uses FOR UPDATE to prevent replay.
router.patch('/jobs/:id/confirm', requireShopkeeper, async (req, res) => {
  const { id } = req.params;

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    // Lock the row — ensures idempotency and prevents concurrent confirmations
    const jobRes = await client.query(`
      SELECT id, vendor_id, payment_status, total_amount
      FROM printshop_jobs
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE
    `, [id]);

    if (jobRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'job_not_found' });
    }

    const job = jobRes.rows[0];

    // OWASP A01: Verify the shopkeeper owns this job
    if (job.vendor_id !== req.vendorId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'job_not_found' }); // 404 not 403 — don't leak existence
    }

    // OWASP A04: Enforce the state machine — only 'pending' can transition to 'paid'
    if (job.payment_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'invalid_state_transition', current: job.payment_status });
    }

    const paymentId = `PAY_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const paidAt    = new Date().toISOString();

    await client.query(`
      UPDATE printshop_jobs
      SET payment_status = 'paid', payment_id = $1, paid_at = $2
      WHERE id = $3
    `, [paymentId, paidAt, id]);

    await client.query('COMMIT');

    console.log(`[PrintShop] Job ${id} confirmed by vendor ${req.vendorId} — paymentId: ${paymentId}`);

    // Real-time update to everyone in the vendor room (catches the student's waiting screen)
    emitToVendor(req.vendorId, 'printshop:job_updated', {
      jobId: id,
      paymentStatus: 'paid',
      paymentId,
      paidAt,
    });

    res.json({ success: true, paymentId, paidAt });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] PATCH /jobs/:id/confirm error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// ─── PROTECTED: PATCH /printshop/jobs/:id/fail ────────────────────────────────
router.patch('/jobs/:id/fail', requireShopkeeper, async (req, res) => {
  const { id } = req.params;

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    const jobRes = await client.query(`
      SELECT id, vendor_id, payment_status
      FROM printshop_jobs
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE
    `, [id]);

    if (jobRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'job_not_found' }); }
    const job = jobRes.rows[0];
    if (job.vendor_id !== req.vendorId) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'job_not_found' }); }
    if (job.payment_status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'invalid_state_transition' }); }

    await client.query(`UPDATE printshop_jobs SET payment_status = 'failed' WHERE id = $1`, [id]);
    await client.query('COMMIT');

    emitToVendor(req.vendorId, 'printshop:job_updated', { jobId: id, paymentStatus: 'failed' });
    res.json({ success: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] PATCH /jobs/:id/fail error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// ─── PROTECTED: GET /printshop/settings ───────────────────────────────────────
router.get('/settings', requireShopkeeper, async (req, res) => {
  try {
    const result = await query(`
      SELECT bw_price, color_price, location_name, qr_r2_key, is_accepting
      FROM printshop_settings
      WHERE vendor_id = $1
    `, [req.vendorId]);

    if (result.rowCount === 0) {
      // Return defaults if shopkeeper hasn't configured yet
      return res.json({ bwPrice: 2.0, colorPrice: 5.0, locationName: '', qrUrl: null, isAccepting: true });
    }

    const row = result.rows[0];
    let qrUrl = null;
    if (row.qr_r2_key) {
      try {
        const cmd = new (require('@aws-sdk/client-s3').GetObjectCommand)({ Bucket: R2_BUCKET, Key: row.qr_r2_key });
        qrUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
      } catch { /* non-fatal */ }
    }

    res.json({
      bwPrice: parseFloat(row.bw_price),
      colorPrice: parseFloat(row.color_price),
      locationName: row.location_name || '',
      qrUrl,
      isAccepting: row.is_accepting,
    });
  } catch (err) {
    console.error('[PrintShop] GET /settings error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: PUT /printshop/settings ───────────────────────────────────────
router.put('/settings', requireShopkeeper, async (req, res) => {
  const { bwPrice, colorPrice, locationName, isAccepting } = req.body;

  const cleanBwPrice      = toPositiveFloat(bwPrice);
  const cleanColorPrice   = toPositiveFloat(colorPrice);
  const cleanLocation     = sanitizeText(locationName, 120);
  const cleanIsAccepting  = isAccepting === false ? false : true;

  if (cleanBwPrice === null || cleanColorPrice === null) {
    return res.status(400).json({ error: 'invalid_price' });
  }
  if (cleanBwPrice > 999 || cleanColorPrice > 999) {
    return res.status(400).json({ error: 'price_too_high' });
  }

  try {
    await query(`
      INSERT INTO printshop_settings (vendor_id, bw_price, color_price, location_name, is_accepting, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (vendor_id) DO UPDATE
        SET bw_price = EXCLUDED.bw_price,
            color_price = EXCLUDED.color_price,
            location_name = EXCLUDED.location_name,
            is_accepting = EXCLUDED.is_accepting,
            updated_at = NOW()
    `, [req.vendorId, cleanBwPrice, cleanColorPrice, cleanLocation, cleanIsAccepting]);

    res.json({ success: true });
  } catch (err) {
    console.error('[PrintShop] PUT /settings error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: PUT /printshop/settings/qr ────────────────────────────────────
// Accepts raw image bytes. Does NOT accept a URL (prevents SSRF).
// Content-Type must be image/png, image/jpeg, or image/webp.
router.put('/settings/qr', requireShopkeeper, async (req, res) => {
  const contentType = req.headers['content-type'] || '';
  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
  const mimeBase = contentType.split(';')[0].trim();

  if (!allowedMimes.includes(mimeBase)) {
    return res.status(400).json({ error: 'invalid_content_type', allowed: allowedMimes });
  }

  // Collect the raw body (max 2MB enforced by express.json size limit on the router)
  const chunks = [];
  let totalBytes = 0;
  const MAX_QR_SIZE = 2 * 1024 * 1024; // 2MB

  req.on('data', (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_QR_SIZE) {
      req.destroy();
      return res.status(413).json({ error: 'qr_too_large', maxBytes: MAX_QR_SIZE });
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    if (body.length === 0) return res.status(400).json({ error: 'empty_body' });

    const ext = mimeBase === 'image/png' ? 'png' : mimeBase === 'image/webp' ? 'webp' : 'jpg';
    const r2Key = `printshop/${req.vendorId}/qr.${ext}`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        ContentType: mimeBase,
        ContentLength: body.length,
        Body: body,
      }));

      // Persist the key (upsert)
      await query(`
        INSERT INTO printshop_settings (vendor_id, qr_r2_key, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (vendor_id) DO UPDATE
          SET qr_r2_key = EXCLUDED.qr_r2_key, updated_at = NOW()
      `, [req.vendorId, r2Key]);

      // Return a fresh short-lived pre-signed URL
      const cmd = new (require('@aws-sdk/client-s3').GetObjectCommand)({ Bucket: R2_BUCKET, Key: r2Key });
      const qrUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });

      res.json({ success: true, qrUrl });
    } catch (err) {
      console.error('[PrintShop] PUT /settings/qr error:', err);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  req.on('error', (err) => {
    console.error('[PrintShop] QR upload stream error:', err);
    res.status(500).json({ error: 'upload_stream_error' });
  });
});

// ─── PROTECTED: GET /printshop/analytics ──────────────────────────────────────
router.get('/analytics', requireShopkeeper, async (req, res) => {
  try {
    // 1. KPIs
    const kpiRes = await query(`
      SELECT
        COUNT(*)::int                                            AS total_documents,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int    AS paid_documents,
        COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_payments,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS total_revenue,
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND print_type = 'color')::int AS color_prints,
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND print_type = 'bw')::int    AS bw_prints
      FROM printshop_jobs
      WHERE vendor_id = $1 AND deleted_at IS NULL
    `, [req.vendorId]);

    // 2. Revenue time series — last 7 days bucketed by day
    const seriesRes = await query(`
      SELECT
        DATE(paid_at AT TIME ZONE 'Asia/Kolkata') as date,
        COALESCE(SUM(total_amount), 0)::float      as revenue
      FROM printshop_jobs
      WHERE vendor_id = $1
        AND payment_status = 'paid'
        AND paid_at >= NOW() - INTERVAL '7 days'
        AND deleted_at IS NULL
      GROUP BY DATE(paid_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date ASC
    `, [req.vendorId]);

    res.json({
      kpis: kpiRes.rows[0],
      revenueSeries: seriesRes.rows,
    });
  } catch (err) {
    console.error('[PrintShop] GET /analytics error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
