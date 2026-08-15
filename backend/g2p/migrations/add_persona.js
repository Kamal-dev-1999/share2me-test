const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS persona VARCHAR(20) DEFAULT 'PERSONAL'`);
    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS persona_selected BOOLEAN DEFAULT false`);
    console.log("Migration successful: added persona and persona_selected to vendors.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
