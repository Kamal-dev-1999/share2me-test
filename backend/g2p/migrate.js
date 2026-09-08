const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load shared environment file
require('dotenv').config({ path: path.join(__dirname, './.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  console.log("Starting G2P database migration...");
  const client = await pool.connect();
  try {
    // Add billing and subscription fields to vendors table
    await client.query(`
      ALTER TABLE vendors 
        ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();

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
    console.log("Migration executed successfully! Subscription columns and tables added.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
