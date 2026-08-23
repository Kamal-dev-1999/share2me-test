require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Removing GiST index...');
    await client.query(`DROP INDEX IF EXISTS idx_printshop_settings_location;`);

    console.log('Removing location columns...');
    await client.query(`
      ALTER TABLE printshop_settings
      DROP COLUMN IF EXISTS location,
      DROP COLUMN IF EXISTS location_updated_at;
    `);

    await client.query('COMMIT');
    console.log('Rollback successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
