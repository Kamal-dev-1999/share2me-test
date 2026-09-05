'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  console.log('Running migration: add_allow_download_and_batch_id...');
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE printshop_jobs ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT true;
      ALTER TABLE printshop_jobs ADD COLUMN IF NOT EXISTS batch_id UUID;
      CREATE INDEX IF NOT EXISTS idx_printshop_jobs_batch ON printshop_jobs(batch_id);
    `);
    console.log('Migration successful: allow_download and batch_id columns ensured.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
