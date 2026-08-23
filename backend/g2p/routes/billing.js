'use strict';

const express = require('express');
const crypto = require('crypto');
const { query } = require('../lib/db');
const { verifyVendorJWT } = require('../lib/auth');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const { SignJWT, jwtVerify } = require('jose');

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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

const router = express.Router();

router.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.vendorId || vendor.sub || vendor.id;
  req.vendorEmail = vendor.email;
  next();
});

// GET /billing/status
router.get('/status', async (req, res) => {
  try {
    const vRes = await query('SELECT charges_enabled, razorpay_account_id FROM vendors WHERE id = $1', [req.vendorId]);
    const pRes = await query('SELECT upi_id, bank_verification_status FROM printshop_settings WHERE vendor_id = $1', [req.vendorId]);
    
    const vendor = vRes.rows[0];
    const settings = pRes.rows[0] || {};

    res.json({
      charges_enabled: vendor.charges_enabled || false,
      razorpay_account_id: vendor.razorpay_account_id,
      upi_id: settings.upi_id || null,
      bank_verification_status: settings.bank_verification_status || 'pending'
    });
  } catch (err) {
    console.error('[Billing] GET /status error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /billing/bank/request-edit
router.post('/bank/request-edit', async (req, res) => {
  try {
    const vRes = await query('SELECT email FROM vendors WHERE id = $1', [req.vendorId]);
    if (vRes.rowCount === 0) return res.status(404).json({ error: 'vendor_not_found' });
    const email = vRes.rows[0].email || req.vendorEmail;
    if (!email) return res.status(400).json({ error: 'no_email', message: 'No registered email found to send OTP.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Store in DB, expires in 5 mins
    await query(
      `INSERT INTO vendor_otps (vendor_id, otp_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
      [req.vendorId, otpHash]
    );

    // Send email
    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: `"Share2Me PrintShop" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Share2Me: Bank Details Update OTP',
        text: `Your OTP to update your bank details is: ${otp}\n\nIt is valid for 5 minutes. Do not share this code.`
      });
    } else {
      console.log(`[DEV MODE] OTP for ${email} is: ${otp}`); // Fallback for testing without SMTP
    }

    res.json({ success: true, message: `OTP sent to ${email}` });
  } catch (err) {
    console.error('[Billing] POST /bank/request-edit error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /billing/bank/verify-otp
router.post('/bank/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'missing_otp' });

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpRes = await query(
      `SELECT id FROM vendor_otps WHERE vendor_id = $1 AND otp_hash = $2 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [req.vendorId, otpHash]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ error: 'invalid_otp', message: 'OTP is invalid or has expired.' });
    }

    // Mark as used
    await query(`UPDATE vendor_otps SET used = TRUE WHERE id = $1`, [otpRes.rows[0].id]);

    // Issue short-lived JWT (15 mins)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
    const editToken = await new SignJWT({ sub: req.vendorId, purpose: 'bank_edit' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    res.json({ success: true, editToken });
  } catch (err) {
    console.error('[Billing] POST /bank/verify-otp error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /billing/upi/update
router.post('/upi/update', async (req, res) => {
  try {
    const { editToken, upiId, upiName } = req.body;
    if (!editToken || !upiId || !upiName) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Verify token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
    try {
      const { payload } = await jwtVerify(editToken, secret);
      if (payload.sub !== req.vendorId || payload.purpose !== 'bank_edit') throw new Error();
    } catch {
      return res.status(401).json({ error: 'invalid_edit_token', message: 'Session expired. Request a new OTP.' });
    }

    await query(
      `INSERT INTO printshop_settings (vendor_id, upi_id, upi_name, bank_verification_status, updated_at) 
       VALUES ($1, $2, $3, 'verified', NOW()) 
       ON CONFLICT (vendor_id) DO UPDATE SET upi_id = EXCLUDED.upi_id, upi_name = EXCLUDED.upi_name, bank_verification_status = 'verified', updated_at = NOW()`,
      [req.vendorId, upiId, upiName]
    );

    // Ensure charges_enabled is true in vendors table
    await query(
      'UPDATE vendors SET charges_enabled = true WHERE id = $1',
      [req.vendorId]
    );

    res.json({ success: true, upi_id: upiId, status: 'verified' });
  } catch (err) {
    console.error('[Billing] POST /upi/update error:', err);
    res.status(500).json({ error: 'update_failed', message: err.message });
  }
});

module.exports = router;
