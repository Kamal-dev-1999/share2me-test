const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/../../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('Starting migration to add profile fields and plan_type...');
  try {
    const client = await pool.connect();
    
    // Add columns if they don't exist
    await client.query(`
      ALTER TABLE vendors 
      ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'FREE',
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS company TEXT,
      ADD COLUMN IF NOT EXISTS website TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT;
    `);

    console.log('Migration successful: Added plan_type, phone, company, website, bio to vendors.');
    
    // Update schema.sql to reflect these changes
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '../schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    if (!schema.includes('plan_type VARCHAR(20)')) {
      schema = schema.replace(
        'persona_selected BOOLEAN DEFAULT false',
        'persona_selected BOOLEAN DEFAULT false,\n  plan_type VARCHAR(20) DEFAULT \'FREE\',\n  phone TEXT,\n  company TEXT,\n  website TEXT,\n  bio TEXT'
      );
      fs.writeFileSync(schemaPath, schema);
      console.log('Updated schema.sql with new columns.');
    }

    client.release();
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

runMigration();
