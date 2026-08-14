const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'g2p_event_type') THEN
        CREATE TYPE g2p_event_type AS ENUM (
            'page_view',
            'upload_received',
            'file_downloaded',
            'file_previewed'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS g2p_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id TEXT NOT NULL,
  sender_name TEXT,
  event_type g2p_event_type NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  file_type TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_g2p_analytics_vendor ON g2p_analytics_events(vendor_id, created_at DESC);
`;

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    await client.query(sql);
    console.log("Created table and indexes successfully.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
