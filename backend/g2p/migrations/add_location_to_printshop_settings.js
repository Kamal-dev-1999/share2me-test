require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Enabling PostGIS extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');

    console.log('Adding location geography column to printshop_settings...');
    
    await client.query(`
      ALTER TABLE printshop_settings
      ADD COLUMN IF NOT EXISTS location geography(Point, 4326),
      ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
    `);

    console.log('Creating GiST index for location...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_printshop_settings_location
      ON printshop_settings
      USING GIST (location);
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
