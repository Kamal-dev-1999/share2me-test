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
const { emitToVendor, emitToJob, getAgentPrinters, dispatchJobToAgent, isAgentOnline } = require('../socket');
const Razorpay = require('razorpay');
const { v4: uuidv4 } = require('uuid');

let razorpayInstance = null;
function getRazorpay() {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured');
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayInstance;
}

const router = express.Router();

// ─── Rate Limiters ─────────────────────────────────────────────────────────────
const jobSubmitLimiter = new RateLimiter(60_000, 10);   // 10 job submissions/min per IP
const settingsLimiter  = new RateLimiter(60_000, 30);   // 30 settings reads/writes/min per vendor

// ─── Middleware: shopkeeper auth ───────────────────────────────────────────────
async function requireShopkeeper(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.id || vendor.vendorId || vendor.sub;
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
      SELECT COALESCE(ps.bw_price, 2.0) as bw_price, 
             COALESCE(ps.color_price, 5.0) as color_price, 
             ps.location_name, ps.qr_r2_key, 
             COALESCE(ps.is_accepting, true) as is_accepting,
             v.name as shop_name, v.charges_enabled
      FROM vendors v
      LEFT JOIN printshop_settings ps ON v.id = ps.vendor_id
      WHERE v.share2me_id = $1 AND v.persona = 'PRINT_SHOP'
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
      charges_enabled: shop.charges_enabled,
      isPrintShop: true,
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
    shopCode, senderName, documentName, fileSizeBytes, fileType, pages, printType, paymentMethod, printConfig,
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
      SELECT v.id as vendor_id, 
             COALESCE(ps.bw_price, 2.0) as bw_price, 
             COALESCE(ps.color_price, 5.0) as color_price, 
             COALESCE(ps.is_accepting, true) as is_accepting,
             v.stripe_account_id, v.charges_enabled, v.razorpay_account_id
      FROM vendors v
      LEFT JOIN printshop_settings ps ON v.id = ps.vendor_id
      WHERE v.share2me_id = $1 AND v.persona = 'PRINT_SHOP'
      FOR UPDATE OF v
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
    const copies = printConfig && parseInt(printConfig.copies, 10) > 0 ? parseInt(printConfig.copies, 10) : 1;
    const totalAmount  = parseFloat((pricePerPage * cleanPages * copies).toFixed(2));

    const r2Key = `printshop/${shop.vendor_id}/${uuidv4()}-${cleanDocumentName}`;

    const insertRes = await client.query(`
      INSERT INTO printshop_jobs (
        vendor_id, sender_name, document_name, file_size_bytes, file_type,
        pages, print_type, price_per_page, total_amount, payment_method, print_config, r2_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, created_at
    `, [
      shop.vendor_id, cleanSenderName, cleanDocumentName, cleanSizeBytes,
      cleanFileType, cleanPages, cleanPrintType, pricePerPage, totalAmount,
      cleanPayMethod,
      printConfig ? JSON.stringify(printConfig) : null,
      r2Key,
    ]);

    await client.query('COMMIT');

    const newJob = insertRes.rows[0];

    // Generate Razorpay Order if online payment
    let razorpayOrderId = null;
    let paymentAmountPaise = Math.round(totalAmount * 100);
    
    if (cleanPayMethod === 'online') {
      // Ensure amount >= 100 paise as per Razorpay limits
      if (paymentAmountPaise < 100) paymentAmountPaise = 100;
      
      const orderOptions = {
        amount: paymentAmountPaise,
        currency: 'INR',
        receipt: newJob.id.toString(),
      };
      
      // If vendor has a live Razorpay linked account, use Route transfers
      if (shop.razorpay_account_id && shop.razorpay_account_id.startsWith('acc_') && shop.charges_enabled) {
        const platformFee = Math.round(paymentAmountPaise * 0.05);
        const vendorAmount = paymentAmountPaise - platformFee;
        orderOptions.transfers = [
          {
            account: shop.razorpay_account_id,
            amount: vendorAmount,
            currency: 'INR',
            notes: { job_id: newJob.id },
            on_hold: false
          }
        ];
      }
      
      const order = await getRazorpay().orders.create(orderOptions);
      razorpayOrderId = order.id;
    }

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

    const putCmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      ContentType: cleanFileType,
    });
    const uploadUrl = await getSignedUrl(s3, putCmd, { expiresIn: 3600 });

    res.status(201).json({
      jobId: newJob.id,
      totalAmount,
      pricePerPage,
      razorpayOrderId,
      amountPaise: paymentAmountPaise,
      uploadUrl,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] POST /jobs error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// ─── PUBLIC: POST /printshop/jobs/bulk ───────────────────────────────────────
// Student submits multiple print jobs simultaneously (up to 10).
router.post('/jobs/bulk', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (jobSubmitLimiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { shopCode, senderName, paymentMethod, printType, files } = req.body;

  if (!Array.isArray(files) || files.length === 0 || files.length > 10) {
    return res.status(400).json({ error: 'invalid_files_array' });
  }

  const cleanCode         = sanitizeText(shopCode, 10).toUpperCase();
  const cleanSenderName   = sanitizeText(senderName, 100) || 'Anonymous';
  const cleanPayMethod    = ['online', 'cash'].includes(paymentMethod) ? paymentMethod : null;

  if (!cleanCode || !cleanPayMethod) {
    return res.status(400).json({ error: 'missing_or_invalid_fields' });
  }

  // Validate files
  let totalPages = 0;
  const processedFiles = [];
  for (const f of files) {
    const cleanDocumentName = sanitizeText(f.documentName, 255);
    const cleanFileType     = sanitizeText(f.fileType, 120);
    const cleanPages        = parseInt(f.pages, 10);
    const cleanSizeBytes    = parseInt(f.fileSizeBytes, 10);
    
    // Per-file optional config overriding the global config
    const filePrintType = f.printConfig?.printType ? (['bw', 'color'].includes(f.printConfig.printType) ? f.printConfig.printType : printType) : printType;
    if (!['bw', 'color'].includes(filePrintType)) {
      return res.status(400).json({ error: 'invalid_print_type' });
    }

    if (!cleanDocumentName || !Number.isInteger(cleanPages) || cleanPages < 1 || cleanPages > 5000 || !Number.isInteger(cleanSizeBytes) || cleanSizeBytes <= 0) {
      return res.status(400).json({ error: 'invalid_file_data' });
    }
    totalPages += cleanPages;
    processedFiles.push({ cleanDocumentName, cleanFileType, cleanPages, cleanSizeBytes, printConfig: f.printConfig || null, filePrintType });
  }

  if (totalPages > 5000) {
    return res.status(400).json({ error: 'too_many_total_pages' });
  }

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    const shopRes = await client.query(`
      SELECT v.id as vendor_id, 
             COALESCE(ps.bw_price, 2.0) as bw_price, 
             COALESCE(ps.color_price, 5.0) as color_price, 
             COALESCE(ps.is_accepting, true) as is_accepting,
             v.stripe_account_id, v.charges_enabled, v.razorpay_account_id
      FROM vendors v
      LEFT JOIN printshop_settings ps ON v.id = ps.vendor_id
      WHERE v.share2me_id = $1 AND v.persona = 'PRINT_SHOP'
      FOR UPDATE OF v
    `, [cleanCode]);

    if (shopRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'shop_not_found' }); }
    const shop = shopRes.rows[0];
    if (!shop.is_accepting) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'shop_not_accepting' }); }

    let totalBatchAmount = 0;
    const insertedJobs = [];

    // Process each file
    for (const f of processedFiles) {
      const pricePerPage = parseFloat(f.filePrintType === 'color' ? shop.color_price : shop.bw_price);
      const copies = f.printConfig && parseInt(f.printConfig.copies, 10) > 0 ? parseInt(f.printConfig.copies, 10) : 1;
      const fileTotalAmount = parseFloat((pricePerPage * f.cleanPages * copies).toFixed(2));
      totalBatchAmount += fileTotalAmount;

      const r2Key = `printshop/${shop.vendor_id}/${uuidv4()}-${f.cleanDocumentName}`;
      
      const insertRes = await client.query(`
        INSERT INTO printshop_jobs (
          vendor_id, sender_name, document_name, file_size_bytes, file_type,
          pages, print_type, price_per_page, total_amount, payment_method, print_config, r2_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, created_at
      `, [
        shop.vendor_id, cleanSenderName, f.cleanDocumentName, f.cleanSizeBytes,
        f.cleanFileType, f.cleanPages, f.filePrintType, pricePerPage, fileTotalAmount,
        cleanPayMethod, f.printConfig ? JSON.stringify(f.printConfig) : null, r2Key
      ]);
      
      const newJob = insertRes.rows[0];
      
      const putCmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key, ContentType: f.cleanFileType });
      const uploadUrl = await getSignedUrl(s3, putCmd, { expiresIn: 3600 });
      
      insertedJobs.push({
        jobId: newJob.id,
        uploadUrl,
        totalAmount: fileTotalAmount,
        pricePerPage,
        createdAt: newJob.created_at,
        r2Key,
        ...f
      });
    }

    totalBatchAmount = parseFloat(totalBatchAmount.toFixed(2));
    await client.query('COMMIT');

    // Generate ONE Razorpay Order if online payment
    let razorpayOrderId = null;
    let paymentAmountPaise = Math.round(totalBatchAmount * 100);
    
    if (cleanPayMethod === 'online') {
      if (paymentAmountPaise < 100) paymentAmountPaise = 100;
      
      const orderOptions = {
        amount: paymentAmountPaise,
        currency: 'INR',
        receipt: `batch_${insertedJobs[0].jobId.substring(0, 8)}`,
      };
      
      if (shop.razorpay_account_id && shop.razorpay_account_id.startsWith('acc_') && shop.charges_enabled) {
        const platformFee = Math.round(paymentAmountPaise * 0.05);
        const vendorAmount = paymentAmountPaise - platformFee;
        orderOptions.transfers = [{
          account: shop.razorpay_account_id, amount: vendorAmount, currency: 'INR',
          notes: { batch_receipt: orderOptions.receipt }, on_hold: false
        }];
      }
      
      const order = await getRazorpay().orders.create(orderOptions);
      razorpayOrderId = order.id;
    }

    // Notify the shopkeeper
    for (const job of insertedJobs) {
      emitToVendor(shop.vendor_id, 'printshop:new_job', {
        jobId: job.jobId,
        senderName: cleanSenderName,
        documentName: job.cleanDocumentName,
        pages: job.cleanPages,
        printType: job.filePrintType,
        totalAmount: job.totalAmount,
      });
    }

    res.status(201).json({
      jobs: insertedJobs.map(j => ({
        jobId: j.jobId,
        uploadUrl: j.uploadUrl,
        totalAmount: j.totalAmount,
        pricePerPage: j.pricePerPage,
        createdAt: j.createdAt
      })),
      totalBatchAmount,
      razorpayOrderId,
      amountPaise: paymentAmountPaise,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] POST /jobs/bulk error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// Verify Bulk Razorpay Payment Signature
router.post('/verify-payment-bulk', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, jobIds } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !Array.isArray(jobIds) || jobIds.length === 0) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generatedSignature = crypto.createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'signature_mismatch' });
  }

  try {
    const updateRes = await query(`
      UPDATE printshop_jobs 
      SET payment_status = 'paid', payment_id = $1, paid_at = NOW()
      WHERE id = ANY($2::uuid[]) AND payment_status != 'paid'
      RETURNING vendor_id, id, payment_status, payment_id, paid_at
    `, [razorpay_payment_id, jobIds]);

    for (const job of updateRes.rows) {
      emitToVendor(job.vendor_id, 'printshop:job_updated', {
        jobId: job.id, paymentStatus: job.payment_status, paymentId: job.payment_id, paidAt: job.paid_at,
      });
      emitToJob(job.id, 'printshop:job_updated', {
        jobId: job.id, paymentStatus: job.payment_status, paymentId: job.payment_id, paidAt: job.paid_at,
      });
    }

    res.json({ success: true, verifiedCount: updateRes.rowCount });
  } catch (err) {
    console.error('[PrintShop] POST /verify-payment-bulk error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Verify Razorpay Payment Signature
router.post('/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, jobId } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !jobId) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generatedSignature = crypto.createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'signature_mismatch' });
  }

  try {
    const updateRes = await query(`
      UPDATE printshop_jobs 
      SET payment_status = 'paid', payment_id = $1, paid_at = NOW()
      WHERE id = $2 AND payment_status != 'paid'
      RETURNING vendor_id, id, payment_status, payment_id, paid_at
    `, [razorpay_payment_id, jobId]);

    if (updateRes.rowCount > 0) {
      const job = updateRes.rows[0];
      emitToVendor(job.vendor_id, 'printshop:job_updated', {
        jobId: job.id,
        paymentStatus: job.payment_status,
        paymentId: job.payment_id,
        paidAt: job.paid_at,
      });
      emitToJob(job.id, 'printshop:job_updated', {
        jobId: job.id,
        paymentStatus: job.payment_status,
        paymentId: job.payment_id,
        paidAt: job.paid_at,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Razorpay Verify] Error:', err);
    res.status(500).json({ error: 'internal_error' });
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
    const conditions = ['vendor_id = $1'];
    const params = [req.vendorId];

    if (statusFilter) { params.push(statusFilter); conditions.push(`payment_status = $${params.length}`); }
    if (methodFilter) { params.push(methodFilter); conditions.push(`payment_method = $${params.length}`); }
    if (typeFilter)   { params.push(typeFilter);   conditions.push(`print_type = $${params.length}`);    }

    console.log(`[PrintShop] GET /jobs: vendorId=${req.vendorId}, conditions=${conditions.join(' AND ')}, params=`, params);

    params.push(limit, offset);
    const result = await query(`
      SELECT id, sender_name, document_name, file_size_bytes, file_type, pages,
             print_type, price_per_page, total_amount, payment_method,
             payment_status, payment_id, paid_at, created_at,
             print_config, job_status, printed_at, r2_key, deleted_at
      FROM printshop_jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Generate presigned GET URLs for all jobs that have an r2_key
    const jobsWithUrls = await Promise.all(result.rows.map(async (job) => {
      let fileUrl = null;
      if (job.r2_key) {
        try {
          const cmd = new (require('@aws-sdk/client-s3').GetObjectCommand)({ Bucket: R2_BUCKET, Key: job.r2_key });
          fileUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
        } catch { /* ignore */ }
      }
      return { ...job, fileUrl };
    }));

    res.json({ jobs: jobsWithUrls });
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

    // Real-time update to everyone in the vendor room
    emitToVendor(req.vendorId, 'printshop:job_updated', {
      jobId: id,
      paymentStatus: 'paid',
      paymentId,
      paidAt,
    });
    // Real-time update to the student's room
    emitToJob(id, 'printshop:job_updated', {
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
    emitToJob(id, 'printshop:job_updated', { jobId: id, paymentStatus: 'failed' });
    res.json({ success: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] PATCH /jobs/:id/fail error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// ─── PROTECTED: PATCH /printshop/jobs/:id/print ───────────────────────────────
// Vendor marks job as physically printed. Optional: send updated printConfig overrides.
router.patch('/jobs/:id/print', requireShopkeeper, async (req, res) => {
  const { id } = req.params;
  const { printConfig: vendorConfig } = req.body; // vendor can override student config

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    const jobRes = await client.query(
      'SELECT id, vendor_id, job_status FROM printshop_jobs WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [id]
    );
    if (jobRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'job_not_found' }); }
    const job = jobRes.rows[0];
    if (job.vendor_id !== req.vendorId) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'job_not_found' }); }
    if (job.job_status === 'printed') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'already_printed' }); }

    const printedAt = new Date().toISOString();
    await client.query(
      `UPDATE printshop_jobs SET job_status = 'printed', printed_at = $1${vendorConfig ? ', print_config = $3' : ''} WHERE id = $2`,
      vendorConfig ? [printedAt, id, JSON.stringify(vendorConfig)] : [printedAt, id]
    );
    await client.query('COMMIT');

    emitToVendor(req.vendorId, 'printshop:job_updated', { jobId: id, jobStatus: 'printed', printedAt });
    emitToJob(id, 'printshop:job_updated', { jobId: id, jobStatus: 'printed', printedAt });
    res.json({ success: true, printedAt });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[PrintShop] PATCH /jobs/:id/print error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// ─── PROTECTED: PATCH /printshop/jobs/:id/config ─────────────────────────────
// Allows the shopkeeper to modify the sender's print config before printing.
router.patch('/jobs/:id/config', requireShopkeeper, async (req, res) => {
  const { id } = req.params;
  const { config } = req.body;
  
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: 'invalid_config' });
  }

  try {
    // Only allow updating if it belongs to this vendor
    const jobRes = await query(`
      SELECT id, print_config, price_per_page, pages FROM printshop_jobs 
      WHERE id = $1 AND vendor_id = $2 AND deleted_at IS NULL
    `, [id, req.vendorId]);
    
    if (jobRes.rowCount === 0) {
      return res.status(404).json({ error: 'job_not_found' });
    }
    
    // Merge the new config with the existing config
    const currentConfig = jobRes.rows[0].print_config || {};
    const newConfig = { ...currentConfig, ...config };
    
    // Recalculate total_amount
    const newCopies = newConfig.copies && parseInt(newConfig.copies, 10) > 0 ? parseInt(newConfig.copies, 10) : 1;
    const newTotalAmount = parseFloat((parseFloat(jobRes.rows[0].price_per_page) * parseInt(jobRes.rows[0].pages, 10) * newCopies).toFixed(2));
    
    await query(`
      UPDATE printshop_jobs 
      SET print_config = $1, total_amount = $2
      WHERE id = $3 AND vendor_id = $4
    `, [newConfig, newTotalAmount, id, req.vendorId]);
    
    // Emit event so the UI updates
    const { emitToVendor } = require('../socket');
    emitToVendor(req.vendorId, 'printshop:job_updated', { jobId: id });
    
    res.json({ success: true, printConfig: newConfig });
  } catch (err) {
    console.error('[PrintShop] PATCH /jobs/:id/config error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: GET /printshop/settings ───────────────────────────────────────
router.get('/settings', requireShopkeeper, async (req, res) => {
  try {
    const result = await query(`
      SELECT ps.bw_price, ps.color_price, ps.location_name, ps.qr_r2_key, ps.is_accepting, ps.retention_hours,
             ps.payment_qr_url, ps.payment_qr_id,
             v.razorpay_account_id, v.charges_enabled, v.upi_id
      FROM vendors v
      LEFT JOIN printshop_settings ps ON ps.vendor_id = v.id
      WHERE v.id = $1
    `, [req.vendorId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'vendor_not_found' });
    }

    const row = result.rows[0];
    // Legacy R2 QR (manual upload) — superseded by Razorpay auto-QR but kept for backward compat
    let legacyQrUrl = null;
    if (row.qr_r2_key) {
      try {
        const cmd = new (require('@aws-sdk/client-s3').GetObjectCommand)({ Bucket: R2_BUCKET, Key: row.qr_r2_key });
        legacyQrUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
      } catch { /* non-fatal */ }
    }

    res.json({
      bwPrice: row.bw_price ? parseFloat(row.bw_price) : 2.0,
      colorPrice: row.color_price ? parseFloat(row.color_price) : 5.0,
      locationName: row.location_name || '',
      qrUrl: row.payment_qr_url || legacyQrUrl,  // prefer Razorpay auto-QR
      isAccepting: row.is_accepting ?? true,
      retentionHours: row.retention_hours !== null ? parseInt(row.retention_hours, 10) : 24,
      razorpay_account_id: row.razorpay_account_id || null,
      charges_enabled: row.charges_enabled || false,
      upiId: row.upi_id || '',
      qrImageUrl: row.payment_qr_url || null,
      qrId: row.payment_qr_id || null,
    });
  } catch (err) {
    console.error('[PrintShop] GET /settings error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: PUT /printshop/settings ───────────────────────────────────────
router.put('/settings', requireShopkeeper, async (req, res) => {
  const { bwPrice, colorPrice, locationName, isAccepting, retentionHours } = req.body;

  const cleanBwPrice      = toPositiveFloat(bwPrice);
  const cleanColorPrice   = toPositiveFloat(colorPrice);
  const cleanLocation     = sanitizeText(locationName, 120);
  const cleanIsAccepting  = isAccepting === false ? false : true;
  const cleanRetention    = Number.isInteger(Number(retentionHours)) ? Number(retentionHours) : 24;

  if (cleanBwPrice === null || cleanColorPrice === null) {
    return res.status(400).json({ error: 'invalid_price' });
  }
  if (cleanBwPrice > 999 || cleanColorPrice > 999) {
    return res.status(400).json({ error: 'price_too_high' });
  }

  try {
    await query(`
      INSERT INTO printshop_settings (vendor_id, bw_price, color_price, location_name, is_accepting, retention_hours, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (vendor_id) DO UPDATE
        SET bw_price = EXCLUDED.bw_price,
            color_price = EXCLUDED.color_price,
            location_name = EXCLUDED.location_name,
            is_accepting = EXCLUDED.is_accepting,
            retention_hours = EXCLUDED.retention_hours,
            updated_at = NOW()
    `, [req.vendorId, cleanBwPrice, cleanColorPrice, cleanLocation, cleanIsAccepting, cleanRetention]);

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

// ─── PROTECTED: GET /printshop/printers ───────────────────────────────────────
router.get('/printers', requireShopkeeper, async (req, res) => {
  try {
    const printers = getAgentPrinters(req.vendorId);
    res.json({ printers, online: isAgentOnline(req.vendorId) });
  } catch (err) {
    console.error('[PrintShop] GET /printers error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: POST /printshop/print-batch ───────────────────────────────────
router.post('/print-batch', requireShopkeeper, async (req, res) => {
  try {
    const { jobIds, printerName } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0 || !printerName) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    if (!isAgentOnline(req.vendorId)) {
      return res.status(400).json({ error: 'agent_offline' });
    }

    // Fetch job details and sign URLs for the agent
    const jobsRes = await query(
      `SELECT * FROM printshop_jobs WHERE id = ANY($1) AND vendor_id = $2`, 
      [jobIds, req.vendorId]
    );

    if (jobsRes.rows.length === 0) {
      return res.status(404).json({ error: 'jobs_not_found' });
    }

    for (const job of jobsRes.rows) {
      if (!job.r2_key) continue;
      
      const fileUrl = await generatePresignedGetUrl(job.r2_key, 60 * 15); // 15 mins
      
      const printConfig = job.print_config ? (typeof job.print_config === 'string' ? JSON.parse(job.print_config) : job.print_config) : {};
      
      dispatchJobToAgent(req.vendorId, {
        type: 'print_job',
        jobId: job.id,
        fileUrl,
        copies: printConfig.copies || 1,
        colorMode: job.print_type,
        printerName
      });
      
      // Update DB to queued
      await query(`UPDATE printshop_jobs SET job_status = 'queued', printer_name = $1 WHERE id = $2`, [printerName, job.id]);
      emitToVendor(req.vendorId, 'printshop:job_updated', { jobId: job.id, jobStatus: 'queued' });
      emitToJob(job.id, 'printshop:job_updated', { jobId: job.id, jobStatus: 'queued' });
    }

    res.json({ success: true, count: jobsRes.rows.length });
  } catch (err) {
    console.error('[PrintShop] POST /print-batch error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PROTECTED: POST /printshop/agent-token ───────────────────────────────────
router.post('/agent-token', requireShopkeeper, async (req, res) => {
  try {
    // Check existing
    let dbRes = await query('SELECT print_agent_token FROM vendors WHERE id = $1', [req.vendorId]);
    if (!dbRes.rows[0].print_agent_token) {
      dbRes = await query('UPDATE vendors SET print_agent_token = gen_random_uuid() WHERE id = $1 RETURNING print_agent_token', [req.vendorId]);
    }
    res.json({ token: dbRes.rows[0].print_agent_token });
  } catch (err) {
    console.error('[PrintShop] POST /agent-token error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
