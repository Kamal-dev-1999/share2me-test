const express = require('express');
const { query } = require('../lib/db');
const { verifyVendorJWT } = require('../lib/auth');

let stripeInstance = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe API Key is not configured. Please add STRIPE_SECRET_KEY to your env variables.');
  }
  if (!stripeInstance) {
    stripeInstance = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

const router = express.Router();

// Middleware to verify vendor JWT token
router.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.id;
  next();
});

// Create a Stripe Checkout Session
router.post('/checkout', async (req, res) => {
  try {
    // 1. Get vendor details from database
    const vRes = await query(`SELECT id, name, email FROM vendors WHERE id = $1`, [req.vendorId]);
    if (vRes.rowCount === 0) return res.status(404).json({ error: 'vendor_not_found' });
    const vendor = vRes.rows[0];

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // 2. Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Price ID configured in Stripe Dashboard
          quantity: 1,
        },
      ],
      // Map vendorId so we can correlate when webhook triggers asynchronously
      client_reference_id: vendor.id,
      customer_email: vendor.email || undefined,
      subscription_data: {
        trial_period_days: 30, // 30-Day Free Trial
      },
      success_url: `${frontendUrl}/g2p?checkout=success`,
      cancel_url: `${frontendUrl}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] Create Checkout Session Error:', err);
    res.status(500).json({ error: 'failed_to_create_session' });
  }
});

// Create a Stripe Customer Portal Session for billing configuration/cancellation
router.post('/portal', async (req, res) => {
  try {
    const vRes = await query(`SELECT stripe_customer_id FROM vendors WHERE id = $1`, [req.vendorId]);
    if (vRes.rowCount === 0 || !vRes.rows[0].stripe_customer_id) {
      return res.status(400).json({ error: 'no_billing_history' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: vRes.rows[0].stripe_customer_id,
      return_url: `${frontendUrl}/g2p`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[Billing] Create Portal Session Error:', err);
    res.status(500).json({ error: 'failed_to_create_portal_session' });
  }
});

module.exports = router;
