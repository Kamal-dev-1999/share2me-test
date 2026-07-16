const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined in backend/.env!");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function init() {
  console.log("Connecting to database and running schema.sql...");
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log("Database initialized successfully with G2P schema!");
  } catch (err) {
    console.error("Error initializing database schema:", err);
  } finally {
    await pool.end();
  }
}

init();
