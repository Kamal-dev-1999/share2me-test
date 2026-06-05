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
  res.json({ status: 'ok', service: 'shareit-signaling', ts: Date.now() });
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
      service: 'ShareIt Signaling Server',
      status: 'running',
      note: 'Connect your frontend by setting NEXT_PUBLIC_SIGNAL_URL to this server URL.',
    });
  });
}

// Simple in-memory maps for rooms and rate-limiting
const otcToRoom = new Map();
const otcAttempts = new Map();

function genOTC() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

io.on('connection', (socket) => {
  socket.on('create_room', (cb) => {
    const otc = genOTC();
    otcToRoom.set(otc, { createdAt: Date.now(), metadata: null });
    socket.join(otc);
    socket.roomOTC = otc;
    if (cb) cb({ otc });
  });

  // Sender emits this once encryption metadata is ready.
  // We store it and immediately relay to any receiver already in the room.
  socket.on('sender_ready', ({ otc, metadata }) => {
    const room = otcToRoom.get(otc);
    if (!room) return;
    room.metadata = metadata;
    // relay to receiver if they joined before sender was ready
    socket.to(otc).emit('metadata_relay', { metadata });
  });

  socket.on('join_room', ({ otc }, cb) => {
    // rate limit join attempts by socket id
    const key = socket.handshake.address || socket.id;
    const count = otcAttempts.get(key) || 0;
    if (count > 50) return cb && cb({ error: 'rate_limited' });
    otcAttempts.set(key, count + 1);

    if (!otcToRoom.has(otc)) return cb && cb({ error: 'not_found' });
    socket.join(otc);
    socket.roomOTC = otc;
    cb && cb({ ok: true });

    // If sender already emitted sender_ready, relay metadata immediately
    const room = otcToRoom.get(otc);
    if (room?.metadata) {
      socket.emit('metadata_relay', { metadata: room.metadata });
    }
  });

  socket.on('signal', (msg) => {
    // msg: { otc, type, data }
    if (!msg || !msg.otc) return;
    // broadcast to everyone in room except sender
    socket.to(msg.otc).emit('signal', msg);
  });

  socket.on('receiver_pub', (msg) => {
    if (!msg || !msg.otc) return;
    socket.to(msg.otc).emit('receiver_pub', msg);
  });

  socket.on('wrapped_key', (msg) => {
    if (!msg || !msg.otc) return;
    socket.to(msg.otc).emit('wrapped_key', msg);
  });

  socket.on('key_exchange', (msg) => {
    // msg: { otc, type, data, transferId }
    if (!msg || !msg.otc) return;
    socket.to(msg.otc).emit('key_exchange', msg);
  });

  socket.on('nack', (msg) => {
    // msg: { otc, missingSeqs, total, transferId }
    if (!msg || !msg.otc) return;
    socket.to(msg.otc).emit('nack', msg);
  });

  socket.on('ack', (msg) => {
    if (!msg || !msg.otc) return;
    socket.to(msg.otc).emit('ack', msg);
  });

  socket.on('disconnect', () => {
    // cleanup if this socket created a room
    const otc = socket.roomOTC;
    if (!otc) return;
    // If no other sockets in room, remove mapping
    const room = io.sockets.adapter.rooms.get(otc);
    if (!room || room.size === 0) {
      otcToRoom.delete(otc);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling server running on http://localhost:${PORT}`));
