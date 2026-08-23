require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Add columns to printshop_settings
    console.log('Adding bank_last4 and bank_verification_status to printshop_settings...');
    await client.query(`
      ALTER TABLE printshop_settings 
      ADD COLUMN IF NOT EXISTS bank_last4 VARCHAR(4),
      ADD COLUMN IF NOT EXISTS bank_verification_status VARCHAR(20) DEFAULT 'pending'
    `);
    
    // 2. Create vendor_otps table
    console.log('Creating vendor_otps table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Add index for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_otps_vendor_id ON vendor_otps(vendor_id)
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
