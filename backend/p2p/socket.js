const { randomInt } = require('crypto');
const RateLimiter = require('../lib/RateLimiter');

// ─── P2P specific rate limiters ─────────────────────────────────────────────
const createRoomLimiter = new RateLimiter(60_000, 3);
const joinRoomLimiter   = new RateLimiter(60_000, 10);
const signalLimiter     = new RateLimiter(60_000, 1_000);

// ─── In-memory state ────────────────────────────────────────────────────────
const otcToRoom = new Map(); // otc → { createdAt, metadata, ownerSocketId, ip }

// ─── OTC generation (6-digit, collision-safe) ───────────────────────────────
function genUniqueOTC() {
  for (let i = 0; i < 10; i++) {
    const otc = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!otcToRoom.has(otc)) return otc;
  }
  throw new Error('OTC space exhausted');
}

// ─── Payload guard ──────────────────────────────────────────────────────────
function checkPayloadSize(msg) {
  if (!msg) return true;
  try { return (typeof msg === 'string' ? msg : JSON.stringify(msg)).length <= 2 * 1024 * 1024; }
  catch { return false; }
}

function attachP2PSockets(io, metrics, bannedIPs) {
  io.on('connection', (socket) => {
    const ip = socket.handshake.address || 'unknown';
    metrics.connectionsTotal++;
    metrics.connectionsActive++;

    const nackTracker = new Map(); // `${otc}:${seq}` → retryCount

    // ── create_room ───────────────────────────────────────────────────────────
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

    // ── sender_ready: store metadata + relay to any already-joined receiver ───
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

    // ── join_room: relay cached metadata to late-joining receiver ─────────────
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

    // ── generic relay ──────────────────────────────────────────────────────────
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

    // ── nack: with per-chunk flood protection ──────────────────────────────────
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

    // ── transfer_complete: notify peers + schedule room cleanup ───────────────
    socket.on('transfer_complete', (msg) => {
      handleRelay('transfer_complete', msg);
      if (!msg?.otc) return;
      io.to(msg.otc).emit('room_closing', { otc: msg.otc, reason: 'transfer_complete' });
      setTimeout(() => {
        const socketsInRoom = io.sockets.adapter.rooms.get(msg.otc);
        if (!socketsInRoom || socketsInRoom.size === 0) { otcToRoom.delete(msg.otc); metrics.roomsDestroyed++; }
      }, 60_000);
    });

    // ── disconnect ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      metrics.connectionsActive--;
      nackTracker.clear();
      const otc = socket.roomOTC;
      if (!otc) return;
      const room = io.sockets.adapter.rooms.get(otc);
      if (!room || room.size === 0) { otcToRoom.delete(otc); metrics.roomsDestroyed++; }
    });
  });

  // ─── GC Janitor (every 2 min) ───────────────────────────────────────────────
  setInterval(() => {
    const now = Date.now(); let pruned = 0;
    for (const [otc, room] of otcToRoom.entries()) {
      const hasSockets  = (io.sockets.adapter.rooms.get(otc)?.size ?? 0) > 0;
      const isExpired   = now - room.createdAt > 30 * 60_000;
      const isAbandoned = !hasSockets && now - room.createdAt > 90_000;
      if (isExpired || isAbandoned) { otcToRoom.delete(otc); metrics.roomsDestroyed++; pruned++; }
    }
    createRoomLimiter.prune(); joinRoomLimiter.prune(); signalLimiter.prune();
    if (pruned > 0) console.log(`[GC] Pruned ${pruned} P2P rooms. Active P2P: ${otcToRoom.size}, Conns: ${metrics.connectionsActive}`);
  }, 2 * 60_000);
}

module.exports = { attachP2PSockets, otcToRoom };
