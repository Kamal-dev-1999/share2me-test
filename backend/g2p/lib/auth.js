const { jwtVerify } = require('jose');
const { getSharedJwtSecret } = require('../../lib/config');

// Canonical name is AUTH_JWT_SECRET; JWT_SECRET / AUTH_SECRET are accepted
// aliases so older deployments keep working. See backend/lib/config.js.
const _JWT_SECRET = getSharedJwtSecret();
const JWT_SECRET = _JWT_SECRET;
const secretKey = new TextEncoder().encode(_JWT_SECRET);

/**
 * Verifies a JWT token issued by the frontend Auth.js.
 * @param {string} token 
 * @returns {object|null} The payload if valid, null otherwise
 */
async function verifyVendorJWT(token) {
  if (!token) return null;
  
  try {
    const { payload } = await jwtVerify(token, secretKey);
    // payload should contain the vendor info (e.g., email, or custom vendor id).
    // The NextAuth JWT callback should be configured to inject vendorId into the token.
    return payload;
  } catch (err) {
    console.error('[Auth] JWT Verification failed:', err.message);
    return null;
  }
}

module.exports = {
  verifyVendorJWT,
  JWT_SECRET: _JWT_SECRET, // exported for the health check
};
