const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/../../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('🚀 Starting Supabase Database RLS & Access Hardening Migration...\n');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    console.log('1. Enabling Row-Level Security (RLS) on all application tables...');
    const tables = [
      'admin_activity_logs',
      'admin_blog_revisions',
      'admin_blogs',
      'admin_publishing_records',
      'files',
      'g2p_analytics_events',
      'printshop_jobs',
      'printshop_settings',
      'requests',
      'vendor_otps',
      'vendor_subscriptions',
      'vendors'
    ];

    for (const table of tables) {
      await client.query(`ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY;`);
      console.log(`   ✓ Enabled RLS on public.${table}`);
    }

    console.log('\n2. Revoking all permissions on public schema objects from anon and authenticated roles...');
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`);
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;`);
    await client.query(`REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;`);
    console.log('   ✓ Revoked ALL tables, sequences, and routines permissions from anon, authenticated.');

    console.log('\n3. Revoking USAGE on schema public from anon and authenticated...');
    await client.query(`REVOKE USAGE ON SCHEMA public FROM anon, authenticated;`);
    console.log('   ✓ Revoked USAGE on public schema.');

    console.log('\n4. Hardening future tables & sequences (Default Privileges)...');
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;`);
    console.log('   ✓ Altered default privileges for future objects.');

    await client.query('COMMIT;');
    console.log('\n🎉 Transaction committed successfully!\n');

    // Verification Step:
    console.log('=== VERIFICATION: Checking RLS status across public tables ===');
    const verifyRes = await client.query(`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname = ANY($1)
      ORDER BY c.relname;
    `, [tables]);
    console.table(verifyRes.rows);

    const allEnabled = verifyRes.rows.every(r => r.rls_enabled);
    if (allEnabled) {
      console.log('✅ All 12 application tables now have Row-Level Security strictly ENABLED!');
    } else {
      console.warn('⚠️ Warning: Some tables did not report RLS enabled.');
    }

    // Backend Access Verification:
    console.log('\n=== VERIFICATION: Testing Share2Me Backend Read Access as postgres ===');
    const vendorCount = await client.query('SELECT count(*) FROM public.vendors;');
    const jobCount = await client.query('SELECT count(*) FROM public.printshop_jobs;');
    console.log(`   ✓ Backend can read vendors table (${vendorCount.rows[0].count} rows found)`);
    console.log(`   ✓ Backend can read printshop_jobs table (${jobCount.rows[0].count} rows found)`);

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Migration failed, transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
