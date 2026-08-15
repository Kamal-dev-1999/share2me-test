const { jwtVerify } = require('jose');

// This secret MUST match the NextAuth AUTH_SECRET in the frontend exactly!
const JWT_SECRET = process.env.AUTH_JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL] AUTH_JWT_SECRET environment variable is not set.');
  }
  console.warn('[Auth] WARNING: AUTH_JWT_SECRET not set. Using insecure placeholder for local dev only.');
}
const _JWT_SECRET = JWT_SECRET || 'placeholder_jwt_secret_local_dev_only';
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
