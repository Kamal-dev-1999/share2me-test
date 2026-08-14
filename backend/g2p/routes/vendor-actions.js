const express = require('express');
const { query } = require('../lib/db');
const { generatePresignedGetUrl } = require('../lib/storage');
const { deleteRequest } = require('../lib/delete');
const { emitToVendor } = require('../socket');
const { verifyVendorJWT } = require('../lib/auth');

const router = express.Router();
const crypto = require('crypto');

// Server-to-server endpoint for NextAuth to upsert the vendor during login
router.post('/upsert', async (req, res) => {
  // Simple shared-secret authorization for internal backend-to-backend communication
  const authHeader = req.headers.authorization || '';
  const secret = process.env.AUTH_JWT_SECRET || 'placeholder_jwt_secret';
  
  if (authHeader !== `Bearer ${secret}`) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { name, providerId } = req.body;
  if (!name || !providerId) return res.status(400).json({ error: 'missing_fields' });

  try {
    // Check if exists first to avoid generating a new share2me_id if not needed
    const existing = await query(`SELECT id, share2me_id FROM vendors WHERE auth_provider_id = $1`, [providerId]);
    if (existing.rowCount > 0) {
      // Update name just in case it changed
      await query(`UPDATE vendors SET name = $1 WHERE auth_provider_id = $2`, [name, providerId]);
      return res.json(existing.rows[0]);
    }

    // Generate unique 6-char share2me_id (e.g. "A8B2C9")
    const share2me_id = crypto.randomBytes(3).toString('hex').toUpperCase();

    const insertRes = await query(`
      INSERT INTO vendors (name, auth_provider_id, share2me_id)
      VALUES ($1, $2, $3)
      RETURNING id, share2me_id
    `, [name, providerId, share2me_id]);
    
    res.json(insertRes.rows[0]);
  } catch (err) {
    console.error('[G2P] Upsert vendor error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Middleware to verify vendor for all subsequent routes
router.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.id;
  next();
});

// Get current vendor profile details
router.get('/me', async (req, res) => {
  try {
    const vRes = await query(`SELECT id, name, share2me_id FROM vendors WHERE id = $1`, [req.vendorId]);
    if (vRes.rowCount === 0) return res.status(404).json({ error: 'vendor_not_found' });
    res.json(vRes.rows[0]);
  } catch (err) {
    console.error('[G2P] Fetch vendor profile error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Update vendor's display name
router.post('/name', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'missing_name' });

  try {
    await query(`UPDATE vendors SET name = $1 WHERE id = $2`, [name.trim(), req.vendorId]);
    res.json({ success: true, name: name.trim() });
  } catch (err) {
    console.error('[G2P] Update name error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get all active requests for this vendor
router.get('/requests', async (req, res) => {
  try {
    const reqs = await query(`
      SELECT r.id as request_id, r.status, r.created_at, r.device_metadata,
             f.id as file_id, f.original_name, f.size_bytes, f.mime_type, f.status as file_status
      FROM requests r
      LEFT JOIN files f ON f.request_id = r.id
      WHERE r.vendor_id = $1 AND r.deleted_at IS NULL
    `, [req.vendorId]);
    
    // Group files by request
    const requestsMap = new Map();
    for (const row of reqs.rows) {
      if (!requestsMap.has(row.request_id)) {
        requestsMap.set(row.request_id, {
          uploadId: row.request_id,
          senderName: row.device_metadata?.senderName || 'Anonymous',
          message: row.device_metadata?.message || '',
          uploadedAt: row.created_at,
          files: []
        });
      }
      
      // Only show received or downloaded files to the vendor
      if (row.file_id && (row.file_status === 'received' || row.file_status === 'downloaded')) {
        requestsMap.get(row.request_id).files.push({
          id: row.file_id,
          name: row.original_name,
          size: parseInt(row.size_bytes, 10),
          type: row.mime_type,
          status: row.file_status
        });
      }
    }
    
    // Filter out requests that have 0 fully received files (they might still be uploading)
    const validRequests = Array.from(requestsMap.values()).filter(r => r.files.length > 0);
    res.json(validRequests);
  } catch (err) {
    console.error('[G2P] Fetch requests error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Download or Preview a file
router.post('/files/:fileId/download', async (req, res) => {
  const { fileId } = req.params;
  const { action = 'download' } = req.body; // 'preview' or 'download'
  
  try {
    const fileRes = await query(`
      SELECT f.r2_key, f.original_name, f.size_bytes, f.mime_type, r.vendor_id, r.device_metadata
      FROM files f
      JOIN requests r ON f.request_id = r.id
      WHERE f.id = $1 AND f.status IN ('received', 'downloaded')
    `, [fileId]);

    if (fileRes.rowCount === 0) return res.status(404).json({ error: 'file_not_found' });
    if (fileRes.rows[0].vendor_id !== req.vendorId) return res.status(403).json({ error: 'unauthorized' });

    // Mark as downloaded and start grace timer
    await query(`UPDATE files SET status = 'downloaded', downloaded_at = NOW() WHERE id = $1`, [fileId]);

    const url = await generatePresignedGetUrl(fileRes.rows[0].r2_key, fileRes.rows[0].original_name, action);
    
    // 3.5 Log Analytics Event
    const fileRow = fileRes.rows[0];
    const eventType = action === 'preview' ? 'file_previewed' : 'file_downloaded';
    const senderName = fileRow.device_metadata?.senderName || 'Anonymous';
    await query(`
      INSERT INTO g2p_analytics_events 
      (vendor_id, sender_name, event_type, file_size_bytes, file_type, user_agent, file_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      fileRow.vendor_id,
      senderName,
      eventType,
      fileRow.size_bytes,
      fileRow.mime_type,
      req.headers['user-agent'] || 'Unknown',
      fileRow.original_name
    ]).catch(err => console.error('[G2P] Analytics insert error:', err));

    emitToVendor(req.vendorId, 'g2p:file_downloaded', { fileId });

    res.json({ url });
  } catch (err) {
    console.error('[G2P] Download error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Delete a request manually
router.delete('/requests/:requestId', async (req, res) => {
  const { requestId } = req.params;
  try {
    const reqRes = await query(`SELECT vendor_id FROM requests WHERE id = $1`, [requestId]);
    if (reqRes.rowCount === 0) return res.status(404).json({ error: 'request_not_found' });
    if (reqRes.rows[0].vendor_id !== req.vendorId) return res.status(403).json({ error: 'unauthorized' });

    await deleteRequest(requestId, 'manual');
    res.json({ success: true });
  } catch (err) {
    console.error('[G2P] Delete request error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get analytics data for the dashboard
router.get('/analytics', async (req, res) => {
  try {
    // 1. Total Bandwidth (sum of file_size_bytes where event is upload_received)
    const bandwidthRes = await query(`
      SELECT COALESCE(SUM(file_size_bytes), 0) as total_bandwidth, COUNT(*)::int as total_uploads
      FROM g2p_analytics_events
      WHERE vendor_id = $1
      AND event_type = 'upload_received'
    `, [req.vendorId]);

    // 2. File Type Composition
    const typeRes = await query(`
      SELECT file_type, COUNT(*)::int as count
      FROM g2p_analytics_events
      WHERE vendor_id = $1
      AND event_type = 'upload_received'
      GROUP BY file_type
    `, [req.vendorId]);

    // 3. Recent Activity (last 10 events)
    const recentRes = await query(`
      SELECT id, sender_name, event_type, file_size_bytes, file_type, file_name, created_at
      FROM g2p_analytics_events
      WHERE vendor_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.vendorId]);

    // 4. Time Series (uploads per day for the last 7 days)
    const timeSeriesRes = await query(`
      SELECT DATE(created_at) as date, COUNT(*)::int as uploads
      FROM g2p_analytics_events
      WHERE vendor_id = $1
      AND event_type = 'upload_received'
      AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [req.vendorId]);

    res.json({
      overview: {
        totalBandwidth: parseInt(bandwidthRes.rows[0].total_bandwidth, 10),
        totalUploads: parseInt(bandwidthRes.rows[0].total_uploads, 10),
      },
      fileTypes: typeRes.rows,
      recentActivity: recentRes.rows,
      timeSeries: timeSeriesRes.rows,
    });
  } catch (err) {
    console.error('[G2P] Analytics fetch error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
