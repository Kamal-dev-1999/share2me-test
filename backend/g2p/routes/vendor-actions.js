const express = require('express');
const { query } = require('../lib/db');
const { generatePresignedGetUrl } = require('../lib/storage');
const { deleteRequest } = require('../lib/delete');
const { emitToVendor } = require('../socket');
const { verifyVendorJWT } = require('../lib/auth');

const router = express.Router();

// Middleware to verify vendor
router.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.id;
  next();
});

// Download a file
router.post('/files/:fileId/download', async (req, res) => {
  const { fileId } = req.params;
  
  try {
    const fileRes = await query(`
      SELECT f.r2_key, r.vendor_id
      FROM files f
      JOIN requests r ON f.request_id = r.id
      WHERE f.id = $1 AND f.status IN ('received', 'downloaded')
    `, [fileId]);

    if (fileRes.rowCount === 0) return res.status(404).json({ error: 'file_not_found' });
    if (fileRes.rows[0].vendor_id !== req.vendorId) return res.status(403).json({ error: 'unauthorized' });

    // Mark as downloaded and start grace timer
    await query(`UPDATE files SET status = 'downloaded', downloaded_at = NOW() WHERE id = $1`, [fileId]);

    const url = await generatePresignedGetUrl(fileRes.rows[0].r2_key);
    
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

module.exports = router;
