'use strict';

const fs = require('fs');
const path = require('path');

// Try loading from backend/g2p/.env, backend/.env, or root .env
const candidateEnvPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env')
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

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
