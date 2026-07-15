const { query } = require('./db');
const { deleteObjects } = require('./storage');

/**
 * Universal deletion function for G2P requests.
 * Deletes from R2, hard deletes from DB, and broadcasts socket removal.
 */
async function deleteRequest(requestId, reason) {
  try {
    // 1. Get all files for this request to delete from R2
    const filesRes = await query('SELECT r2_key FROM files WHERE request_id = $1', [requestId]);
    const r2Keys = filesRes.rows.map(row => row.r2_key);

    if (r2Keys.length > 0) {
      await deleteObjects(r2Keys);
    }

    // 2. We need the vendor ID for the socket broadcast before we delete the row
    const reqRes = await query('SELECT vendor_id FROM requests WHERE id = $1', [requestId]);
    const vendorId = reqRes.rows.length > 0 ? reqRes.rows[0].vendor_id : null;

    // 3. Hard delete from DB (CASCADE will delete files rows)
    await query('DELETE FROM requests WHERE id = $1', [requestId]);

    console.log(`[G2P Deletion] Request ${requestId} deleted. Reason: ${reason}`);

    // 4. Broadcast socket event to Vendor Room
    if (vendorId) {
      try {
        const { emitToVendor } = require('../socket');
        if (emitToVendor) {
           emitToVendor(vendorId, 'g2p:request_removed', { requestId, reason });
        }
      } catch (err) {
        // socket module might not be loaded yet or mocking during tests
      }
    }
  } catch (err) {
    console.error(`[G2P Deletion Error] Failed to delete request ${requestId}:`, err);
  }
}

module.exports = {
  deleteRequest,
};
