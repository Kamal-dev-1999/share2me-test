const express = require('express');
const { query } = require('../lib/db');
const { JWT_SECRET } = require('../lib/auth');
const { SignJWT, jwtVerify } = require('jose');

const router = express.Router();

router.get('/', async (req, res) => {
  const health = { status: 'ok', checks: {}, ts: Date.now() };
  
  // 1. DB Check
  try {
    await query('SELECT 1');
    health.checks.db = 'ok';
  } catch (e) {
    health.checks.db = 'failed';
    health.status = 'degraded';
  }

  // 2. JWT Config Check (Critical to ensure frontend and backend are synced)
  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const testToken = await new SignJWT({ test: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1m')
      .sign(secretKey);
    await jwtVerify(testToken, secretKey);
    health.checks.jwt = 'ok';
  } catch (e) {
    health.checks.jwt = 'failed';
    health.status = 'degraded';
  }

  // 3. R2 Config Check
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
    health.checks.r2 = 'configured';
  } else {
    health.checks.r2 = 'missing_credentials';
    // Not failing the whole server if just R2 is missing locally, but flag it
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

module.exports = router;
