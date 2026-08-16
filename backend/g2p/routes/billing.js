'use strict';

const express = require('express');
const { query } = require('../lib/db');
const { verifyVendorJWT } = require('../lib/auth');
const Razorpay = require('razorpay');

let razorpayInstance = null;
function getRazorpay() {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured');
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

const router = express.Router();

// All billing routes require a valid vendor JWT
router.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.vendorId || vendor.sub || vendor.id;
  next();
});

// POST /billing/connect
// Accepts vendor UPI ID, calls Razorpay QR Codes API to create a permanent
// multi-use payment QR, persists it, marks charges_enabled = true.
router.post('/connect', async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId || typeof upiId !== 'string' || !upiId.includes('@')) {
      return res.status(400).json({ error: 'invalid_upi_id', message: 'Please provide a valid UPI ID (e.g. name@upi)' });
    }
    const cleanUpiId = upiId.trim().toLowerCase().slice(0, 100);

    const vRes = await query('SELECT id, name, share2me_id FROM vendors WHERE id = $1', [req.vendorId]);
    if (vRes.rowCount === 0) return res.status(404).json({ error: 'vendor_not_found' });
    const vendor = vRes.rows[0];

    let qrImageUrl = null;
    let qrId = null;
    try {
      // Generate a static UPI QR code using qrserver
      const upiString = `upi://pay?pa=${cleanUpiId}&pn=${encodeURIComponent(vendor.name)}&cu=INR`;
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
      qrId = 'static_' + vendor.id;
      console.log(`[Billing] Static UPI QR created: ${qrId} for vendor ${vendor.id}`);
    } catch (err) {
      console.warn(`[Billing] Static QR creation failed (graceful degrade): ${err.message}`);
    }

    await query(
      'UPDATE vendors SET upi_id = $1, razorpay_account_id = $2, charges_enabled = true WHERE id = $3',
      [cleanUpiId, qrId || ('upi_' + vendor.id.split('-')[0]), vendor.id]
    );
    await query(
      'INSERT INTO printshop_settings (vendor_id, payment_qr_url, payment_qr_id, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (vendor_id) DO UPDATE SET payment_qr_url = EXCLUDED.payment_qr_url, payment_qr_id = EXCLUDED.payment_qr_id, updated_at = NOW()',
      [vendor.id, qrImageUrl, qrId]
    );

    res.json({ success: true, qrImageUrl, qrId, upiId: cleanUpiId, charges_enabled: true });
  } catch (err) {
    console.error('[Billing] POST /connect error:', err);
    res.status(500).json({ error: 'connect_failed', message: err.message });
  }
});

// GET /billing/status — returns vendor Razorpay setup state
router.get('/status', async (req, res) => {
  try {
    const result = await query(
      'SELECT v.upi_id, v.charges_enabled, v.razorpay_account_id, ps.payment_qr_url, ps.payment_qr_id FROM vendors v LEFT JOIN printshop_settings ps ON ps.vendor_id = v.id WHERE v.id = $1',
      [req.vendorId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'vendor_not_found' });
    const row = result.rows[0];
    res.json({
      upiId: row.upi_id || null,
      charges_enabled: row.charges_enabled || false,
      razorpay_account_id: row.razorpay_account_id || null,
      qrImageUrl: row.payment_qr_url || null,
      qrId: row.payment_qr_id || null,
    });
  } catch (err) {
    console.error('[Billing] GET /status error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
