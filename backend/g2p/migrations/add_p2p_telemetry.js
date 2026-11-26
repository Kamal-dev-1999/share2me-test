'use strict';

const fs = require('fs');
const path = require('path');

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
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 Running migration: add_p2p_telemetry...');
  const client = await pool.connect();
  try {
    await client.query(`
      -- 1. Detailed P2P Transfer Events Table (zero PII, privacy-first)
      CREATE TABLE IF NOT EXISTS p2p_transfer_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_size_bytes BIGINT NOT NULL,
        file_type_category VARCHAR(50) DEFAULT 'other',
        chunks_count INTEGER DEFAULT 1,
        is_text_mode BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_p2p_transfer_events_created_at ON p2p_transfer_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_p2p_transfer_events_category ON p2p_transfer_events(file_type_category);

      -- 2. Fast Rollup/Aggregate Totals Table
      CREATE TABLE IF NOT EXISTS p2p_telemetry_totals (
        id INTEGER PRIMARY KEY DEFAULT 1,
        total_transfers BIGINT NOT NULL DEFAULT 0,
        total_bytes BIGINT NOT NULL DEFAULT 0,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO p2p_telemetry_totals (id, total_transfers, total_bytes)
      VALUES (1, 0, 0)
      ON CONFLICT (id) DO NOTHING;

      -- 3. Row-Level Security Hardening (PostgREST lockdown)
      ALTER TABLE p2p_transfer_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE p2p_telemetry_totals ENABLE ROW LEVEL SECURITY;

      REVOKE ALL ON p2p_transfer_events FROM anon, authenticated;
      REVOKE ALL ON p2p_telemetry_totals FROM anon, authenticated;
    `);

    console.log('✅ Migration successful: p2p_transfer_events and p2p_telemetry_totals tables created with RLS enabled.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
