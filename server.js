const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { randomInt } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Simple in-memory maps for rooms and rate-limiting
const otcToRoom = new Map();
const otcAttempts = new Map();

function genOTC() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

io.on('connection', (socket) => {
  socket.on('create_room', (cb) => {
    const otc = genOTC();
    otcToRoom.set(otc, { createdAt: Date.now() });
    socket.join(otc);
    socket.roomOTC = otc;
    if (cb) cb({ otc });
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
