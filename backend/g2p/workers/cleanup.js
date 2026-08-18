const { query } = require('../lib/db');
const { deleteRequest } = require('../lib/delete');
const { verifyObjectExistsAndSize } = require('../lib/storage');

let cleanupRunning = false;

async function runG2PCleanup() {
  if (cleanupRunning) return;
  cleanupRunning = true;

  try {
    // Task A: Hard TTL (30 minutes)
    // We check created_at to forcefully expire anything older than 30 minutes
    const expiredRes = await query(`
      SELECT id FROM requests WHERE created_at < NOW() - INTERVAL '30 minutes'
    `);
    for (const row of expiredRes.rows) {
      await deleteRequest(row.id, 'expired');
    }

    // Task B: Grace Timer (Downloaded > 10 minutes ago)
    const downloadedRes = await query(`
      SELECT request_id FROM files 
      WHERE status = 'downloaded' AND downloaded_at < NOW() - INTERVAL '10 minutes'
      GROUP BY request_id
    `);
    for (const row of downloadedRes.rows) {
      await deleteRequest(row.request_id, 'downloaded');
    }

    // Task C: Reconciliation (Tab closed mid-upload)
    const pendingRes = await query(`
      SELECT id, r2_key, size_bytes FROM files 
      WHERE status = 'pending_upload' AND created_at < NOW() - INTERVAL '10 minutes'
    `);
    
    for (const row of pendingRes.rows) {
      const check = await verifyObjectExistsAndSize(row.r2_key);
      if (check.exists && check.size === parseInt(row.size_bytes, 10)) {
         // Upload succeeded but /complete never fired
         await query(`UPDATE files SET status = 'received' WHERE id = $1`, [row.id]);
         console.log(`[G2P Cleanup] Reconciled and received orphaned file ${row.id}`);
      } else {
         // Genuinely abandoned, delete row
         await query(`DELETE FROM files WHERE id = $1`, [row.id]);
         console.log(`[G2P Cleanup] Deleted abandoned file ${row.id}`);
      }
    }

    // Task D: Print Shop Data Retention Cleanup
    const printshopExpiredRes = await query(`
      SELECT j.id, j.r2_key 
      FROM printshop_jobs j
      JOIN printshop_settings s ON j.vendor_id = s.vendor_id
      WHERE j.created_at < NOW() - (COALESCE(s.retention_hours, 24) || ' hours')::interval
    `);

    if (printshopExpiredRes.rowCount > 0) {
      const { deleteObjects } = require('../lib/storage');
      
      const r2KeysToDelete = printshopExpiredRes.rows
        .map(r => r.r2_key)
        .filter(Boolean);
        
      if (r2KeysToDelete.length > 0) {
        await deleteObjects(r2KeysToDelete);
        console.log(`[PrintShop Cleanup] Deleted ${r2KeysToDelete.length} files from R2`);
      }

      const jobIdsToDelete = printshopExpiredRes.rows.map(r => r.id);
      
      // Soft delete: Scrub personal data and mark as deleted so revenue math persists
      await query(`
        UPDATE printshop_jobs
        SET deleted_at = NOW(),
            document_name = 'Deleted Document',
            sender_name = 'Anonymous',
            r2_key = NULL
        WHERE id = ANY($1::uuid[])
      `, [jobIdsToDelete]);
      
      console.log(`[PrintShop Cleanup] Soft deleted & scrubbed ${jobIdsToDelete.length} expired print jobs`);
    }

  } catch (err) {
    console.error('[G2P Cleanup] Error during cleanup tick:', err);
  } finally {
    cleanupRunning = false;
  }
}

function startCleanupWorker() {
  // Run every 2 minutes for production cleanup
  setInterval(runG2PCleanup, 2 * 60_000);
}

module.exports = {
  startCleanupWorker,
};
