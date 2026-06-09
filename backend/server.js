const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomInt } = require('crypto');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// ─── TURN credential config (set these in your environment variables) ─────────
// Never hardcode credentials in client-side code — serve them from here instead.
// On Render: add TURN_URL, TURN_USERNAME, TURN_CREDENTIAL as environment variables.
const TURN_CONFIG = {
  url: process.env.TURN_URL || 'turn:free.expressturn.com:3478',
  username: process.env.TURN_USERNAME || '00000000002096297695',
  credential: process.env.TURN_CREDENTIAL || 'zVlnXteQh/ygNA5w0dsumVPPFIo=',
};

// ─── ICE servers endpoint — frontend fetches this instead of hardcoding ───────
// Always returns fresh credentials. When ExpressTurn rotates them, you only
// need to update the env vars and restart — no frontend redeploy needed.
app.get('/api/ice-servers', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (TURN_CONFIG.username && TURN_CONFIG.credential) {
    iceServers.push(
      {
        urls: TURN_CONFIG.url,
        username: TURN_CONFIG.username,
        credential: TURN_CONFIG.credential,
      },
      {
        urls: TURN_CONFIG.url + '?transport=tcp',
        username: TURN_CONFIG.username,
        credential: TURN_CONFIG.credential,
      }
    );
  }

  // Cache for 5 minutes — balances freshness vs. server load
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ iceServers });
});

// Serve plain-HTML POC from public/
app.use('/poc', express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'share2me-signaling', ts: Date.now() });
});

const NEXT_URL = process.env.NEXT_URL;
if (NEXT_URL) {
  app.use(
    '/',
    createProxyMiddleware({
      target: NEXT_URL,
      changeOrigin: true,
      ws: true,
      on: {
        error: (err, req, res) => {
          if (res && typeof res.writeHead === 'function') {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Next.js not reachable at ${NEXT_URL} — is it running?`);
          } else if (res && typeof res.destroy === 'function') {
            res.destroy();
          }
        },
      },
    })
  );
} else {
  app.get('/', (req, res) => {
    res.json({
      service: 'Share2Me Signaling Server',
      status: 'running',
      note: 'Connect your frontend by setting NEXT_PUBLIC_SIGNAL_URL to this server URL.',
    });
  });
}

// ─── In-memory state ──────────────────────────────────────────────────────────
const otcToRoom = new Map();   // otc → { createdAt, metadata, ownerSocketId }
const bannedIPs = new Map();   // ip → unbanTime

class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  isRateLimited(key) {
    const now = Date.now();
    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter((ts) => now - ts < this.windowMs);
    if (timestamps.length >= this.maxRequests) {
      this.requests.set(key, timestamps);
      return true;
    }
    timestamps.push(now);
    this.requests.set(key, timestamps);
    return false;
  }

  prune() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const active = timestamps.filter((ts) => now - ts < this.windowMs);
      if (active.length === 0) this.requests.delete(key);
      else this.requests.set(key, active);
    }
  }
}

const connLimiter = new RateLimiter(60 * 1000, 10);
const createRoomLimiter = new RateLimiter(60 * 1000, 3);
const joinRoomLimiter = new RateLimiter(60 * 1000, 10);
const signalLimiter = new RateLimiter(60 * 1000, 1000);

function genOTC() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function checkPayloadSize(msg) {
  if (!msg) return true;
  try {
    const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
    return str.length <= 2 * 1024 * 1024; // 2 MB limit
  } catch {
    return false;
  }
}

// ─── Connection middleware ─────────────────────────────────────────────────────
io.use((socket, next) => {
  const ip = socket.handshake.address || 'unknown';
  const now = Date.now();
  const banUntil = bannedIPs.get(ip);
  if (banUntil && now < banUntil) return next(new Error('banned'));
  if (connLimiter.isRateLimited(ip)) return next(new Error('rate_limited_connections'));
  next();
});

// ─── Socket events ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const ip = socket.handshake.address || 'unknown';

  socket.on('create_room', (cb) => {
    if (createRoomLimiter.isRateLimited(ip)) {
      return cb && cb({ error: 'rate_limited' });
    }
    const otc = genOTC();
    // Store ownerSocketId so only the real sender can overwrite metadata
    // Store ip to allow nearby discovery
    otcToRoom.set(otc, { createdAt: Date.now(), metadata: null, ownerSocketId: socket.id, ip });
    socket.join(otc);
    socket.roomOTC = otc;
    if (cb) cb({ otc });
  });

  socket.on('search_nearby', (cb) => {
    const nearbyOTCs = [];
    for (const [otc, room] of otcToRoom.entries()) {
      if (room.ip === ip && room.ownerSocketId !== socket.id) {
        // Only return rooms that are on the same public IP and not created by this socket
        nearbyOTCs.push({
          otc,
          createdAt: room.createdAt,
          metadata: room.metadata
        });
      }
    }
    cb && cb({ devices: nearbyOTCs });
  });

  socket.on('sender_ready', ({ otc, metadata }) => {
    if (!otc || !metadata) return;

    if (!checkPayloadSize({ otc, metadata })) {
      console.warn(`Oversized sender_ready payload from ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    const room = otcToRoom.get(otc);
    if (!room) return;

    // ── Ownership check: only the socket that created the room can set metadata ──
    if (room.ownerSocketId !== socket.id) {
      console.warn(`Unauthorized sender_ready attempt on OTC ${otc} by ${socket.id}`);
      return;
    }

    room.metadata = metadata;
    // Relay to all OTHER sockets in the room (the receiver)
    socket.to(otc).emit('metadata_relay', { metadata });
  });

  socket.on('join_room', ({ otc }, cb) => {
    const now = Date.now();
    const banUntil = bannedIPs.get(ip);
    if (banUntil && now < banUntil) return cb && cb({ error: 'rate_limited' });

    if (joinRoomLimiter.isRateLimited(ip)) {
      console.warn(`IP ${ip} temporarily banned for excessive join_room attempts`);
      bannedIPs.set(ip, now + 5 * 60 * 1000);
      return cb && cb({ error: 'rate_limited' });
    }

    if (!otcToRoom.has(otc)) return cb && cb({ error: 'not_found' });
    socket.join(otc);
    socket.roomOTC = otc;
    cb && cb({ ok: true });

    // Send cached metadata immediately if sender is already ready
    const room = otcToRoom.get(otc);
    if (room?.metadata) {
      socket.emit('metadata_relay', { metadata: room.metadata });
    }
  });

  // ── Generic secure relay ───────────────────────────────────────────────────
  const handleRelay = (eventName, msg) => {
    if (!msg || !msg.otc) return;

    if (!checkPayloadSize(msg)) {
      console.warn(`Oversized ${eventName} payload from ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    if (signalLimiter.isRateLimited(socket.id)) {
      console.warn(`Signal rate limit hit by ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    socket.to(msg.otc).emit(eventName, msg);
  };

  socket.on('signal', (msg) => handleRelay('signal', msg));
  socket.on('receiver_pub', (msg) => handleRelay('receiver_pub', msg));
  socket.on('wrapped_key', (msg) => handleRelay('wrapped_key', msg));
  socket.on('key_exchange', (msg) => handleRelay('key_exchange', msg));
  socket.on('nack', (msg) => handleRelay('nack', msg));
  socket.on('ack', (msg) => handleRelay('ack', msg));
  socket.on('transfer_complete', (msg) => handleRelay('transfer_complete', msg));

  socket.on('disconnect', () => {
    const otc = socket.roomOTC;
    if (!otc) return;
    const room = io.sockets.adapter.rooms.get(otc);
    if (!room || room.size === 0) {
      otcToRoom.delete(otc);
    }
  });
});

// ─── GC Janitor ───────────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [otc, room] of otcToRoom.entries()) {
    const socketsInRoom = io.sockets.adapter.rooms.get(otc);
    const hasSockets = socketsInRoom && socketsInRoom.size > 0;
    if (now - room.createdAt > 30 * 60 * 1000 || (!hasSockets && now - room.createdAt > 60 * 1000)) {
      otcToRoom.delete(otc);
    }
  }
  for (const [ip, banUntil] of bannedIPs.entries()) {
    if (now >= banUntil) bannedIPs.delete(ip);
  }
  connLimiter.prune();
  createRoomLimiter.prune();
  joinRoomLimiter.prune();
  signalLimiter.prune();
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling server running on http://localhost:${PORT}`));