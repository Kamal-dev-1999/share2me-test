'use strict';

/**
 * Admin Authentication & Authorization Middleware
 * Verifies that the requester is an authorized admin whose email is in AUTHORIZED_ADMIN_EMAILS.
 */

function getAuthorizedAdminEmails() {
  const rawEnv = process.env.AUTHORIZED_ADMIN_EMAILS || '';
  if (!rawEnv.trim()) {
    // Default fallback for dev environment if env is missing
    return ['admin@share2.me', 'rishabh@share2.me', 'rishabhdev2026@gmail.com', 'rishabhyadav5281@gmail.com'];
  }
  return rawEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function adminAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const clientSecret = req.headers['x-admin-secret'];
    const emailHeader = req.headers['x-admin-email'] || req.query.admin_email;

    // Check shared secret or NextAuth authorization header
    const expectedSecret = process.env.AUTH_SECRET;
    const isSecretValid = expectedSecret && (
      (authHeader && authHeader === `Bearer ${expectedSecret}`) ||
      (clientSecret && clientSecret === expectedSecret)
    );

    // Extract email
    const email = (emailHeader || (req.body && req.body.adminEmail) || '').toString().trim().toLowerCase();
    const authorizedList = getAuthorizedAdminEmails();

    if (!email) {
      return res.status(401).json({
        error: 'Authentication required. No admin email provided.',
        code: 'MISSING_ADMIN_EMAIL',
      });
    }

    if (!authorizedList.includes(email)) {
      console.warn(`[AdminAuth] Access DENIED for unauthorized email: "${email}"`);
      return res.status(403).json({
        error: 'You are not authorized to access the Admin Portal.',
        code: 'UNAUTHORIZED_ADMIN',
      });
    }

    // Attach verified email to request context
    req.adminEmail = email;
    next();
  } catch (err) {
    console.error('[AdminAuth] Error in authorization middleware:', err);
    return res.status(500).json({ error: 'Internal server error during authorization check.' });
  }
}

module.exports = {
  adminAuthMiddleware,
  getAuthorizedAdminEmails,
};
