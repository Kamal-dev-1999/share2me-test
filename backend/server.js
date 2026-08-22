'use strict';

require('dotenv').config({ path: __dirname + '/g2p/.env' });

// ─── Process stability (before any require) ───────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL:unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL:uncaughtException]', err);
  process.exit(1);
});

const express = require('express');
const http    = require('http');
const { Server }    = require('socket.io');
const { randomInt } = require('crypto');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createClient }      = require('redis');
const { createAdapter }     = require('@socket.io/redis-adapter');
const { otcToRoom, attachP2PSockets } = require('./p2p/socket');
const RateLimiter = require('./lib/RateLimiter');

const app    = express();
const server = http.createServer(app);

const DEV_ORIGINS = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'https://share2me-test.vercel.app', 
  'https://share2me.vercel.app', 
  'https://share2me.in', 
  'https://www.share2me.in',
  'https://share2.me'
];
const CORS_ORIGINS = process.env.ALLOWED_ORIGINS ? [...new Set([...process.env.ALLOWED_ORIGINS.split(','), ...DEV_ORIGINS])] : DEV_ORIGINS;

// Graceful shutdown — triggered by PM2 reload or systemd stop
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM — draining connections...');
  server.close(() => { console.log('[INFO] Server closed cleanly'); process.exit(0); });
  setTimeout(() => { console.error('[INFO] Drain timeout — forcing exit'); process.exit(1); }, 15_000);
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
  perMessageDeflate: {
    threshold:              128,
    zlibDeflateOptions:     { level: 3, memLevel: 7 },
    zlibInflateOptions:     { chunkSize: 16 * 1024 },
    serverNoContextTakeover: true,
    clientNoContextTakeover: true,
  },
  pingTimeout:       30_000,
  pingInterval:      25_000,
  maxHttpBufferSize: 2 * 1024 * 1024,
});

// ─── Redis Adapter (multi-container Socket.io state sharing) ─────────────────
// When REDIS_URL is set (production ECS), all backend container instances share
// Socket.io room state through Redis pub/sub. This allows User A on Container 1
// to signal User B on Container 2 seamlessly.
// When REDIS_URL is absent (local dev), the server works with in-memory state.
async function connectRedisAdapter() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Redis] REDIS_URL not set — using in-memory adapter (single-node mode)');
    return;
  }
  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => console.error('[Redis] pub error:', err.message));
    subClient.on('error', (err) => console.error('[Redis] sub error:', err.message));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log(`[Redis] Adapter connected to ${redisUrl}`);
  } catch (err) {
    // Non-fatal: if Redis is temporarily unavailable, fall back gracefully.
    // ECS health checks will restart the container if this is a hard failure.
    console.error('[Redis] Failed to connect — falling back to in-memory adapter:', err.message);
  }
}
connectRedisAdapter();

// ─── Metrics ──────────────────────────────────────────────────────────────────
const metrics = {
  roomsCreated:       0,
  roomsDestroyed:     0,
  connectionsTotal:   0,
  connectionsActive:  0,
  signalsRelayed:     0,
  rateLimitHits:      0,
  oversizedPayloads:  0,
  nackFloodsBlocked:  0,
};

// ─── TURN / ICE config (Metered — supports TCP + TLS/443 for corporate networks) ──
let cachedMeteredIceServers   = null;
let cachedMeteredIceServersAt = 0;
const METERED_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// ─── Security Middleware: Restrict access to Frontend Origins ─────────────────
app.use((req, res, next) => {
  // Always allow /ping for standard monitors
  if (req.path === '/ping') return next();
  
  // Allow UptimeRobot to hit /health
  if (req.path === '/health' && (req.headers['user-agent'] || '').includes('UptimeRobot')) return next();

  // Protect our backend API routes
  if (req.path.startsWith('/health') || req.path.startsWith('/api') || req.path.startsWith('/g2p')) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    
    let source = null;
    try {
      source = origin || (referer ? new URL(referer).origin : null);
    } catch (e) {
      // Ignore invalid referer URLs
    }

    // Some server-to-server endpoints (like /g2p/vendor-actions/upsert) use an internal Bearer token without an Origin.
    if (!source && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
       return next();
    }

    if (!source) {
      return res.status(403).json({ error: 'Direct API access forbidden. This API can only be accessed by the Share2Me frontend.' });
    }

    if (!CORS_ORIGINS.includes(source)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }

  next();
});

// ─── HTTP Endpoints ───────────────────────────────────────────────────────────

// Mount G2P module (Decoupled Phase 2)
app.use('/g2p', require('./g2p/index').g2pRouter);

app.get('/api/ice-servers', async (_req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  try {
    const now = Date.now();
    if (cachedMeteredIceServers && now - cachedMeteredIceServersAt < METERED_CACHE_TTL) {
      iceServers.push(...cachedMeteredIceServers);
    } else if (process.env.METERED_API_KEY) {
      const resp = await fetch(
        `https://share2.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          cachedMeteredIceServers   = data;
          cachedMeteredIceServersAt = now;
          iceServers.push(...data);
        }
      } else {
        console.error('[ICE] Metered API error:', resp.status);
      }
    }
  } catch (err) {
    console.error('[ICE] Failed to fetch Metered credentials:', err.message);
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ iceServers });
});

app.use('/poc', express.static('public'));

app.get('/ping', (_req, res) => res.status(200).send('pong'));

app.get('/health', (_req, res) => {
  const mem        = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const healthy    = heapUsedMB < 350;
  res.status(healthy ? 200 : 503).json({
    status:      healthy ? 'ok' : 'degraded',
    service:     'shareit-signaling',
    pid:         process.pid,
    uptime:      Math.round(process.uptime()),
    rooms:       otcToRoom.size,
    connections: metrics.connectionsActive,
    memory:      { heapUsedMB, rssMB: Math.round(mem.rss / 1024 / 1024) },
    ts:          Date.now(),
  });
});

app.get('/metrics', (req, res) => {
  if (process.env.METRICS_TOKEN && req.headers['x-metrics-token'] !== process.env.METRICS_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({
    ...metrics,
    roomsActive:    otcToRoom.size,
    uptimeSeconds:  Math.round(process.uptime()),
    pid:            process.pid,
    memory:         { heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
    ts:             Date.now(),
  });
});

// Proxy everything else to Next.js dev server
const NEXT_URL = process.env.NEXT_URL || 'http://localhost:3001';
app.use('/', createProxyMiddleware({
  target:       NEXT_URL,
  changeOrigin: true,
  on: {
    error: (err, _req, res) => {
      if (res && typeof res.writeHead === 'function') {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Next.js not reachable at ${NEXT_URL} — is it running?`);
      } else if (res && typeof res.destroy === 'function') {
        res.destroy();
      }
    },
  },
}));

// ─── Shared State ─────────────────────────────────────────────────────────────
const bannedIPs = new Map(); // ip  → unbanTimestamp
const connLimiter = new RateLimiter(60_000, 10);

// ─── Connection middleware ────────────────────────────────────────────────────
io.use((socket, next) => {
  const ip      = socket.handshake.address || 'unknown';
  const banUntil = bannedIPs.get(ip);
  if (banUntil && Date.now() < banUntil) return next(new Error('banned'));
  if (connLimiter.isRateLimited(ip)) { metrics.rateLimitHits++; return next(new Error('rate_limited')); }
  next();
});

// ─── Attach P2P Module ────────────────────────────────────────────────────────
attachP2PSockets(io, metrics, bannedIPs);

// ─── Attach G2P Module ────────────────────────────────────────────────────────
const { attachG2PSockets } = require('./g2p/socket');
attachG2PSockets(io, metrics, bannedIPs);

// ─── Global GC Janitor (every 2 min) ──────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs.entries()) if (now >= until) bannedIPs.delete(ip);
  connLimiter.prune();
}, 2 * 60_000);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[INFO] ShareIt signaling on :${PORT} (pid ${process.pid})`));