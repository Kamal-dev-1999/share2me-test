const { verifyVendorJWT } = require('./lib/auth');
const { query } = require('./lib/db');
const RateLimiter = require('../lib/RateLimiter');

const vendorJoinLimiter = new RateLimiter(60_000, 30); // 30 joins/min per IP
const agentJoinLimiter = new RateLimiter(60_000, 10); // 10 connects/min per IP
const jobJoinLimiter = new RateLimiter(60_000, 30); // 30 job-room joins/min per IP

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_JOB_ROOMS_PER_SOCKET = 20;

let ioInstance = null;
const connectedAgents = new Map(); // vendorId -> { socketId, printers: [] }

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
    // Allows a student to join a specific job's room to receive payment updates.
    // The job ID is only handed out in the job-creation response, but it is not
    // a secret credential: bound the surface with format, existence, count and
    // rate checks so arbitrary room names cannot be joined or flooded.
    socket.on('g2p:join_job_room', async ({ jobId } = {}, cb) => {
      try {
        if (typeof jobId !== 'string' || !UUID_RE.test(jobId)) {
          return cb?.({ error: 'invalid_job' });
        }

        if (jobJoinLimiter.isRateLimited(ip)) {
          metrics.rateLimitHits++;
          return cb?.({ error: 'rate_limited' });
        }

        const joinedRooms = [...socket.rooms].filter((room) => room.startsWith('job:'));
        if (!joinedRooms.includes(`job:${jobId}`) && joinedRooms.length >= MAX_JOB_ROOMS_PER_SOCKET) {
          return cb?.({ error: 'too_many_rooms' });
        }

        const result = await query('SELECT 1 FROM printshop_jobs WHERE id = $1 LIMIT 1', [jobId]);
        if (result.rowCount === 0) {
          return cb?.({ error: 'not_found' });
        }

        socket.join(`job:${jobId}`);
        cb?.({ ok: true });
      } catch (err) {
        console.error('[G2P Sockets] join_job_room error:', err.message);
        cb?.({ error: 'internal_error' });
      }
    });

    // ── agent:authenticate ────────────────────────────────────────────────────
    socket.on('agent:authenticate', async ({ token }, cb) => {
      try {
        if (!token) return cb?.({ error: 'invalid_token' });
        
        if (agentJoinLimiter.isRateLimited(ip)) {
          metrics.rateLimitHits++;
          return cb?.({ error: 'rate_limited' });
        }

        const res = await query('SELECT id FROM vendors WHERE print_agent_token = $1', [token]);
        if (res.rows.length === 0) {
          return cb?.({ error: 'invalid_token' });
        }
        
        const vendorId = res.rows[0].id;
        socket.agentVendorId = vendorId;
        
        // Save connection
        connectedAgents.set(vendorId, { socketId: socket.id, printers: [] });
        emitToVendor(vendorId, 'printshop:agent_online', { online: true });
        
        console.log(`[Agent] Authenticated for vendor ${vendorId}`);
        cb?.({ ok: true, vendorId });
      } catch (err) {
        console.error('[Agent] Auth error:', err);
        cb?.({ error: 'internal_error' });
      }
    });

    // ── agent:printers ────────────────────────────────────────────────────────
    socket.on('agent:printers', ({ printers }) => {
      if (!socket.agentVendorId) return;
      const vendorId = socket.agentVendorId;
      
      const agentData = connectedAgents.get(vendorId);
      if (agentData && agentData.socketId === socket.id) {
        agentData.printers = Array.isArray(printers) ? printers : [];
        connectedAgents.set(vendorId, agentData);
        // notify frontend that printers changed
        emitToVendor(vendorId, 'printshop:printers_updated', { printers: agentData.printers });
      }
    });

    // ── agent:job_status ──────────────────────────────────────────────────────
    socket.on('agent:job_status', async ({ jobId, status, error }) => {
      if (!socket.agentVendorId) return;
      
      try {
        if (status === 'printed') {
          await query("UPDATE printshop_jobs SET job_status = 'printed', print_error = NULL WHERE id = $1 AND vendor_id = $2", [jobId, socket.agentVendorId]);
          emitToVendor(socket.agentVendorId, 'printshop:job_updated', { jobId, jobStatus: 'printed' });
          emitToJob(jobId, 'printshop:job_updated', { jobId, jobStatus: 'printed' });
        } else if (status === 'failed') {
          await query("UPDATE printshop_jobs SET job_status = 'failed', print_error = $1 WHERE id = $2 AND vendor_id = $3", [error, jobId, socket.agentVendorId]);
          emitToVendor(socket.agentVendorId, 'printshop:job_updated', { jobId, jobStatus: 'failed', printError: error });
          emitToJob(jobId, 'printshop:job_updated', { jobId, jobStatus: 'failed' });
        }
      } catch (err) {
        console.error('[Agent] Job status error:', err);
      }
    });

    // ── sender:editing state sync ─────────────────────────────────────────────
    socket.on('printshop:sender_editing_start', ({ jobIds, vendorId, senderName }) => {
      if (vendorId && Array.isArray(jobIds) && jobIds.length > 0) {
        socket.editingVendorId = vendorId;
        socket.editingJobIds = jobIds;
        emitToVendor(vendorId, 'printshop:sender_editing', {
          jobIds,
          isEditing: true,
          senderName: senderName || 'Sender'
        });
      }
    });

    socket.on('printshop:sender_editing_stop', ({ jobIds, vendorId } = {}) => {
      const targetVendorId = vendorId || socket.editingVendorId;
      const targetJobIds = jobIds || socket.editingJobIds;
      if (targetVendorId && targetJobIds) {
        emitToVendor(targetVendorId, 'printshop:sender_editing', {
          jobIds: targetJobIds,
          isEditing: false
        });
        socket.editingVendorId = null;
        socket.editingJobIds = null;
      }
    });

    socket.on('disconnect', () => {
      if (socket.editingVendorId && socket.editingJobIds) {
        emitToVendor(socket.editingVendorId, 'printshop:sender_editing', {
          jobIds: socket.editingJobIds,
          isEditing: false
        });
      }

      if (socket.agentVendorId) {
        const vendorId = socket.agentVendorId;
        const agentData = connectedAgents.get(vendorId);
        if (agentData && agentData.socketId === socket.id) {
          connectedAgents.delete(vendorId);
          emitToVendor(vendorId, 'printshop:printers_updated', { printers: [] });
          emitToVendor(vendorId, 'printshop:agent_online', { online: false });
          console.log(`[Agent] Disconnected for vendor ${vendorId}`);
        }
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

function getAgentPrinters(vendorId) {
  const agent = connectedAgents.get(vendorId);
  return agent ? agent.printers : [];
}

function dispatchJobToAgent(vendorId, payload) {
  const agent = connectedAgents.get(vendorId);
  if (agent && ioInstance) {
    ioInstance.to(agent.socketId).emit('agent:print_job', payload);
    return true;
  }
  return false;
}

function isAgentOnline(vendorId) {
  return connectedAgents.has(vendorId);
}

module.exports = {
  attachG2PSockets,
  emitToVendor,
  emitToJob,
  getAgentPrinters,
  dispatchJobToAgent,
  isAgentOnline
};
