# ShareIt Knowledge Base

This document is the project handoff for coding agents. Read this first when resuming work on the ShareIt repository.

---

## 1. Project Summary

ShareIt is a browser-based, secure peer-to-peer file transfer app with two main flows:

1. **P2P Transfer**: Two transport modes:
   - `optical` — smaller transfers via QR streaming (not yet implemented end-to-end).
   - `webrtc` — larger transfers via WebRTC DataChannels (fully working).
2. **G2P (Get 2 Peer) / Vendor Dashboard**: A feature allowing vendors, print shops, or normal users to have a personalized Share Portal where others can upload files to them securely.

---

## 2. Current Phase: Frontend Rewrite Complete → Refine & Add Missing Features

The Next.js (React) + TypeScript + TailwindCSS rewrite is **complete and working end-to-end**.
The app correctly routes WebRTC signaling and UI through a single proxy port (3000), allowing cross-device testing via a single ngrok URL.

---

## 3. Repository Layout

```
ShareIt/
├── backend/                     # Express + Socket.io signaling server
│   ├── server.js                # Entry point — signal relay + Next.js proxy
│   ├── package.json             # { "name": "shareit-backend" }
│   └── public/                  # Plain-HTML POC (accessible at /poc)
│       ├── index.html           # Unified sender + receiver on one page
│       ├── app.js               # POC browser logic
│       ├── worker.js            # AES-GCM + ECDH Web Worker
│       └── storage.js           # OPFS / IndexedDB persistence
│
├── frontend/                    # Next.js 14 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root layout + SEO metadata
│   │   │   ├── page.tsx         # Main page — composes all sections
│   │   │   └── globals.css      # Inter + JetBrains Mono, dark defaults
│   │   ├── components/
│   │   │   ├── TopNav.tsx       # 64px dark navigation bar
│   │   │   ├── HeroSection.tsx  # Display headline + stat callouts
│   │   │   ├── ModeSelector.tsx # Send ↔ Receive pill toggle
│   │   │   ├── SendFlow.tsx     # Drag-drop, OTC badge, QR, progress
│   │   │   └── ReceiveFlow.tsx  # OTC input, key status, receive progress
│   │   └── hooks/
│   │       ├── useSocket.ts     # Singleton socket.io-client hook
│   │       └── useTransfer.ts   # Full sender + receiver state machine
│   ├── public/
│   │   ├── worker.js            # Crypto worker (served to browser)
│   │   └── storage.js           # Chunk storage (served to browser)
│   ├── tailwind.config.ts       # Full Binance design token palette
│   └── .env.local               # NEXT_PUBLIC_SIGNAL_URL
│
├── knowledge/                   # Project docs + design specs
│   ├── knowledge-base.md        # THIS FILE
│   ├── trd.md                   # Technical Requirements
│   ├── prd.md                   # Product Requirements
│   ├── cbd.md                   # Component Breakdown
│   ├── flow.md                  # Data flow diagrams
│   └── DESIGN.md                # Binance design system reference
│
├── package.json                 # Root — orchestration scripts only
└── README.md
```

---

## 4. What Was Built (Latest Version)

### Core Features
- **Frontend Architecture**: Next.js 14 (App Router) + TypeScript + TailwindCSS.
- **Design System**: Fully implemented Binance-inspired dark-mode (`canvas-dark`, `primary` yellow, `trading-up` green).
- **Unified App**: Sender and receiver flows are cleanly separated into React components (`SendFlow` and `ReceiveFlow`) but run on the same page.
- **State Management**: `useTransfer.ts` encapsulates the complex WebRTC, Socket.io, and Web Worker logic from the POC into React hooks.
- **Signaling & Proxy**: The backend Express server on port 3000 relays socket events AND uses `http-proxy-middleware` to forward all other HTTP requests to the Next.js dev server on port 3001. This allows **a single ngrok URL** to handle both the app UI and WebSockets.

### G2P (Get 2 Peer) Vendor Dashboard
- **Bento Box UI**: The dashboard (`G2pDashboard.tsx`) has been completely overhauled from a standard table to a modern, responsive grid-based "Bento Box" layout with glass-morphism effects (`backdrop-blur`, `bg-white/20`, dynamic SVG gradients for file-type icons).
- **Responsive Layout**: Mobile uses a compact pill-shaped bottom/top navigation, while desktop features a glass sidebar with high-level metrics.
- **Real-Time Sync**: Driven by `socket.io-client`, file uploads and download statuses sync in real-time (`g2p:new_submission`, `g2p:file_downloaded`).
- **Monetization & Extensions**: Includes Stripe checkout for "Pro Plan" upgrades, debounced custom QR code logo saving, and a specialized "Print Shop" panel (`PrintShopPanel.tsx`) integration.

### Crypto & Security (End-to-End)
- **ECDH-based key exchange**: Raw AES key is **never** in metadata or QR output.
  - Sender: generates ephemeral ECDH P-256 keypair + AES-GCM-256 file key.
  - Metadata carries `senderPubKey` (JWK) but not the key itself.
  - Receiver: generates its own ECDH keypair, sends `receiver_pub` over Socket.io.
  - Sender wraps AES key → sends `wrapped_key` → receiver unwraps.
- AES-GCM-256 chunk encryption runs in a Web Worker (`public/worker.js`).
- WebRTC DataChannel file transfer with NACK/resend for missing chunks.
- OPFS chunk persistence with IndexedDB fallback (`public/storage.js`).

### Fixed Architectural Quirks (from POC migration)
- **Same-socket local dispatch**: When testing locally (same browser tab), `socket.to(id)` excludes the sender. All socket event handlers in `useTransfer.ts` include direct local dispatch to bypass this limitation.
- **Storage timing race**: `state.sender.chunks[]` in-memory cache bypasses async storage reads to feed WebRTC instantly.
- **Assembly trigger**: Latched `doneReceived` boolean prevents NACK timers from cancelling the final file assembly.

---

## 5. Current Data Flow (Next.js Version)

### Sender
1. User picks file → clicks "Create OTC & Prepare".
2. `createRoom()` calls backend `create_room` → server returns 6-digit OTC.
3. Web Worker generates AES-GCM key + ECDH keypair, hashes file, encrypts chunks, emits `senderMetadata`.
4. Metadata JSON (with `senderPubKey`, **no raw AES key**) shown + QR rendered via `qrcode` lib.
5. On `receiver_pub` (via Socket or local dispatch): worker wraps AES key via ECDH-derived wrap key → emits `wrapped_key`.
6. User clicks "Start WebRTC Send" → WebRTC offer created → sent to receiver.
7. On DC open + `chunksReady`: chunks stream.

### Receiver
1. User enters OTC → "Join Room" → `join_room` via `useSocket`.
2. Pastes sender metadata JSON → "Import Metadata & Start Key Exchange".
3. Web Worker generates ECDH keypair → `receiverPubKey` → `receiver_pub` emitted to Sender.
4. On `wrapped_key`: worker unwraps AES key → `fileKeyReady`.
5. WebRTC offer arrives → answer created → sent back to sender.
6. DataChannel opens → chunks arrive → decrypted in Worker → saved to OPFS.
7. On sender `{done:true}`, wait 300ms for final decrypts, then assemble OPFS chunks into a Blob and trigger native browser download.

---

## 6. Socket.io Events (backend/server.js)

| Event | Direction | Purpose |
|---|---|---|
| `create_room` | Client → Server | Get 6-digit OTC, join room |
| `join_room` | Client → Server | Join existing room by OTC |
| `signal` | Bidirectional relay | WebRTC offer / answer / ICE |
| `receiver_pub` | Relay | Receiver ECDH public key → Sender |
| `wrapped_key` | Relay | Sender-wrapped AES key → Receiver |
| `nack` | Relay | Receiver requests missing chunk sequences |
| `ack` | Relay | (Routed but unused) |

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

---

## 8. What the Next Agent Should Build

### Missing Features / Roadmap:
- **Optical QR streaming mode**: Sub-5MB files, 512–1024 byte chunks, QR display loop, and Reed-Solomon FEC for dropped frames. Currently, optical transport is mocked/unimplemented.
- **Camera-based QR Scanner**: Implement a web-based camera scanner (e.g. `html5-qrcode`) in the `ReceiveFlow` to replace manual JSON pasting.
- **OPFS Resume**: Partial transfer recovery if the browser reloads mid-transfer.
- **Docker + Production Build**: Containerize the app for deployment (removing dev server proxy logic).
- **Automated Tests**: Playwright/Cypress end-to-end tests for cross-browser transfer validation.

---

## 9. Local Run (Dev Environment)

```bash
# Install all dependencies (orchestrated from root)
npm run install:all

# Run both Next.js and Backend Express Proxy concurrently
npm run dev

# App is accessible at:
# http://localhost:3000
```

### Cross-Device Testing with ngrok
Because port 3000 proxies UI to Next.js AND handles Socket.io:
1. `ngrok http 3000`
2. Copy the `https://xxxx.ngrok-free.app` URL.
3. Edit `frontend/.env.local`: `NEXT_PUBLIC_SIGNAL_URL=https://xxxx.ngrok-free.app`
4. Restart the dev servers (`npm run dev`).
5. Open the ngrok URL on both devices.

---

## 10. Debugging Notes
- If key exchange stalls, check browser console for `wrapError` or `decryptError` from the worker.
- If receiver shows "Decrypted chunk N/N" but no download, check `rcv.current.doneReceived` in `useTransfer.ts` — should be `true` after the `{done:true}` DataChannel message arrives.
- Ensure the `NEXT_PUBLIC_SIGNAL_URL` is correctly configured in `frontend/.env.local` if testing across physical devices; otherwise Socket.io will attempt to connect to `localhost`.
