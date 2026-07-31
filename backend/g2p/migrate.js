const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load shared environment file

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  console.log("Starting G2P database migration...");
  const client = await pool.connect();
  try {
    // Add billing fields to vendors table
    await client.query(`
      ALTER TABLE vendors 
        ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS subscription_status TEXT,
        ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
    `);
    console.log("Migration executed successfully! Subscription columns added.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
