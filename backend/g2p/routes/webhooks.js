const express = require('express');
const { query } = require('../lib/db');

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

// Stripe Webhook Endpoint (Requires raw body parsing)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify signature using Stripe SDK
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`[Webhook] Signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Webhook] Received verified event type: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.mode === 'subscription') {
          const vendorId = session.client_reference_id;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (vendorId) {
            // Update vendor record with Stripe reference and upgrade tier to pro
            const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
            const endsAt = new Date(subscription.current_period_end * 1000).toISOString();
            
            await query(`
              UPDATE vendors 
              SET 
                subscription_tier = 'pro',
                plan_type = 'PRO',
                stripe_customer_id = $1,
                stripe_subscription_id = $2,
                subscription_status = $3,
                subscription_ends_at = $4
              WHERE id = $5
            `, [customerId, subscriptionId, subscription.status, endsAt, vendorId]);
            
            console.log(`[Webhook] Vendor ${vendorId} upgraded to Pro plan successfully!`);
          }
        } else if (session.mode === 'payment') {
          // It's a student print job payment
          const jobId = session.client_reference_id;
          const paymentIntentId = session.payment_intent;

          if (jobId) {
            const updateRes = await query(`
              UPDATE printshop_jobs 
              SET payment_status = 'paid', payment_id = $1, paid_at = NOW()
              WHERE id = $2 AND payment_status != 'paid'
              RETURNING vendor_id, id, payment_status, payment_id, paid_at
            `, [paymentIntentId, jobId]);

            if (updateRes.rowCount > 0) {
              const job = updateRes.rows[0];
              const { emitToVendor } = require('../socket');
              emitToVendor(job.vendor_id, 'printshop:job_updated', {
                jobId: job.id,
                paymentStatus: job.payment_status,
                paymentId: job.payment_id,
                paidAt: job.paid_at,
              });
              console.log(`[Webhook] Print job ${jobId} marked as paid successfully!`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        const endsAt = new Date(subscription.current_period_end * 1000).toISOString();

        // If subscription is canceled, unpaid, or past due, downgrade tier
        const tier = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
        const plan = (status === 'active' || status === 'trialing') ? 'PRO' : 'FREE';

        await query(`
          UPDATE vendors 
          SET 
            subscription_tier = $1,
            plan_type = $2,
            subscription_status = $3,
            subscription_ends_at = $4
          WHERE stripe_customer_id = $5
        `, [tier, plan, status, endsAt, customerId]);

        console.log(`[Webhook] Subscription status updated for customer ${customerId}: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Reset to free tier on cancellation
        await query(`
          UPDATE vendors 
          SET 
            subscription_tier = 'free',
            plan_type = 'FREE',
            subscription_status = 'canceled',
            subscription_ends_at = NOW()
          WHERE stripe_customer_id = $1
        `, [customerId]);

        console.log(`[Webhook] Subscription deleted for customer ${customerId}. Downgraded to free.`);
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        if (account.metadata?.vendor_id) {
          const chargesEnabled = account.charges_enabled;
          await query(`
            UPDATE vendors SET charges_enabled = $1 WHERE stripe_account_id = $2
          `, [chargesEnabled, account.id]);
          console.log(`[Webhook] Connect account ${account.id} updated. Charges enabled: ${chargesEnabled}`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Webhook] Error processing event:`, err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
