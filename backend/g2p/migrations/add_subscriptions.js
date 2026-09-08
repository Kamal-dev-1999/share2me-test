const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../lib/db');

async function runMigration() {
  console.log('Running subscription table migration...');
  try {
    // 1. Create vendor_subscriptions table
    await query(`
      CREATE TABLE IF NOT EXISTS vendor_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
        plan_id VARCHAR(50) DEFAULT 'pro_monthly',
        amount NUMERIC(10, 2) NOT NULL DEFAULT 499.00,
        currency VARCHAR(10) DEFAULT 'INR',
        razorpay_order_id TEXT UNIQUE NOT NULL,
        razorpay_payment_id TEXT UNIQUE,
        razorpay_signature TEXT,
        status VARCHAR(30) DEFAULT 'created',
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_vendor ON vendor_subscriptions(vendor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_order ON vendor_subscriptions(razorpay_order_id);
    `);

    // 2. Add subscription columns to vendors
    await query(`
      ALTER TABLE vendors 
        ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';
    `);

    // 3. Reset previously mock-upgraded vendors (who never paid) to FREE
    const resetRes = await query(`
      UPDATE vendors
      SET plan_type = 'FREE',
          subscription_tier = 'free',
          subscription_status = 'none',
          subscription_ends_at = NULL,
          subscription_starts_at = NULL
      WHERE plan_type = 'PRO' AND subscription_ends_at IS NULL
      RETURNING id, name, email;
    `);

    console.log(`Reset ${resetRes.rowCount} unverified test accounts back to FREE.`);
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
