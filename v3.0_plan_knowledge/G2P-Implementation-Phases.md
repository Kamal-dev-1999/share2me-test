# Share2Me G2P — Implementation Phases

This document outlines the step-by-step execution plan to build the G2P (Group-to-Person) module. 

**Architectural Directive:** To maintain a production-grade, microservice-like architecture within the repository, **the existing `backend/server.js` will remain untouched** (handling only P2P). G2P will be built as a fully isolated, decoupled module under `backend/g2p/`. It will have its own Express routers, its own Socket.io namespace configuration, and its own dedicated background workers. 

---

## Phase 0: Infrastructure & Database Initialization

**Goal:** Set up the external dependencies and schema so the code has something to talk to.

1. **Storage (Cloudflare R2):**
   - Create the R2 bucket.
   - Configure a 2-hour lifecycle deletion rule (as a backstop for the cleanup worker).
   - Generate R2 API credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).

2. **Database (Supabase / PostgreSQL):**
   - Provision a Supabase PostgreSQL instance.
   - Run the initial schema migration (Enums, `vendors`, `requests`, `files` tables).
   - Obtain the `DATABASE_URL`.

3. **Environment & Deployment Config:**
   - Update the AWS Systems Manager (SSM) Parameter Store with the new secrets.
   - Update the ECS task definition to inject these new environment variables into the backend container.

---

## Phase 1: Core Foundation & Lib Wrappers

**Goal:** Build the isolated utility layer for G2P without touching the existing P2P codebase.

1. **Dependency Installation:**
   - Install `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (for R2).
   - Install `prisma` and `@prisma/client` (or `pg`) for database access.
   - Install `jose` (for backend JWT verification) and `file-type` (for magic-byte validation).
   - Initialize Prisma (if used) and generate the client.

2. **Storage Wrapper (`backend/g2p/lib/storage.ts`):**
   - Implement the S3 client configured for Cloudflare R2.
   - Create functions: `generatePresignedPutUrl()`, `verifyObjectExistsAndSize()`, `deleteObjects()`.

3. **Database Wrapper (`backend/g2p/lib/db.ts`):**
   - Initialize and export the Prisma/PG client instance.

4. **Validation Utilities (`backend/g2p/lib/validate.ts`):**
   - Implement MIME type allow-lists and `file-type` buffer checkers.

---

## Phase 2: Vendor Identity, Auth & Decoupled Routing

**Goal:** Establish the vendor identity system and wire up the isolated G2P Express router.

1. **Frontend Authentication:**
   - Integrate Auth.js (NextAuth) in the Next.js frontend with Google OAuth provider.
   - Create the vendor registration/login flow.

2. **Backend Authentication (`backend/g2p/lib/auth.ts`):**
   - Implement JWT verification using `jose` to validate tokens issued by Auth.js using the shared `AUTH_JWT_SECRET`.

3. **Vendor REST API (`backend/g2p/routes/vendor.ts`):**
   - Implement `GET /g2p/vendor/profile` (fetch permanent `share2me_id` and QR code info).
   - Implement `POST /g2p/vendor/toggle` (turn "Accepting Requests" ON/OFF in the DB).

4. **Main G2P Entry Point (`backend/g2p/index.ts`):**
   - Create the main Express router for G2P (`g2pRouter = express.Router()`).
   - Mount the vendor routes.
   - *Integration:* In `server.js`, add exactly one line to mount the G2P router: `app.use('/g2p', require('./g2p/index').g2pRouter);`.

---

## Phase 3: Student Submission REST API

**Goal:** Build the robust, transactional upload flow for students.

1. **Request Creation (`backend/g2p/routes/requests.ts`):**
   - Implement `POST /g2p/requests`.
   - Add the `SELECT FOR UPDATE` transactional lock to enforce the 100 active requests/vendor cap.
   - Verify the vendor is accepting requests.
   - Insert the `requests` row and return the `request_id` and `status_token`.

2. **File Presigning (`backend/g2p/routes/files.ts`):**
   - Implement `POST /g2p/requests/:id/files/presign`.
   - Add transactional checks for the 1GB/vendor storage cap and 10 files/request cap.
   - Issue the R2 presigned PUT URL.

3. **Upload Confirmation (`backend/g2p/routes/files.ts`):**
   - Implement `POST /g2p/requests/:id/files/:fileId/complete`.
   - Perform the `HEAD` request to R2 to verify size and existence.
   - Update `file.status` to `received`.
   - Handle the retry flow (deleting stale `pending_upload` rows if the presigned URL expired).

---

## Phase 4: Storage Cleanup & Reconciliation Worker

**Goal:** Implement the automated garbage collection to prevent storage leaks.

1. **Deletion Logic (`backend/g2p/lib/delete.ts`):**
   - Implement the universal `deleteRequest(requestId, reason)` function (deletes R2 objects, hard-deletes DB rows, and broadcasts socket removal).

2. **Cleanup Worker (`backend/g2p/workers/cleanup.ts`):**
   - Create a `setInterval` worker running every 5 minutes.
   - Add the `cleanupRunning` concurrency guard flag.
   - **Task A (Hard TTL):** Find requests where `expires_at < NOW()` and call `deleteRequest`.
   - **Task B (Grace Timer):** Find files where `status = 'downloaded' AND downloaded_at < NOW() - INTERVAL '10 minutes'` and call `deleteRequest`.
   - **Task C (Reconciliation):** Find `pending_upload` files older than 10 minutes, check R2 via `HEAD`. If they exist, promote to `received`; if not, delete the row.

3. **Worker Initialization:**
   - Import and start the worker in `backend/g2p/index.ts` so it runs alongside the server.

---

## Phase 5: Decoupled Realtime Layer (Sockets)

**Goal:** Implement live dashboard updates for vendors using isolated socket events.

1. **Socket Initialization (`backend/g2p/socket/namespace.ts`):**
   - Export a function `attachG2PSockets(io)` that listens for `g2p:*` events on the default namespace (to inherit the existing connection middleware).
   - Alternatively, create a dedicated `io.of('/g2p')` namespace and explicitly re-apply the rate-limiting and ban middleware.

2. **Vendor Connection (`g2p:join_vendor_room`):**
   - Verify the Auth.js JWT via the `jose` wrapper.
   - Apply `vendorJoinLimiter`.
   - Join the `vendor:{vendorId}` room.

3. **Event Emitting Triggers:**
   - Hook up `io.to('vendor:X').emit('g2p:new_submission')` inside the `POST /complete` handler when all files are received.
   - Add similar hooks for status updates and deletions.

---

## Phase 6: Vendor Actions & Student Status Page

**Goal:** Connect the UI actions to the backend logic.

1. **Vendor Actions (`backend/g2p/routes/vendor-actions.ts`):**
   - Implement file download endpoint (generates a short-lived signed GET URL and sets `downloaded_at = NOW()` in the DB).
   - Implement status transition endpoints (e.g., mark "Printing", "Ready").
   - Implement manual deletion (calls `deleteRequest(id, 'manual')`).

2. **Student Status Polling (`backend/g2p/routes/requests.ts`):**
   - Implement `GET /g2p/status/:status_token`.
   - Apply `statusPollLimiter` keyed by `status_token` (not IP, to support NAT environments).
   - Return sanitized request and file statuses to the anonymous student.

---

## Phase 7: Observability & Production Readiness

**Goal:** Ensure the system is monitorable and secure before go-live.

1. **Health Checks (`backend/g2p/health.ts`):**
   - Implement `/g2p/health`.
   - Check DB connectivity.
   - Check R2 connectivity.
   - **JWT Self-Verification Check:** Sign and verify a test token to ensure `AUTH_JWT_SECRET` is correctly synced with Next.js.
   - Monitor the `last_run` timestamp of the cleanup worker.

2. **Metrics:**
   - Implement `/g2p/metrics` to expose active requests, storage bytes, and rate-limit hits.

3. **Final Testing:**
   - Test concurrent submissions to verify the `SELECT FOR UPDATE` lock.
   - Test tab-close mid-upload to verify the reconciliation worker.
   - Verify that rotating the JWT secret triggers a health check failure.
