# G2P Direct Print — Implementation Plan

## 0. Goal Recap

Remove the "download → open → print" flow for vendors (stationery/print shops). Instead:

1. User sends file(s) via G2P with `copies` and `color_mode` chosen at send time.
2. Vendor sees a preview grid of all incoming files on the web dashboard.
3. Vendor selects file(s) + a printer from a dropdown (live list of printers physically connected to their PC).
4. Vendor clicks **Print** / **Print All** → files print silently with the correct copies/color settings, no OS print dialog, no manual download.

This requires a **local background "print agent"** on the vendor's PC that bridges your website (which cannot talk to local hardware) to the OS print spooler.

---

## 1. High-Level Architecture

```
┌─────────────┐        HTTPS/Upload        ┌──────────────────┐
│   Sender    │ ─────────────────────────▶ │                  │
│  (User)     │   file + copies + color     │   Backend API     │
└─────────────┘                             │   + File Storage  │
                                             │   (S3/Cloud/local)│
┌─────────────┐   Fetch job list, preview   │                  │
│   Vendor    │ ◀─────────────────────────▶ │   Print Job Queue │
│  Dashboard  │   Select printer + Print     │   (DB + Redis)    │
│  (Browser)  │                             └─────────┬─────────┘
└─────────────┘                                        │ WebSocket
                                                         │ (persistent,
                                                         │  outbound from agent)
                                             ┌───────────▼──────────┐
                                             │   Print Agent          │
                                             │ (Electron/Node service)│
                                             │  running on Vendor PC  │
                                             └───────────┬──────────┘
                                                         │ OS print command
                                                 ┌────────▼────────┐
                                                 │ Local Printer(s) │
                                                 └──────────────────┘
```

Three components to build/change:
- **Backend**: new DB tables, WebSocket gateway, REST endpoints, job dispatch logic.
- **Frontend (vendor dashboard)**: preview grid, printer dropdown, print/print-all actions, live job status.
- **Print Agent**: new standalone app (Electron or Node service) installed on vendor PCs. *(Not "frontend" in the web sense, but part of this plan since nothing works without it.)*

---

## 2. Database Schema Changes

### 2.1 `print_jobs` table (extend or create)

| Column | Type | Notes |
|---|---|---|
| id | UUID / PK | |
| sender_id | FK → users | who sent the file |
| vendor_id | FK → vendors | target stationery shop |
| file_url | string | storage URL (S3/GCS/local path) |
| file_name | string | original filename |
| copies | int | set by sender at upload time |
| color_mode | enum(`color`,`bw`) | set by sender at upload time |
| paper_size | enum(`A4`,`A3`,...) | optional, default A4 |
| status | enum(`pending`,`queued`,`printing`,`printed`,`failed`) | |
| printer_name | string, nullable | filled in when vendor selects printer at print time |
| error_message | string, nullable | if failed |
| created_at / updated_at | timestamp | |

> Since you're now letting the vendor pick the printer **at print time** (not a stored default), `printer_name` stays null until the vendor triggers the print action.

### 2.2 `vendor_printers` table (live/ephemeral cache — optional but recommended)

| Column | Type | Notes |
|---|---|---|
| id | UUID / PK | |
| vendor_id | FK → vendors | |
| os_printer_name | string | exact OS-level printer name, used in print command |
| is_online | boolean | derived from last agent heartbeat |
| last_seen_at | timestamp | updated every time agent reconnects/pings |

You can implement this as a real DB table, or as a Redis hash keyed by `vendor_id` since it's just live status, not permanent history. **Redis is recommended** — printer lists are transient and change often (agent restarts, USB unplug, etc.), so you don't want stale DB rows.

### 2.3 `agent_connections` (only if using plain WebSockets without Redis pub/sub)

Track which backend server instance holds the live socket for a given vendor, if you run multiple backend instances behind a load balancer (needed for horizontal scaling — see Section 6).

---

## 3. Backend Implementation

### 3.1 WebSocket Gateway (Agent ↔ Backend)

**Endpoint:** `wss://yourapi.com/agent-socket?vendorId=xxx&token=yyy`

Responsibilities:
- Authenticate the agent (use a long-lived vendor-scoped API token generated when they register their PC, not a user login token).
- On connect: mark vendor as `online`, request printer list.
- On `printer_list` message from agent: cache to Redis/DB (Section 2.2).
- On `job_status` message from agent: update `print_jobs.status` and `error_message`, notify frontend via a separate WebSocket/SSE channel or polling.
- On disconnect: mark vendor `offline`, keep last known printer list but flag as stale.
- Heartbeat/ping every 30s to detect dead connections (agents can silently drop on sleep/network change).

**Message types (Agent → Backend):**
```json
{ "type": "printer_list", "printers": ["HP-LaserJet-Reception", "Canon-Color-Back"] }
{ "type": "job_status", "jobId": "job_88", "status": "printed" }
{ "type": "job_status", "jobId": "job_88", "status": "failed", "error": "Printer offline" }
{ "type": "heartbeat" }
```

**Message types (Backend → Agent):**
```json
{ "type": "print_job", "jobId": "job_88", "fileUrl": "...", "copies": 3, "colorMode": "color", "printerName": "Canon-Color-Back" }
{ "type": "request_printer_list" }
```

**Tech choice:** plain `ws` library (Node) or `socket.io` if you want auto-reconnect/rooms handled for you. Socket.io is easier for MVP (built-in reconnection, room-per-vendor).

### 3.2 REST Endpoints (Frontend ↔ Backend)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/vendors/:vendorId/printers` | Return cached live printer list + online status |
| `GET` | `/api/vendors/:vendorId/jobs?status=pending` | Preview grid data — list of pending files with metadata |
| `GET` | `/api/jobs/:jobId/thumbnail` | First-page thumbnail for preview (pre-generated, see 3.4) |
| `POST` | `/api/print-batch` | Body: `{ jobIds: [...], printerName }` → triggers dispatch |
| `GET` | `/api/jobs/:jobId/status` (or WS/SSE) | Live status for progress UI |

**`POST /api/print-batch` logic:**
1. Validate all `jobIds` belong to the requesting vendor and are `status = pending`.
2. Validate `printerName` exists in that vendor's current live printer list (reject if printer is offline — fail fast with a clear error instead of silently queuing).
3. For each job: set `status = queued`, `printer_name = printerName`.
4. Push each job over the vendor's WebSocket to the agent (sequentially, or let the agent handle its own queue — see 3.3).
5. Return `202 Accepted` with job IDs; frontend polls/subscribes for status updates.

### 3.3 Job Dispatch & Queueing

Two options depending on scale:

**Simple (MVP, low volume):** Backend sends jobs down the WebSocket one-by-one as soon as vendor clicks print; agent processes its own local queue sequentially (printers can't parallelize well anyway).

**Robust (higher volume / reliability):** Use a real job queue (BullMQ + Redis, or similar) between backend and the WebSocket dispatch layer:
- `POST /print-batch` enqueues jobs into BullMQ instead of pushing directly.
- A worker process pulls jobs, checks if the target agent is currently connected, and pushes over the socket.
- If agent is offline mid-print, job stays `queued` with a retry/backoff instead of being lost — this matters because vendor PCs sleep, restart, lose wifi, etc.

**Recommendation:** Start simple, but write the dispatch code as a function `dispatchJob(job)` so swapping in BullMQ later doesn't touch the REST/WebSocket layers.

### 3.4 File Handling / Thumbnails

- On upload (existing G2P flow), generate a **first-page thumbnail** server-side (e.g. `pdf-lib` + `pdf-poppler`, or `pdftoppm` CLI, or a service like Cloudinary if you already use one) and store alongside the file. Don't generate thumbnails on-demand in the dashboard — too slow for a grid of 10+ files.
- Store thumbnail URL in `print_jobs.thumbnail_url`.

### 3.5 Security Notes

- Agent auth token: generate a unique long-lived token per vendor PC when they "install/register" the agent (shown once in the dashboard, like an API key). Never reuse the vendor's login session token in the agent — it should be revocable independently (e.g., vendor changes PCs).
- File URLs sent to the agent should be **signed, short-lived URLs** (S3 pre-signed URL, 5–10 min expiry) — not permanent public links, since the agent downloads directly.
- Rate-limit `/print-batch` per vendor to avoid abuse.

---

## 4. Print Agent (New Component)

This is the piece that isn't "frontend" or "backend" in the web sense — it's a small native app.

### 4.1 Tech Choice

| Option | Pros | Cons |
|---|---|---|
| **Electron app** | Tray icon UI, easy printer picker, easy for vendor to see connection status, easy auto-update | Heavier install size |
| **Plain Node.js service** (installed as Windows Service / launchd daemon) | Lightweight, invisible | No UI — harder for vendor to see status/reconnect |

**Recommendation:** Electron with a tray icon for MVP — vendors need to *see* "Connected ✅ / Disconnected ❌" and re-enter their token if needed; a headless service is harder to support.

### 4.2 Core Responsibilities

1. On first launch: prompt vendor to paste their agent token (from dashboard) → store locally (encrypted local config, e.g. `electron-store`).
2. Connect to `wss://yourapi.com/agent-socket` with token.
3. On connect: enumerate printers via OS spooler and send `printer_list`.
4. Re-send printer list every reconnect + every N minutes (printers can be added/removed).
5. Listen for `print_job` messages:
   - Download file from `fileUrl` to a local temp folder.
   - Execute OS print command with `copies`/`colorMode`/`printerName`.
   - Send `job_status` back (`printed` or `failed` + error).
   - Delete temp file after printing.
6. Auto-reconnect with backoff on disconnect.
7. Auto-launch on system startup (OS-level "run on login" setting).

### 4.3 Printer Enumeration + Print Execution (Node)

```js
const { getPrinters, print } = require('pdf-to-printer'); // Windows-focused
// For cross-platform (Mac/Linux via CUPS), wrap `lp`/`lpstat` commands instead.

async function listPrinters() {
  const printers = await getPrinters();
  return printers.map(p => p.name);
}

async function executePrintJob(job) {
  const filePath = await downloadFile(job.fileUrl, job.id);
  try {
    await print(filePath, {
      printer: job.printerName,
      copies: job.copies,
      monochrome: job.colorMode === 'bw'
    });
    return { status: 'printed' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  } finally {
    fs.unlink(filePath, () => {});
  }
}
```

### 4.4 Cross-Platform Consideration

- `pdf-to-printer` npm package works well on **Windows**. For **Mac/Linux**, you'll need CUPS commands directly (`lp -d PrinterName -n 3 -o ColorModel=Gray file.pdf`) via `child_process.exec`.
- Decide now: if most vendors are Windows-only, ship Windows first and add Mac/Linux CUPS support later behind the same `executePrintJob` interface.

### 4.5 Packaging & Distribution

- Use `electron-builder` to produce a Windows installer (`.exe`) and Mac (`.dmg`) if needed.
- Add auto-update (`electron-updater`) so bug fixes / new printer-driver support reach vendors without manual reinstall.
- Vendor onboarding flow: Dashboard → "Connect a Printer" → "Download Agent" → install → paste token → agent shows "Connected."

---

## 5. Frontend (Vendor Dashboard) Changes

### 5.1 New/Changed Screens

**A. Printer Connection Status (Settings page)**
- Show live list of printers from `GET /api/vendors/:id/printers`, with online/offline indicator (based on agent connection + last heartbeat).
- "Download Print Agent" button + setup instructions if no agent connected yet.

**B. Preview Grid (main G2P inbox screen — replaces "download list")**
- Grid/list of cards, one per pending job:
  - Thumbnail (first page)
  - File name
  - Copies badge (e.g. "×3")
  - Color badge ("Color" / "B&W")
  - Checkbox for selection
- Top bar: "Select All" checkbox, count of selected files.
- Printer dropdown (populated from live printer list; disable/hide offline printers).
- **Print Selected** button (enabled only when ≥1 file selected + printer chosen).
- **Print All** button (auto-selects everything pending).

**C. Job Status / Progress**
- After clicking print, show inline progress per file: `Pending → Queued → Printing → Printed ✅ / Failed ❌`.
- Poll `GET /api/jobs/:jobId/status` every 2–3s, or better, subscribe via a lightweight SSE/WebSocket channel from backend → frontend (separate from the agent socket) for real-time updates without polling overhead.
- Failed jobs: show error inline + a "Retry" button that re-calls `/print-batch` for just that job.

### 5.2 Suggested Component Breakdown (React)

```
<VendorDashboard>
  <PrinterStatusBar />         // shows connected printers + online/offline
  <FilePreviewGrid>
    <FileCard />               // thumbnail + copies/color badges + checkbox
  </FilePreviewGrid>
  <PrintActionBar>
    <PrinterDropdown />
    <PrintSelectedButton />
    <PrintAllButton />
  </PrintActionBar>
  <JobStatusToastList />       // live status per job as it prints
</VendorDashboard>
```

### 5.3 State/Data Flow

1. On mount: fetch `printers` and `jobs` (pending).
2. User selects files + printer → local component state.
3. On "Print" click: `POST /api/print-batch` with selected `jobIds` + `printerName`.
4. Subscribe to status updates (poll or WS) → update each `FileCard`'s status badge live.
5. On `printed`: remove from pending grid (or move to a "Recently Printed" tab).

### 5.4 Nice-to-Have (Post-MVP)

- Remember last-used printer in `localStorage` and pre-select it next session.
- Bulk re-print / re-queue failed jobs.
- Vendor can rename printers with friendly labels (Section-4 "labels" idea from earlier discussion) once the MVP dropdown approach is validated.

---

## 6. Scaling / Reliability Notes (read before building, not required for MVP)

- **Multiple backend instances:** If you run more than one backend server (behind a load balancer), a plain in-memory WebSocket map won't work — server A might hold the agent socket while server B receives the `/print-batch` request. Use **Redis pub/sub** (or Socket.io's Redis adapter) so any backend instance can dispatch a job to the correct agent regardless of which instance holds the socket.
- **Agent offline at print time:** Decide behavior — reject the print request immediately (simplest, matches Section 3.2 step 2) vs. queue and retry when agent reconnects (better UX, more complexity). Start with immediate rejection + clear error message.
- **Large files / slow networks:** Agent downloads before printing — for large batches, consider parallel download + sequential print (download job N+1 while job N is printing) to reduce total wait time.
- **Printer errors mid-job** (out of paper, jammed): OS print commands often return success once the job is *spooled*, not once it's *physically printed*. True print-completion confirmation is unreliable across OSes — for MVP, treat "spooled successfully" as `printed`, and rely on the vendor noticing physical issues (out of paper, etc.) rather than trying to get real hardware-level confirmation.

---

## 7. Suggested Build Order (Milestones)

1. **DB schema** — add `print_jobs` fields (copies, color_mode, printer_name, status) if not present.
2. **Agent MVP** — bare Node script: connect via WS, list printers, print a hardcoded test file. Test locally against your own wifi printer.
3. **Backend WebSocket gateway** — accept agent connections, store printer list in Redis, basic `print_job` dispatch.
4. **REST endpoints** — `/printers`, `/jobs`, `/print-batch`.
5. **Frontend preview grid + printer dropdown + Print All** — wire to real endpoints.
6. **Job status feedback loop** — agent → backend → frontend, end-to-end one file.
7. **Electron packaging** — turn the Node script into an installable app with tray icon + token setup screen.
8. **Batch printing + error handling** — multiple files, printer offline handling, retry UI.
9. **Polish** — thumbnails, last-used printer memory, online/offline indicators.

---

## 8. Open Decisions to Make Before Coding

- [ ] Windows-only agent for launch, or cross-platform (Mac/Linux) from day one?
- [ ] Electron (with UI) or headless Node service for the agent?
- [ ] Simple direct WebSocket dispatch, or full job queue (BullMQ + Redis) from the start?
- [ ] File storage: S3/GCS pre-signed URLs, or another provider?
- [ ] Do you need multi-backend-instance support (Redis pub/sub) now, or is a single server fine for current scale?
