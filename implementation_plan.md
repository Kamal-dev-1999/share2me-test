# Implementation Plan

## Goal Description
Fix real-time synchronization issues on the vendor dashboard, specifically:
1. Print Agent WebSocket updating the wrong database column (\status\ instead of \job_status\).
2. Stale data being fetched by \GET /jobs\ due to aggressive caching, causing jobs to revert state (e.g. going from printed back to pending).
3. New uploaded jobs not appearing instantly because of caching.

## Proposed Changes

### backend/g2p/socket.js
- [MODIFY] Fix the SQL query in \gent:job_status\ handler to update \job_status\ instead of \status\.

### backend/g2p/routes/printshop.js
- [MODIFY] Add \Cache-Control: no-store\ header to \GET /jobs\ and \GET /shop/:code\ to prevent any intermediate proxies or browser caching.

### frontend/src/lib/printShop.ts
- [MODIFY] Append a cache-busting timestamp (\?_t=...\) to all \piGet\ requests to absolutely guarantee fresh data on every \efresh()\.

## Verification Plan
- Simulate a print job and verify it doesn't revert to pending after clicking 'Mark Printed'.
- Ensure the Print Agent WebSocket can successfully mark a job as printed in the DB.