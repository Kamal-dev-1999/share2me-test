require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding upi_id and upi_name to printshop_settings...');
    await client.query(`
      ALTER TABLE printshop_settings 
      ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS upi_name VARCHAR(255)
    `);

    // Ensure status defaults to pending if it's new
    await client.query(`
      ALTER TABLE printshop_settings 
      ALTER COLUMN bank_verification_status SET DEFAULT 'pending'
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
