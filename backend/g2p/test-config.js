require('dotenv').config({ path: __dirname + '/.env' });
const { s3, R2_BUCKET } = require('./lib/storage');
const { HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { query } = require('./lib/db');

async function runTests() {
  console.log("🚀 Starting G2P Configuration Tests...\n");

  // 1. Test Supabase Database
  console.log("⏳ Testing Supabase PostgreSQL connection...");
  try {
    const res = await query('SELECT NOW() as time');
    console.log(`✅ Supabase Database connected successfully! (Server time: ${res.rows[0].time})\n`);
  } catch (err) {
    console.error("❌ Supabase connection failed!");
    console.error(err.message, "\n");
    return;
  }

  // 2. Test Cloudflare R2
  console.log(`⏳ Testing Cloudflare R2 configuration (Bucket: ${R2_BUCKET})...`);
  try {
    // Check if bucket exists
    await s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
    console.log("✅ Bucket found and accessible!");

    // Try a small write/delete to ensure Read & Write permissions
    const testKey = 'connection-test-' + Date.now() + '.txt';
    console.log("⏳ Testing write permissions...");
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: testKey,
      Body: 'Hello from Share2Me G2P!',
      ContentType: 'text/plain'
    }));
    console.log("✅ Write permission verified!");

    console.log("⏳ Testing delete permissions...");
    await s3.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: testKey
    }));
    console.log("✅ Delete permission verified!\n");

    console.log("🎉 All configurations are perfectly set up and ready for production!");
  } catch (err) {
    console.error("❌ Cloudflare R2 connection failed!");
    if (err.name === 'NotFound') {
      console.error(`Error: Bucket "${R2_BUCKET}" does not exist or your keys don't have access to it.`);
    } else {
      console.error(err.message);
    }
  }
}

runTests();
