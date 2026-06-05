<div align="center">

<br />

```
 ____  _                    ___ _
/ ___|| |__   __ _ _ __ ___|_ _| |_
\___ \| '_ \ / _` | '__/ _ \| || __|
 ___) | | | | (_| | | |  __/| || |_
|____/|_| |_|\__,_|_|  \___|___|\__|
```

### Secure · Peer-to-Peer · Zero Cloud

**End-to-end encrypted file transfer powered by WebRTC and ECDH key exchange.**  
Your file travels directly between devices. It never touches a server.

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-DataChannel-333333?style=flat-square&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-fcd535?style=flat-square)](LICENSE)

<br />

</div>

---

## ✦ What is ShareIt?

ShareIt is a **browser-native, serverless file transfer tool**. Pick a file on one device, scan a QR or share a 6-digit code with the other device, and the file streams peer-to-peer with military-grade encryption — no accounts, no uploads, no cloud storage.

```
Device A ──── WebRTC DataChannel ────► Device B
         (AES-GCM-256 encrypted)
              ↑
     ECDH key exchange over Socket.io
     (raw AES key never leaves the browser)
```

---

## ✦ Security Model

| Layer | Mechanism |
|---|---|
| **Encryption** | AES-GCM-256 — every chunk individually encrypted with a random IV |
| **Key Exchange** | ECDH P-256 ephemeral keypair — sender wraps AES key, receiver unwraps it |
| **Key Safety** | Raw AES key is **never** in QR metadata, never sent over the network |
| **Transport** | WebRTC DataChannel — direct P2P path, no server relay |
| **Persistence** | Chunks stored in OPFS (Origin Private File System) or IndexedDB — local only |
| **Signaling** | Socket.io used only for OTC room join + key exchange + WebRTC SDP relay |

> The signaling server sees encrypted blobs and public keys only. It cannot decrypt your file.

---

## ✦ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Sender)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Next.js  │  │ worker.js│  │   storage.js     │  │
│  │  React   │─▶│ AES-GCM  │  │  OPFS / IDB      │  │
│  │  UI      │  │ ECDH wrap│  │  chunk cache     │  │
│  └────┬─────┘  └──────────┘  └──────────────────┘  │
│       │ Socket.io (OTC + key exchange)               │
└───────┼─────────────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────────────────┐
│       │         server.js (Express + Socket.io)      │
│       │  • Generates 6-digit OTC rooms               │
│       │  • Relays: receiver_pub / wrapped_key        │
│       │  • Relays: WebRTC offer / answer / ICE       │
│       │  • Proxies HTTP → Next.js dev server         │
└───────┼─────────────────────────────────────────────┘
        │ WebRTC DataChannel (P2P, encrypted chunks)
┌───────┼─────────────────────────────────────────────┐
│       │          Browser (Receiver)                  │
│  ┌────┴─────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Next.js  │  │ worker.js│  │   storage.js     │  │
│  │  React   │─▶│ AES-GCM  │  │  OPFS / IDB      │  │
│  │  UI      │  │ECDH unwrp│  │  chunk cache     │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| **UI Icons** | Lucide React |
| **Crypto** | Web Crypto API (AES-GCM-256, ECDH P-256) — runs in a Web Worker |
| **Transport** | WebRTC DataChannel |
| **Signaling** | Node.js · Express · Socket.io |
| **Storage** | OPFS → IndexedDB (automatic fallback) |
| **QR** | `qrcode` npm package |
| **Design** | Binance-inspired dark theme — canvas `#0b0e11`, accent `#fcd535` |

---

## ✦ Repository Layout

```
ShareIt/
├── server.js                    # Express + Socket.io signaling server
│                                  also proxies HTTP → Next.js (port 3001)
├── package.json                 # Server dependencies
├── public/                      # Plain-HTML POC (accessible at /poc)
│   ├── index.html               # Unified sender + receiver on one page
│   ├── app.js                   # POC browser logic
│   ├── worker.js                # AES-GCM + ECDH Web Worker
│   └── storage.js               # OPFS / IndexedDB persistence
├── frontend/                    # Next.js application
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
│   │   ├── worker.js            # Copied from POC — crypto worker
│   │   └── storage.js           # Copied from POC — chunk storage
│   ├── tailwind.config.ts       # Full Binance design token palette
│   └── .env.local               # NEXT_PUBLIC_SIGNAL_URL
└── knowledge/                   # Project handoff docs
    ├── knowledge-base.md        # ← Start here when resuming work
    ├── trd.md                   # Technical Requirements
    ├── prd.md                   # Product Requirements
    ├── cbd.md                   # Component Breakdown
    └── flow.md                  # Data flow diagrams
```

---

## ✦ Quick Start — Local

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
# Signaling server
npm install

# Next.js frontend
cd frontend && npm install && cd ..
```

### 2. Start both servers

```bash
# Terminal 1 — Next.js frontend (port 3001)
cd frontend
npm run dev -- --port 3001

# Terminal 2 — Signaling server + proxy (port 3000)
npm start
```

### 3. Open the app

```
http://localhost:3000
```

---

## ✦ Cross-Device Testing (ngrok)

To test across two real devices (phone + laptop, etc.):

### 1. Start both servers (same as above)

### 2. Expose port 3000 via ngrok

```bash
ngrok http 3000
# → https://xxxx-xx-xx.ngrok-free.app
```

### 3. Update the frontend env

```bash
# frontend/.env.local
NEXT_PUBLIC_SIGNAL_URL=https://xxxx-xx-xx.ngrok-free.app
```

### 4. Restart the Next.js dev server

```bash
cd frontend && npm run dev -- --port 3001
```

### 5. Both devices open the ngrok URL

| Device | Role |
|---|---|
| Device 1 | Open ngrok URL → **Send** mode |
| Device 2 | Open ngrok URL → **Receive** mode |

> **First visit:** ngrok shows a warning page — click **"Visit Site"** to proceed.

---

## ✦ Transfer Flow

```
Sender                          Signaling Server            Receiver
  │                                    │                        │
  │── create_room ────────────────────▶│                        │
  │◀─ { otc: "319536" } ──────────────│                        │
  │                                    │                        │
  │  [encrypts file in Web Worker]     │                        │
  │  [ECDH keypair generated]          │◀─── join_room ─────────│
  │                                    │◀─── receiver_pub ──────│
  │◀─ receiver_pub ───────────────────│                        │
  │                                    │                        │
  │  [wraps AES key via ECDH]          │                        │
  │── wrapped_key ────────────────────▶│                        │
  │                                    │──── wrapped_key ──────▶│
  │                                    │                        │  [unwraps AES key]
  │◀══════════════ WebRTC offer/answer/ICE ════════════════════▶│
  │                                    │                        │
  │══════════════ DataChannel (AES-GCM encrypted chunks) ══════▶│
  │                                    │                        │  [decrypts + saves]
  │── { done: true } ════════════════▶│                        │
  │                                    │                   [assembles file]
  │                                    │                   [download triggered]
```

---

## ✦ Not Yet Implemented

| Feature | Status |
|---|---|
| Optical QR streaming (sub-5MB) | 🔜 Next |
| Reed-Solomon FEC | 🔜 Planned |
| OPFS partial resume after reload | 🔜 Planned |
| Camera-based QR scanner | 🔜 Planned |
| Docker + production build | 🔜 Planned |
| Automated browser tests | 🔜 Planned |

---

## ✦ Git History

| Commit | Description |
|---|---|
| `35365e1` | feat: Next.js frontend + cross-device transfer via ngrok |
| `32582ef` | docs: update knowledge base — POC complete |
| `5e89d22` | feat: unified app shell + ECDH key wrap + end-to-end transfer fix |

---

## ✦ License

MIT © 2026 ShareIt

---

<div align="center">
<sub>Built with WebRTC · AES-GCM-256 · ECDH P-256 · No cloud. No compromise.</sub>
</div>
