const { verifyVendorJWT } = require('./lib/auth');
const RateLimiter = require('../lib/RateLimiter');

const vendorJoinLimiter = new RateLimiter(60_000, 30); // 30 joins/min per IP

let ioInstance = null;

function attachG2PSockets(io, metrics, bannedIPs) {
  ioInstance = io;

  io.on('connection', (socket) => {
    const ip = socket.handshake.address || 'unknown';

    // ── join_vendor_room ──────────────────────────────────────────────────────
    socket.on('g2p:join_vendor_room', async ({ vendorId, authToken } = {}, cb) => {
      try {
        const vendor = await verifyVendorJWT(authToken);
        if (!vendor || vendor.id !== vendorId) {
          return cb?.({ error: 'unauthorized' });
        }

        if (vendorJoinLimiter.isRateLimited(ip)) {
          metrics.rateLimitHits++;
          return cb?.({ error: 'rate_limited' });
        }

        socket.join(`vendor:${vendorId}`);
        socket.vendorId = vendorId;
        cb?.({ ok: true });
      } catch (err) {
        console.error('[G2P Sockets] Join room error:', err.message);
        cb?.({ error: 'internal_error' });
      }
    });

  });
}

function emitToVendor(vendorId, eventName, payload) {
  if (ioInstance) {
    ioInstance.to(`vendor:${vendorId}`).emit(eventName, payload);
  }
}

module.exports = {
  attachG2PSockets,
  emitToVendor,
};
