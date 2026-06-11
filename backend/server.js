'use strict';

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

const app    = express();
const server = http.createServer(app);

// Graceful shutdown — triggered by PM2 reload or systemd stop
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM — draining connections...');
  server.close(() => { console.log('[INFO] Server closed cleanly'); process.exit(0); });
  setTimeout(() => { console.error('[INFO] Drain timeout — forcing exit'); process.exit(1); }, 15_000);
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  process.env.ALLOWED_ORIGINS?.split(',') || '*',
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

// ─── TURN / ICE config ────────────────────────────────────────────────────────
const TURN_CONFIG = {
  url:        process.env.TURN_URL        || '',
  username:   process.env.TURN_USERNAME   || '',
  credential: process.env.TURN_CREDENTIAL || '',
};

// ─── HTTP Endpoints ───────────────────────────────────────────────────────────
app.get('/api/ice-servers', (_req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  if (TURN_CONFIG.username && TURN_CONFIG.credential) {
    iceServers.push(
      { urls: TURN_CONFIG.url, username: TURN_CONFIG.username, credential: TURN_CONFIG.credential },
      { urls: `${TURN_CONFIG.url}?transport=tcp`, username: TURN_CONFIG.username, credential: TURN_CONFIG.credential },
    );
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ iceServers });
});

app.use('/poc', express.static('public'));

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
  ws:           true,
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

// ─── In-memory state ──────────────────────────────────────────────────────────
const otcToRoom = new Map(); // otc → { createdAt, metadata, ownerSocketId, ip }
const bannedIPs = new Map(); // ip  → unbanTimestamp

// ─── O(1) Fixed-window Rate Limiter ──────────────────────────────────────────
class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs    = windowMs;
    this.maxRequests = maxRequests;
    this.buckets     = new Map();
  }
  isRateLimited(key) {
    const now = Date.now();
    const b   = this.buckets.get(key);
    if (!b || now >= b.resetAt) { this.buckets.set(key, { count: 1, resetAt: now + this.windowMs }); return false; }
    if (b.count >= this.maxRequests) return true;
    b.count++;
    return false;
  }
  prune() {
    const now = Date.now();
    for (const [k, b] of this.buckets.entries()) if (now >= b.resetAt) this.buckets.delete(k);
  }
}

const connLimiter       = new RateLimiter(60_000, 10);
const createRoomLimiter = new RateLimiter(60_000, 3);
const joinRoomLimiter   = new RateLimiter(60_000, 10);
const signalLimiter     = new RateLimiter(60_000, 1_000);

// ─── OTC generation (6-digit, collision-safe) ────────────────────────────────
function genUniqueOTC() {
  for (let i = 0; i < 10; i++) {
    const otc = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!otcToRoom.has(otc)) return otc;
  }
  throw new Error('OTC space exhausted');
}

// ─── Payload guard ────────────────────────────────────────────────────────────
function checkPayloadSize(msg) {
  if (!msg) return true;
  try { return (typeof msg === 'string' ? msg : JSON.stringify(msg)).length <= 2 * 1024 * 1024; }
  catch { return false; }
}

// ─── Connection middleware ────────────────────────────────────────────────────
io.use((socket, next) => {
  const ip      = socket.handshake.address || 'unknown';
  const banUntil = bannedIPs.get(ip);
  if (banUntil && Date.now() < banUntil) return next(new Error('banned'));
  if (connLimiter.isRateLimited(ip)) { metrics.rateLimitHits++; return next(new Error('rate_limited')); }
  next();
});

// ─── Socket events ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const ip = socket.handshake.address || 'unknown';
  metrics.connectionsTotal++;
  metrics.connectionsActive++;

  const nackTracker = new Map(); // `${otc}:${seq}` → retryCount

  // ── create_room ─────────────────────────────────────────────────────────────
  socket.on('create_room', (cb) => {
    try {
      if (createRoomLimiter.isRateLimited(ip)) { metrics.rateLimitHits++; return cb?.({ error: 'rate_limited' }); }
      const otc = genUniqueOTC();
      otcToRoom.set(otc, { createdAt: Date.now(), metadata: null, ownerSocketId: socket.id, ip });
      socket.join(otc);
      socket.roomOTC = otc;
      metrics.roomsCreated++;
      cb?.({ otc });
    } catch (err) { console.error('[create_room]', err.message); cb?.({ error: 'internal_error' }); }
  });

  // ── sender_ready: store metadata + relay to any already-joined receiver ──────
  socket.on('sender_ready', ({ otc, metadata } = {}) => {
    try {
      if (!otc || !metadata) return;
      if (!checkPayloadSize({ otc, metadata })) { metrics.oversizedPayloads++; socket.disconnect(true); return; }
      const room = otcToRoom.get(otc);
      if (!room) return;
      if (room.ownerSocketId !== socket.id) return; // ownership check
      room.metadata = metadata;
      socket.to(otc).emit('metadata_relay', { metadata });
    } catch (err) { console.error('[sender_ready]', err.message); }
  });

  // ── join_room: relay cached metadata to late-joining receiver ───────────────
  socket.on('join_room', ({ otc } = {}, cb) => {
    try {
      const now      = Date.now();
      const banUntil = bannedIPs.get(ip);
      if (banUntil && now < banUntil) return cb?.({ error: 'rate_limited' });
      if (joinRoomLimiter.isRateLimited(ip)) {
        metrics.rateLimitHits++;
        bannedIPs.set(ip, now + 5 * 60_000); // 5-min temp ban
        return cb?.({ error: 'rate_limited' });
      }
      if (!otcToRoom.has(otc)) return cb?.({ error: 'not_found' });
      socket.join(otc);
      socket.roomOTC = otc;
      cb?.({ ok: true });
      const room = otcToRoom.get(otc);
      if (room?.metadata) socket.emit('metadata_relay', { metadata: room.metadata });
    } catch (err) { console.error('[join_room]', err.message); cb?.({ error: 'internal_error' }); }
  });

  // ── generic relay ────────────────────────────────────────────────────────────
  const handleRelay = (eventName, msg) => {
    if (!msg?.otc) return;
    if (!checkPayloadSize(msg)) { metrics.oversizedPayloads++; socket.disconnect(true); return; }
    if (signalLimiter.isRateLimited(socket.id)) { metrics.rateLimitHits++; socket.disconnect(true); return; }
    socket.to(msg.otc).emit(eventName, msg);
    metrics.signalsRelayed++;
  };

  socket.on('signal',       (msg) => handleRelay('signal', msg));
  socket.on('receiver_pub', (msg) => handleRelay('receiver_pub', msg));
  socket.on('wrapped_key',  (msg) => handleRelay('wrapped_key', msg));
  socket.on('key_exchange', (msg) => handleRelay('key_exchange', msg));
  socket.on('ack',          (msg) => handleRelay('ack', msg));

  // ── nack: with per-chunk flood protection ────────────────────────────────────
  socket.on('nack', (msg) => {
    if (!msg?.otc || !Array.isArray(msg.missingSeqs)) return;
    for (const seq of msg.missingSeqs) {
      const key     = `${msg.otc}:${seq}`;
      const retries = (nackTracker.get(key) || 0) + 1;
      if (retries > 10) {
        metrics.nackFloodsBlocked++;
        console.warn(`[nack] Flood from ${socket.id}, chunk ${seq} requested ${retries}×`);
        socket.disconnect(true);
        return;
      }
      nackTracker.set(key, retries);
    }
    handleRelay('nack', msg);
  });

  // ── transfer_complete: notify peers + schedule room cleanup ─────────────────
  socket.on('transfer_complete', (msg) => {
    handleRelay('transfer_complete', msg);
    if (!msg?.otc) return;
    io.to(msg.otc).emit('room_closing', { otc: msg.otc, reason: 'transfer_complete' });
    setTimeout(() => {
      const socketsInRoom = io.sockets.adapter.rooms.get(msg.otc);
      if (!socketsInRoom || socketsInRoom.size === 0) { otcToRoom.delete(msg.otc); metrics.roomsDestroyed++; }
    }, 60_000);
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    metrics.connectionsActive--;
    nackTracker.clear();
    const otc = socket.roomOTC;
    if (!otc) return;
    const room = io.sockets.adapter.rooms.get(otc);
    if (!room || room.size === 0) { otcToRoom.delete(otc); metrics.roomsDestroyed++; }
  });
});

// ─── GC Janitor (every 2 min) ─────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now(); let pruned = 0;
  for (const [otc, room] of otcToRoom.entries()) {
    const hasSockets  = (io.sockets.adapter.rooms.get(otc)?.size ?? 0) > 0;
    const isExpired   = now - room.createdAt > 30 * 60_000;
    const isAbandoned = !hasSockets && now - room.createdAt > 90_000;
    if (isExpired || isAbandoned) { otcToRoom.delete(otc); metrics.roomsDestroyed++; pruned++; }
  }
  for (const [ip, until] of bannedIPs.entries()) if (now >= until) bannedIPs.delete(ip);
  connLimiter.prune(); createRoomLimiter.prune(); joinRoomLimiter.prune(); signalLimiter.prune();
  if (pruned > 0) console.log(`[GC] Pruned ${pruned} rooms. Active: ${otcToRoom.size}, Conns: ${metrics.connectionsActive}`);
}, 2 * 60_000);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[INFO] ShareIt signaling on :${PORT} (pid ${process.pid})`));