/**
 * Migration: add_printshop.js
 * 
 * Creates the printshop_settings and printshop_jobs tables.
 * Also adds the `role` column to vendors.
 * 
 * Idempotent — safe to re-run. Uses ADD COLUMN IF NOT EXISTS and
 * CREATE TABLE IF NOT EXISTS throughout.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { query } = require('../lib/db');

async function run() {
  console.log('[Migration] Starting add_printshop...');

  // 1. Add role column to vendors table
  await query(`
    ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student'
      CHECK (role IN ('shopkeeper', 'student', 'assistant'))
  `);
  console.log('[Migration] vendors.role column: OK');

  // 2. Create printjob status type (idempotent — ignore error if exists)
  try {
    await query(`CREATE TYPE printjob_payment_status AS ENUM ('pending', 'paid', 'failed')`);
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
  try {
    await query(`CREATE TYPE printjob_print_type AS ENUM ('bw', 'color')`);
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
  try {
    await query(`CREATE TYPE printjob_payment_method AS ENUM ('online', 'cash')`);
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
  console.log('[Migration] ENUMs: OK');

  // 3. PrintShop Settings table (one row per shopkeeper vendor)
  await query(`
    CREATE TABLE IF NOT EXISTS printshop_settings (
      vendor_id        UUID PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
      bw_price         NUMERIC(8, 2) NOT NULL DEFAULT 2.00,
      color_price      NUMERIC(8, 2) NOT NULL DEFAULT 5.00,
      location_name    TEXT,
      qr_r2_key        TEXT,         -- R2 object key; served via short-lived pre-signed GET URL
      is_accepting     BOOLEAN NOT NULL DEFAULT true,
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] printshop_settings table: OK');

  // 4. PrintShop Jobs table
  await query(`
    CREATE TABLE IF NOT EXISTS printshop_jobs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_id        UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      sender_name      TEXT NOT NULL,
      document_name    TEXT NOT NULL,
      file_size_bytes  BIGINT NOT NULL,
      file_type        TEXT NOT NULL,
      pages            INT NOT NULL,
      print_type       printjob_print_type NOT NULL,
      price_per_page   NUMERIC(8, 2) NOT NULL,
      total_amount     NUMERIC(10, 2) NOT NULL,
      payment_method   printjob_payment_method NOT NULL,
      payment_status   printjob_payment_status NOT NULL DEFAULT 'pending',
      payment_id       TEXT,
      paid_at          TIMESTAMPTZ,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      deleted_at       TIMESTAMPTZ
    )
  `);
  console.log('[Migration] printshop_jobs table: OK');

  // 5. Check constraints (idempotent via DO block)
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'printshop_jobs_pages_check'
      ) THEN
        ALTER TABLE printshop_jobs ADD CONSTRAINT printshop_jobs_pages_check
          CHECK (pages > 0 AND pages <= 5000);
      END IF;
    END $$
  `);
  console.log('[Migration] Constraints: OK');

  // 6. Performance Indexes
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pj_vendor_status
      ON printshop_jobs(vendor_id, payment_status)
      WHERE deleted_at IS NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pj_vendor_created
      ON printshop_jobs(vendor_id, created_at DESC)
      WHERE deleted_at IS NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pj_vendor_paid_at
      ON printshop_jobs(vendor_id, paid_at DESC)
      WHERE payment_status = 'paid'
  `);
  console.log('[Migration] Indexes: OK');

  console.log('[Migration] add_printshop complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migration] FAILED:', err);
  process.exit(1);
});
