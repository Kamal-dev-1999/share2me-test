const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log('Starting Stripe Connect migration...');
    await client.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_account_id TEXT');
    await client.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS charges_enabled BOOLEAN DEFAULT false');
    await client.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_per_page_bw NUMERIC(10, 2)');
    await client.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_per_page_color NUMERIC(10, 2)');
    console.log('Migration successful: Added Stripe Connect fields to vendors.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();