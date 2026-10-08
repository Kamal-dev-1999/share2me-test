const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://placeholder_user:placeholder_password@placeholder_host:5432/placeholder_db'
});

// Idempotent column safety check for vendor onboarding state
pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_setup_completed BOOLEAN DEFAULT false;`).catch(() => {});

// Helper to get a client for transactions
async function getTransactionClient() {
  const client = await pool.connect();
  return client;
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getTransactionClient,
};
