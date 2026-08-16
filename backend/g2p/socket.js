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
        if (!vendor) {
          return cb?.({ error: 'unauthorized' });
        }
        const finalVendorId = vendor.id || vendorId;
        if (!finalVendorId || (vendorId && vendor.id !== vendorId)) {
          return cb?.({ error: 'unauthorized' });
        }

        if (vendorJoinLimiter.isRateLimited(ip)) {
          metrics.rateLimitHits++;
          return cb?.({ error: 'rate_limited' });
        }

        socket.join(`vendor:${finalVendorId}`);
        socket.vendorId = finalVendorId;
        cb?.({ ok: true });
      } catch (err) {
        console.error('[G2P Sockets] Join room error:', err.message);
        cb?.({ error: 'internal_error' });
      }
    });

    // ── join_job_room ─────────────────────────────────────────────────────────
    // Allows a student to join a specific job's room to receive payment updates
    socket.on('g2p:join_job_room', ({ jobId } = {}) => {
      if (jobId) {
        socket.join(`job:${jobId}`);
      }
    });

  });
}

function emitToVendor(vendorId, eventName, payload) {
  if (ioInstance) {
    ioInstance.to(`vendor:${vendorId}`).emit(eventName, payload);
  }
}

function emitToJob(jobId, eventName, payload) {
  if (ioInstance) {
    ioInstance.to(`job:${jobId}`).emit(eventName, payload);
  }
}

module.exports = {
  attachG2PSockets,
  emitToVendor,
  emitToJob,
};
