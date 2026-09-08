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
  service: 'gmail',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
  secure: process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT, // true for 465, false for 587
  connectionTimeout: 10000, // Fail after 10 seconds instead of hanging
  socketTimeout: 10000,
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
    const vRes = await query('SELECT charges_enabled, razorpay_account_id, plan_type, subscription_tier, subscription_status, subscription_ends_at FROM vendors WHERE id = $1', [req.vendorId]);
    const pRes = await query('SELECT upi_id, bank_verification_status FROM printshop_settings WHERE vendor_id = $1', [req.vendorId]);
    
    const vendor = vRes.rows[0] || {};
    const settings = pRes.rows[0] || {};

    const isExpired = vendor.subscription_ends_at && new Date(vendor.subscription_ends_at) < new Date();
    const effectivePlan = (vendor.plan_type === 'PRO' && !isExpired) ? 'PRO' : 'FREE';
    const daysRemaining = vendor.subscription_ends_at && !isExpired
      ? Math.max(0, Math.ceil((new Date(vendor.subscription_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      charges_enabled: vendor.charges_enabled || false,
      razorpay_account_id: vendor.razorpay_account_id,
      upi_id: settings.upi_id || null,
      bank_verification_status: settings.bank_verification_status || 'pending',
      plan_type: effectivePlan,
      subscription_status: isExpired ? 'expired' : (vendor.subscription_status || 'none'),
      subscription_ends_at: vendor.subscription_ends_at || null,
      days_remaining: daysRemaining,
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

// POST /billing/subscription/create-order
router.post('/subscription/create-order', async (req, res) => {
  try {
    const vRes = await query('SELECT id, name, email, phone, plan_type, subscription_ends_at FROM vendors WHERE id = $1', [req.vendorId]);
    if (vRes.rowCount === 0) {
      return res.status(404).json({ error: 'vendor_not_found' });
    }
    const vendor = vRes.rows[0];
    const amountPaise = 49900; // ₹499 in paise

    const rzp = getRazorpay();
    const receipt = `pro_${req.vendorId.substring(0, 8)}_${Date.now()}`;
    const orderOptions = {
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt.substring(0, 40),
      notes: {
        vendor_id: req.vendorId,
        plan_id: 'pro_monthly',
        plan_name: 'Share2Me Pro'
      }
    };

    const order = await rzp.orders.create(orderOptions);

    // Save order in vendor_subscriptions ledger
    await query(`
      INSERT INTO vendor_subscriptions (
        vendor_id, plan_id, amount, currency, razorpay_order_id, status
      ) VALUES ($1, 'pro_monthly', 499.00, 'INR', $2, 'created')
    `, [req.vendorId, order.id]);

    res.json({
      success: true,
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      vendor: {
        name: vendor.name || '',
        email: vendor.email || req.vendorEmail || '',
        phone: vendor.phone || ''
      }
    });
  } catch (err) {
    console.error('[Billing] POST /subscription/create-order error:', err);
    res.status(500).json({ error: 'order_creation_failed', message: err.message });
  }
});

// POST /billing/subscription/verify-payment
router.post('/subscription/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'missing_fields', message: 'Missing payment verification details.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'razorpay_unconfigured' });
    }

    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn(`[Billing] Signature mismatch for order ${razorpay_order_id}`);
      return res.status(400).json({ error: 'signature_mismatch', message: 'Payment verification failed. Invalid signature.' });
    }

    // Check if order exists in vendor_subscriptions
    const subRes = await query(`
      SELECT id, vendor_id, status FROM vendor_subscriptions 
      WHERE razorpay_order_id = $1 AND vendor_id = $2
    `, [razorpay_order_id, req.vendorId]);

    if (subRes.rowCount === 0) {
      return res.status(404).json({ error: 'order_not_found', message: 'Subscription order record not found.' });
    }

    // Fetch vendor's current subscription status to handle stacking (early renewal)
    const vRes = await query('SELECT plan_type, subscription_ends_at FROM vendors WHERE id = $1', [req.vendorId]);
    const vendor = vRes.rows[0];

    const now = new Date();
    let startsAt = now;
    let endsAt;

    if (vendor && vendor.subscription_ends_at && new Date(vendor.subscription_ends_at) > now) {
      // Active subscription: extend by 30 days from existing expiry
      startsAt = new Date(vendor.subscription_ends_at);
      endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      // New or expired: 30 days from now
      endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Update vendor_subscriptions ledger
    await query(`
      UPDATE vendor_subscriptions
      SET status = 'paid',
          razorpay_payment_id = $1,
          razorpay_signature = $2,
          starts_at = $3,
          ends_at = $4,
          updated_at = NOW()
      WHERE razorpay_order_id = $5
    `, [razorpay_payment_id, razorpay_signature, startsAt, endsAt, razorpay_order_id]);

    // Update vendors table
    await query(`
      UPDATE vendors
      SET plan_type = 'PRO',
          subscription_tier = 'pro',
          subscription_status = 'active',
          subscription_starts_at = COALESCE(subscription_starts_at, $1),
          subscription_ends_at = $2
      WHERE id = $3
    `, [startsAt, endsAt, req.vendorId]);

    console.log(`[Billing] Vendor ${req.vendorId} upgraded to PRO until ${endsAt.toISOString()}`);

    res.json({
      success: true,
      plan_type: 'PRO',
      subscription_status: 'active',
      subscription_ends_at: endsAt.toISOString(),
      days_remaining: Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    });
  } catch (err) {
    console.error('[Billing] POST /subscription/verify-payment error:', err);
    res.status(500).json({ error: 'verification_failed', message: err.message });
  }
});

module.exports = router;

