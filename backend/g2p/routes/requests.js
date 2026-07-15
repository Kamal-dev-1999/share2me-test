const express = require('express');
const { getTransactionClient, query } = require('../lib/db');
const RateLimiter = require('../../lib/RateLimiter');

const router = express.Router();

const requestCreateLimiter = new RateLimiter(60_000, 10); // 10 new requests/min per IP
const statusPollLimiter = new RateLimiter(10_000, 3); // 3 polls / 10s per status_token

// Create a new print request
router.post('/', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (requestCreateLimiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { vendorId, deviceMetadata } = req.body;
  if (!vendorId) {
    return res.status(400).json({ error: 'vendorId required' });
  }

  let client;
  try {
    client = await getTransactionClient();
    await client.query('BEGIN');

    // 1. Lock the vendor row (SELECT FOR UPDATE)
    const vendorRes = await client.query('SELECT id, accepting_requests FROM vendors WHERE id = $1 FOR UPDATE', [vendorId]);
    if (vendorRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'vendor_not_found' });
    }
    
    if (!vendorRes.rows[0].accepting_requests) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'vendor_not_accepting' });
    }

    // 2. Enforce cap: max 100 active requests per vendor
    const countRes = await client.query(`
      SELECT COUNT(*) FROM requests
      WHERE vendor_id = $1 AND status NOT IN ('completed', 'expired') AND deleted_at IS NULL
    `, [vendorId]);
    
    const activeRequests = parseInt(countRes.rows[0].count, 10);
    if (activeRequests >= 100) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'queue_full', message: "This vendor's queue is full, try again shortly" });
    }

    // 3. Insert the new request
    const insertRes = await client.query(`
      INSERT INTO requests (vendor_id, device_metadata)
      VALUES ($1, $2)
      RETURNING id, status_token
    `, [vendorId, deviceMetadata || {}]);

    await client.query('COMMIT');
    
    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[G2P] Create request error:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// Phase 6: Student Status Polling
router.get('/status/:status_token', async (req, res) => {
  const { status_token } = req.params;
  
  if (statusPollLimiter.isRateLimited(status_token)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  try {
    const reqRes = await query(`
      SELECT r.id, r.status, v.name as vendor_name 
      FROM requests r
      JOIN vendors v ON r.vendor_id = v.id
      WHERE r.status_token = $1 AND r.deleted_at IS NULL
    `, [status_token]);

    if (reqRes.rowCount === 0) return res.status(404).json({ error: 'not_found' });

    const requestRow = reqRes.rows[0];

    const filesRes = await query(`
      SELECT id, original_name, status, size_bytes
      FROM files
      WHERE request_id = $1
    `, [requestRow.id]);

    res.json({
      request: requestRow,
      files: filesRes.rows,
    });
  } catch (err) {
    console.error('[G2P] Status poll error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
