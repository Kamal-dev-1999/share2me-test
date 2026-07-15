const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://placeholder_user:placeholder_password@placeholder_host:5432/placeholder_db'
});

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
