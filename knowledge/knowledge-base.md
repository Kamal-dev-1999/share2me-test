# ShareIt Knowledge Base

This document is the project handoff for coding agents. Read this first when resuming work on the ShareIt repository.

---

## 1. Project Summary

ShareIt is a browser-based, secure peer-to-peer file transfer app with two transport modes:

- `optical` — smaller transfers via QR streaming (not yet implemented end-to-end).
- `webrtc` — larger transfers via WebRTC DataChannels (fully working POC).

---

## 2. Current Phase: POC Complete → Frontend Rewrite Next

The plain-HTML POC is **complete and working end-to-end**. The next engineering task is:

> **Rewrite the frontend as a Next.js (React) + TypeScript + TailwindCSS app per the TRD.**

The signaling server (`server.js`) and crypto worker (`public/worker.js`) stay as-is.

---

## 3. Repository Layout

```
ShareIt/
├── server.js               # Express + Socket.io signaling server (keep as-is)
├── package.json
├── public/                 # Current plain-HTML POC (to be replaced by Next.js)
│   ├── index.html          # Unified app shell (sender + receiver on one page)
│   ├── app.js              # All browser logic for both roles
│   ├── worker.js           # Web Worker: AES-GCM encrypt/decrypt + ECDH wrap/unwrap
│   ├── storage.js          # OPFS / IndexedDB chunk persistence
│   ├── sender.html         # Redirect stub -> /index.html#sender
│   └── receiver.html       # Redirect stub -> /index.html#receiver
└── knowledge/
    ├── knowledge-base.md   # THIS FILE
    ├── trd.md              # Technical Requirements Document (stack, architecture)
    ├── prd.md              # Product Requirements Document
    ├── cbd.md              # Component Breakdown Document
    └── flow.md             # Data flow diagrams
```

---

## 4. What Was Built in the POC (commit 5e89d22)

### Completed features

- Unified single-page app: sender and receiver panels on one page, one Socket.io connection.
- ECDH-based key exchange: raw AES key is **never** in metadata or QR output.
  - Sender: generates ephemeral ECDH P-256 keypair + AES-GCM-256 file key.
  - Metadata carries `senderPubKey` (JWK) but not the key itself.
  - Receiver: generates its own ECDH keypair, sends `receiver_pub` over Socket.io.
  - Sender wraps AES key → sends `wrapped_key` → receiver unwraps.
- AES-GCM-256 chunk encryption in a Web Worker (off main thread).
- WebRTC DataChannel file transfer with NACK/resend for missing chunks.
- OPFS chunk persistence with IndexedDB fallback.
- Working end-to-end transfer: select file → create OTC → join → import metadata → send → download.

### Bugs fixed during this session (all in `public/app.js`)

| # | Root cause | Fix |
|---|---|---|
| 1 | Same-socket local dispatch: sender + receiver share one `socket.id`; `socket.to()` excludes them from their own events | Extracted named handlers (`handleSignal`, `handleReceiverPub`, `handleWrappedKey`); called directly after each `socket.emit()` |
| 2 | Storage timing race: `saveChunk()` async/unawaited; `done` fired before saves settled | Added `state.sender.chunks[]` in-memory cache; filled synchronously as worker messages arrive |
| 3 | Assembly never triggered: `scheduleReceiverNackCheck(finalCheck=true)` timer reset by later `decrypted` event with `finalCheck=false` | Latched `state.receiver.doneReceived = true` on state; assembly checks the flag, not the timer-scoped param |
| 4 | DC opened before chunks ready | `dc.onopen` checks `state.sender.chunksReady`; `done` handler triggers send if DC already open |
| 5 | Downloaded file always named `received.bin` | Assembly uses `state.receiver.metadata.f` |
| 6 | Dead `setReceiverOtc()` call | Removed |
| 7 | Premature key wrap | `processPendingReceiverPubKey` now guards on `state.sender.metadata` |

---

## 5. Current Data Flow (working POC)

### Sender
1. User picks file → clicks "Create OTC & Prepare".
2. `create_room` → server returns 6-digit OTC.
3. Worker: generates AES-GCM key + ECDH keypair, hashes file, encrypts chunks, emits `senderMetadata`.
4. Chunks pushed to `state.sender.chunks[]` (in-memory) + saved to OPFS/IDB.
5. Metadata JSON (with `senderPubKey`, **no raw AES key**) shown + QR rendered.
6. On `receiver_pub`: worker wraps AES key via ECDH-derived wrap key → emits `wrapped_key` (Socket.io) + local dispatch.
7. User clicks "Start WebRTC Send" → offer created → `handleSignal(offer)` dispatched locally.
8. On DC open + `chunksReady`: sends all chunks from memory, then `{done:true}`.

### Receiver
1. User enters OTC → "Join Room" → `join_room`.
2. Pastes sender metadata JSON → "Import Metadata & Start Key Exchange".
3. Worker: generates ECDH keypair → `receiverPubKey` → `receiver_pub` emitted (Socket.io) + local dispatch.
4. On `wrapped_key`: worker unwraps AES key → `fileKeyReady` → `state.receiver.keyReady = true`.
5. WebRTC offer arrives via local dispatch → answer created → local dispatch back to sender.
6. DataChannel opens → chunks arrive → buffered in `pendingEncrypted` → flushed through worker when key ready.
7. On sender `{done:true}`: `state.receiver.doneReceived = true` latched.
8. 300ms after last chunk decrypted: all present + `doneReceived` → `assembleReceiverDownload()` → file downloads with original filename.

---

## 6. Socket.io Events (server.js)

| Event | Direction | Purpose |
|---|---|---|
| `create_room` | Client → Server | Get 6-digit OTC, join room |
| `join_room` | Client → Server | Join existing room by OTC |
| `signal` | Bidirectional relay | WebRTC offer / answer / ICE |
| `receiver_pub` | Relay | Receiver ECDH public key → Sender |
| `wrapped_key` | Relay | Sender-wrapped AES key → Receiver |
| `nack` | Relay | Receiver requests missing chunk sequences |
| `ack` | Relay | (Routed but unused) |

> **Note:** On the unified single-page app, sender and receiver share one socket. The server's `socket.to(otc)` excludes the emitter, so intra-page messages are handled via direct in-process function calls (local dispatch in `app.js`). Cross-device operation goes through the server normally.

---

## 7. Metadata JSON Contract

```json
{
  "f": "filename.ext",
  "s": 1048576,
  "c": 1024,
  "h": "sha256-base64",
  "total": 1024,
  "otc": "123456",
  "senderPubKey": { "crv": "P-256", ... },
  "transport": "webrtc"
}
```

**`key` field is intentionally absent** — raw AES key is never in metadata.

---

## 8. What the Next Agent Should Build

### Goal: Next.js frontend rewrite

Tech stack (from `knowledge/trd.md`):
- **Next.js** (App Router or Pages — your choice, App Router preferred)
- **TypeScript**
- **TailwindCSS**
- Keep `server.js` (Express + Socket.io) unchanged
- Keep `public/worker.js` (crypto worker) unchanged — copy it to `public/` of the Next.js app

### Approach
1. `npx create-next-app@latest` in a new `frontend/` subdirectory (or project root if server is moved to `server/`).
2. Move `public/worker.js` and `public/storage.js` into Next.js `public/` folder.
3. Create a Socket.io client hook (`useSocket`) that wraps the same event names.
4. Create a `useSenderTransfer` hook and a `useReceiverTransfer` hook encapsulating the state machines from the current `app.js`.
5. Build the UI with TailwindCSS — dark mode, glassmorphism panels, sender left / receiver right (or tabs on mobile).
6. The local-dispatch pattern must be preserved: after `socket.emit('receiver_pub', ...)`, also call the sender handler directly if both roles are active in the same browser session.

### Not yet implemented (from `knowledge/prd.md` and `trd.md`)
- Optical QR streaming mode (sub-5 MB, 512–1024 byte chunks, QR display loop).
- Reed-Solomon FEC.
- OPFS resume bitmap / partial transfer recovery.
- Docker + Terraform / AWS infra.
- CI, automated browser tests.

---

## 9. Local Run (current POC)

```bash
npm install
npm start
# Open http://localhost:3000/index.html
```

---

## 10. Debugging Notes

- If key exchange stalls, check browser console for `wrapError` or `decryptError` from the worker.
- If chunks are sent but receiver shows "DataChannel open." only, check `state.sender.chunksReady` and `state.sender.chunks.length` in the console (they're inside the IIFE — add `window._state = state` temporarily to inspect).
- If receiver shows "Decrypted chunk N/N" but no download, check `state.receiver.doneReceived` — should be `true` after the `{done:true}` DataChannel message arrives.
- For cross-device use: both devices must hit the same server. The same OTC + metadata JSON must be shared out-of-band (QR scan or copy-paste).

---

## 11. Git Log

```
5e89d22  feat: unified app shell + ECDH key wrap + end-to-end transfer fix
```
