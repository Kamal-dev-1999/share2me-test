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

// Serve plain-HTML POC from public/
app.use('/poc', express.static('public'));

// Health check endpoint (used by Render and uptime monitors)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'share2me-signaling', ts: Date.now() });
});

// Only proxy to Next.js dev server in local development.
// In production (Render), NEXT_URL is not set, so we skip the proxy
// and serve a simple status page — the frontend is deployed separately.
const NEXT_URL = process.env.NEXT_URL;
if (NEXT_URL) {
  app.use(
    '/',
    createProxyMiddleware({
      target: NEXT_URL,
      changeOrigin: true,
      ws: true,  // also proxy Next.js HMR websocket
      on: {
        error: (err, req, res) => {
          // res may be a raw Socket (for WS upgrades) which has no writeHead
          if (res && typeof res.writeHead === 'function') {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Next.js not reachable at ${NEXT_URL} — is it running?`);
          } else if (res && typeof res.destroy === 'function') {
            res.destroy(); // cleanly close the socket
          }
        },
      },
    })
  );
} else {
  // Production fallback — signal server is running, frontend is hosted elsewhere
  app.get('/', (req, res) => {
    res.json({
      service: 'Share2Me Signaling Server',
      status: 'running',
      note: 'Connect your frontend by setting NEXT_PUBLIC_SIGNAL_URL to this server URL.',
    });
  });
}

// Simple in-memory maps for rooms and rate-limiting
const otcToRoom = new Map();
const bannedIPs = new Map(); // ip -> unbanTime

class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map(); // key -> array of timestamps
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
      if (active.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, active);
      }
    }
  }
}

// Instantiate rate limiters
const connLimiter = new RateLimiter(60 * 1000, 10);        // 10 connections / min
const createRoomLimiter = new RateLimiter(60 * 1000, 3);   // 3 rooms / min
const joinRoomLimiter = new RateLimiter(60 * 1000, 10);    // 10 join attempts / min
const signalLimiter = new RateLimiter(60 * 1000, 120);     // 120 signals / min (per socket id)

function genOTC() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function checkPayloadSize(msg) {
  if (!msg) return true;
  try {
    const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (str.length > 100 * 1024) { // 100 KB limit
      return false;
    }
  } catch (e) {
    return false;
  }
  return true;
}

// Connection middleware to apply connection rate limit and check IP bans
io.use((socket, next) => {
  const ip = socket.handshake.address || 'unknown';

  const now = Date.now();
  const banUntil = bannedIPs.get(ip);
  if (banUntil && now < banUntil) {
    return next(new Error('banned'));
  }

  if (connLimiter.isRateLimited(ip)) {
    return next(new Error('rate_limited_connections'));
  }

  next();
});

io.on('connection', (socket) => {
  const ip = socket.handshake.address || 'unknown';

  socket.on('create_room', (cb) => {
    if (createRoomLimiter.isRateLimited(ip)) {
      return cb && cb({ error: 'rate_limited' });
    }
    const otc = genOTC();
    otcToRoom.set(otc, { createdAt: Date.now(), metadata: null });
    socket.join(otc);
    socket.roomOTC = otc;
    if (cb) cb({ otc });
  });

  socket.on('sender_ready', ({ otc, metadata }) => {
    if (!otc || !metadata) return;
    if (!checkPayloadSize({ otc, metadata })) {
      console.warn(`Disallowed payload size on sender_ready from ${socket.id}`);
      socket.disconnect(true);
      return;
    }
    const room = otcToRoom.get(otc);
    if (!room) return;
    room.metadata = metadata;
    socket.to(otc).emit('metadata_relay', { metadata });
  });

  socket.on('join_room', ({ otc }, cb) => {
    const now = Date.now();
    const banUntil = bannedIPs.get(ip);
    if (banUntil && now < banUntil) {
      return cb && cb({ error: 'rate_limited' });
    }

    if (joinRoomLimiter.isRateLimited(ip)) {
      console.warn(`IP ${ip} temporarily banned due to excessive join_room attempts`);
      bannedIPs.set(ip, now + 5 * 60 * 1000); // 5-minute ban
      return cb && cb({ error: 'rate_limited' });
    }

    if (!otcToRoom.has(otc)) return cb && cb({ error: 'not_found' });
    socket.join(otc);
    socket.roomOTC = otc;
    cb && cb({ ok: true });

    const room = otcToRoom.get(otc);
    if (room?.metadata) {
      socket.emit('metadata_relay', { metadata: room.metadata });
    }
  });

  // Reusable helper to relay/broadcast events securely
  const handleRelay = (eventName, msg) => {
    if (!msg || !msg.otc) return;

    if (!checkPayloadSize(msg)) {
      console.warn(`Disallowed payload size on ${eventName} from ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    if (signalLimiter.isRateLimited(socket.id)) {
      console.warn(`Signaling rate limit exceeded by ${socket.id}`);
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

  socket.on('disconnect', () => {
    const otc = socket.roomOTC;
    if (!otc) return;
    const room = io.sockets.adapter.rooms.get(otc);
    if (!room || room.size === 0) {
      otcToRoom.delete(otc);
    }
  });
});

// GC Janitor: runs every 5 minutes to prune expired/empty rooms and stale rate limit caches
setInterval(() => {
  const now = Date.now();

  // 1. Prune rooms older than 30 minutes, or empty rooms older than 1 minute
  for (const [otc, room] of otcToRoom.entries()) {
    const socketsInRoom = io.sockets.adapter.rooms.get(otc);
    const hasSockets = socketsInRoom && socketsInRoom.size > 0;

    if (now - room.createdAt > 30 * 60 * 1000 || (!hasSockets && now - room.createdAt > 60 * 1000)) {
      otcToRoom.delete(otc);
    }
  }

  // 2. Prune expired IP bans
  for (const [ip, banUntil] of bannedIPs.entries()) {
    if (now >= banUntil) {
      bannedIPs.delete(ip);
    }
  }

  // 3. Clean up rate limiter memory caches
  connLimiter.prune();
  createRoomLimiter.prune();
  joinRoomLimiter.prune();
  signalLimiter.prune();
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling server running on http://localhost:${PORT}`));
