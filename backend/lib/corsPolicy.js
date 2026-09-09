/**
 * Unified CORS & Origin Security Policy for Share2Me Backend & Socket.io
 * Supports an "OR mechanism":
 * 1. Explicitly configured ALLOWED_ORIGINS
 * 2. Any Cloud Run domain (*.run.app)
 * 3. Any Share2Me domain (share2me.in, *.share2me.in, share2.me, *.share2.me)
 * 4. Staging / Preview domains (*.vercel.app)
 * 5. Localhost development (localhost, 127.0.0.1)
 */

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://share2me-test.vercel.app',
  'https://share2me.vercel.app',
  'https://share2me.in',
  'https://www.share2me.in',
  'https://share2.me',
  'https://www.share2.me',
];

const envAllowed = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const EXPLICIT_ORIGINS = [...new Set([...envAllowed, ...DEV_ORIGINS])];

function isOriginAllowed(origin) {
  // Allow requests without Origin (curl, server-to-server, native apps, healthchecks)
  if (!origin || origin === 'null') {
    return true;
  }

  const trimmed = origin.trim();

  // 1. Explicit list match
  if (EXPLICIT_ORIGINS.includes(trimmed)) {
    return true;
  }

  // 2. Cloud Run domains
  if (trimmed.endsWith('.run.app') || trimmed.includes('.a.run.app')) {
    return true;
  }

  // 3. Domain suffix checks via URL hostname
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (
      host === 'share2me.in' ||
      host.endsWith('.share2me.in') ||
      host === 'share2.me' ||
      host.endsWith('.share2.me') ||
      host.endsWith('.run.app') ||
      host.endsWith('.vercel.app') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return true;
    }
  } catch (_e) {
    // If URL parsing fails, check string patterns
    if (
      trimmed.endsWith('.run.app') ||
      trimmed.endsWith('.share2me.in') ||
      trimmed.endsWith('.share2.me')
    ) {
      return true;
    }
  }

  return false;
}

const socketCorsOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  console.warn(`[Socket.io CORS Blocked] Origin: ${origin}`);
  return callback(new Error(`Origin not allowed by Socket.io CORS: ${origin}`));
};

const expressCorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[Express CORS Blocked] Origin: ${origin}`);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-status-token',
    'x-session-token',
    'x-metrics-token',
  ],
};

module.exports = {
  DEV_ORIGINS,
  EXPLICIT_ORIGINS,
  isOriginAllowed,
  socketCorsOrigin,
  expressCorsOptions,
};
