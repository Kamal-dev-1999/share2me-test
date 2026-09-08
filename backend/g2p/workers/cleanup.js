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

    // Task D: Print Shop Data Retention Cleanup (2 Hours for Free, Up to 7 Days for Pro)
    const printshopExpiredRes = await query(`
      SELECT j.id, j.r2_key 
      FROM printshop_jobs j
      JOIN vendors v ON j.vendor_id = v.id
      LEFT JOIN printshop_settings s ON j.vendor_id = s.vendor_id
      WHERE j.deleted_at IS NULL
        AND j.created_at < NOW() - (
          CASE 
            WHEN v.plan_type = 'PRO' AND v.subscription_ends_at > NOW() 
            THEN (LEAST(GREATEST(COALESCE(s.retention_hours, 24), 2), 168) || ' hours')::interval
            ELSE (LEAST(COALESCE(s.retention_hours, 2), 2) || ' hours')::interval
          END
        )
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

    // Task E: Vendor Subscription Auto-Expiry (30-day lifecycle)
    const expiredVendorsRes = await query(`
      UPDATE vendors
      SET plan_type = 'FREE',
          subscription_tier = 'free',
          subscription_status = 'expired'
      WHERE plan_type = 'PRO'
        AND subscription_ends_at IS NOT NULL
        AND subscription_ends_at < NOW()
      RETURNING id, name, email
    `);

    if (expiredVendorsRes.rowCount > 0) {
      const expiredIds = expiredVendorsRes.rows.map(v => v.id);
      await query(`
        UPDATE printshop_settings
        SET retention_hours = 2, updated_at = NOW()
        WHERE vendor_id = ANY($1::uuid[]) AND retention_hours > 2
      `, [expiredIds]);
      console.log(`[Subscription Worker] Auto-downgraded ${expiredVendorsRes.rowCount} expired vendors to FREE`);
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
