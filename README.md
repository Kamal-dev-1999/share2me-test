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

**End-to-end encrypted file & text transfer powered by WebRTC and ECDH key exchange.**  
Your data travels directly between devices — it never touches a server.

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

## ✦ What is Share2Me?

Share2Me is a **browser-native, serverless transfer tool** for files and text. Pick a file or paste any text on one device, share a 6-digit code or scan a QR with the other device, and the data streams peer-to-peer with AES-GCM-256 encryption — no accounts, no uploads, no cloud storage.

```
Device A ──── WebRTC DataChannel ────► Device B
         (AES-GCM-256 encrypted)
              ↑
     ECDH key exchange over Socket.io
     (raw AES key never leaves the browser)
```

### Transfer modes

| Mode | Input | Sender output | Receiver output |
|---|---|---|---|
| **File** | Drag & drop or browse any file | OTC + QR | Browser download triggered automatically |
| **Text** | Paste or type any text (any length, any language) | OTC + QR | Scrollable text panel with Copy All button |

> Both modes use the **identical** AES-GCM-256 + ECDH + WebRTC pipeline with NACK retry — zero data loss, zero formatting change.

---

## ✦ Text Transfer

ShareIt can securely transfer any amount of text between devices — code snippets, notes, passwords, entire documents — without copy-pasting to a chat app or cloud service.

**How it works:**

1. Select the **Text** tab on the Sender workspace
2. Type or paste any text (the `Paste` button reads your clipboard directly)
3. Click **Create OTC & Encrypt Text** — the text is `TextEncoder` → UTF-8 bytes → AES-GCM-256 encrypted in chunks
4. Share the 6-digit OTC or let the receiver scan the QR code
5. After the WebRTC handshake, encrypted chunks stream P2P
6. The receiver decrypts chunks → `TextDecoder` → exact original string
7. The received text appears in a scrollable, resizable panel with a **Copy All** button

```
"Hello 世界 🌍\nany text…"
        ↓  TextEncoder (UTF-8)
   [bytes]  ──── same AES-GCM-256 + ECDH + WebRTC pipeline ────►  [bytes]
        ↓  TextDecoder (UTF-8)
"Hello 世界 🌍\nany text…"   ← bit-for-bit identical
```

**Guarantees:**
- ✅ Any length — chunked at 16 KB, no practical limit
- ✅ Any language — UTF-8 handles all Unicode (emoji, CJK, RTL, etc.)
- ✅ Formatting preserved — newlines, tabs, spaces, indentation intact
- ✅ NACK retry — missing chunks re-requested automatically
- ✅ No server sees the text — end-to-end encrypted like files

---

## ✦ Security Model

| Layer | Mechanism |
|---|---|
| **Encryption** | AES-GCM-256 — every chunk individually encrypted with a random IV |
| **Key Exchange** | ECDH P-256 ephemeral keypair — sender wraps AES key, receiver unwraps it |
| **Key Safety** | Raw AES key is **never** in QR metadata, never sent over the network |
| **Transport** | WebRTC DataChannel — direct P2P path, no server relay |
| **Signaling** | Socket.io used only for OTC room join + key exchange + WebRTC SDP relay |
| **Text Safety** | Text is UTF-8 encoded to bytes before encryption; raw text never leaves the browser unencrypted |

> The signaling server sees encrypted blobs and public keys only. It cannot decrypt your file or text.

---

## ✦ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Sender)                  │
│  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ Next.js  │  │         worker.js                │  │
│  │  React   │─▶│  AES-GCM-256 · ECDH P-256 wrap  │  │
│  │  UI      │  │  TextEncoder (text mode)         │  │
│  └────┬─────┘  └──────────────────────────────────┘  │
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
│  ┌────┴─────┐  ┌──────────────────────────────────┐  │
│  │ Next.js  │  │         worker.js                │  │
│  │  React   │─▶│  AES-GCM-256 decrypt             │  │
│  │  UI      │  │  TextDecoder → string (text mode)│  │
│  └──────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| **UI Icons** | Lucide React |
| **Crypto** | Web Crypto API (AES-GCM-256, ECDH P-256) — runs in a Web Worker |
| **Transport** | WebRTC DataChannel with bufferedAmount backpressure |
| **Signaling** | Node.js · Express · Socket.io |
| **QR** | `qrcode` npm package · `jsQR` for universal camera scanning |
| **Text encoding** | `TextEncoder` / `TextDecoder` (built-in Web API) |
| **Design** | Binance-inspired dark theme — canvas `#0b0e11`, accent `#fcd535` |

---

## ✦ Repository Layout

```
ShareIt/
├── backend/                     # Express + Socket.io signaling server
│   ├── server.js                #   Entry point — signal relay + Next.js proxy
│   └── package.json
│
├── frontend/                    # Next.js 14 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       #   Root layout + SEO metadata
│   │   │   ├── page.tsx         #   Main page — transfer workspace
│   │   │   ├── send/            #   /send → redirects to home (send tab)
│   │   │   └── how-it-works/   #   /how-it-works — visual explainer page
│   │   ├── components/
│   │   │   ├── TopNav.tsx       #   Sticky nav — Send/Receive scroll, How it Works link
│   │   │   ├── HeroSection.tsx  #   Headline + stat callouts + trust badges
│   │   │   ├── ModeSelector.tsx #   Send ↔ Receive pill toggle
│   │   │   ├── SendFlow.tsx     #   File tab (drag-drop) + Text tab (textarea) + QR
│   │   │   └── ReceiveFlow.tsx  #   OTC input, QR scanner, file/text result panel
│   │   └── hooks/
│   │       ├── useSocket.ts     #   Singleton socket.io-client hook
│   │       └── useTransfer.ts   #   Full sender + receiver state machine
│   ├── public/
│   │   ├── worker.js            #   Crypto worker (AES-GCM + ECDH)
│   │   └── storage.js           #   Chunk storage helper
│   ├── tailwind.config.ts       #   Full design token palette + xs breakpoint
│   └── .env.local               #   NEXT_PUBLIC_SIGNAL_URL
│
└── README.md
```

---

## ✦ Quick Start — Local

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Install all dependencies

```bash
npm run install:all
```

Or manually:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start both servers

**Option A — Two terminals (recommended):**

```bash
# Terminal 1 — Next.js frontend (port 3001)
cd frontend && npm run dev -- --port 3001

# Terminal 2 — Signaling server + proxy (port 3000)
cd backend && npm start
```

**Option B — One command (Windows, opens two CMD windows):**
```bash
npm run dev
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
| Device 1 | Open ngrok URL → **Send** mode (File or Text tab) |
| Device 2 | Open ngrok URL → **Receive** mode |

> **First visit:** ngrok shows a warning page — click **"Visit Site"** to proceed.

---

## ✦ Transfer Flow

### File transfer
```
Sender                          Signaling Server            Receiver
  │                                    │                        │
  │── create_room ────────────────────▶│                        │
  │◀─ { otc: "319536" } ──────────────│                        │
  │                                    │                        │
  │  [file → AES-GCM-256 chunks]       │                        │
  │  [ECDH keypair generated]          │◀─── join_room ─────────│
  │                                    │◀─── receiver_pub ──────│
  │◀─ receiver_pub ───────────────────│                        │
  │                                    │                        │
  │  [wraps AES key via ECDH]          │                        │
  │── wrapped_key ────────────────────▶│──── wrapped_key ──────▶│
  │                                    │                        │  [unwraps AES key]
  │◀══════════════ WebRTC offer/answer/ICE ════════════════════▶│
  │                                    │                        │
  │══════════════ DataChannel (AES-GCM encrypted chunks) ══════▶│
  │── { done: true } ════════════════▶│                   [decrypts + assembles]
  │                                    │                   [download triggered]
```

### Text transfer
```
Sender                          Signaling Server            Receiver
  │                                    │                        │
  │  [TextEncoder → UTF-8 bytes]       │                        │
  │  [same AES-GCM-256 + ECDH pipeline as file transfer]        │
  │                                    │                        │
  │══════════════ DataChannel (encrypted text chunks) ══════════▶│
  │                                    │                   [decrypts + reassembles]
  │                                    │                   [TextDecoder → string]
  │                                    │                   [shown in UI with Copy All]
```

---

## ✦ Pages

| Route | Description |
|---|---|
| `/` | Main page — hero + transfer workspace (Send/Receive + File/Text) |
| `/how-it-works` | Visual explainer — architecture diagram, 6-step flow, crypto spec, FAQ |
| `/send` | Redirects to `/?mode=send#transfer` |

---

## ✦ What's Implemented

| Feature | Status |
|---|---|
| File transfer (any size) | ✅ Done |
| Text transfer (any length, any language) | ✅ Done |
| AES-GCM-256 encryption per chunk | ✅ Done |
| ECDH P-256 key exchange | ✅ Done |
| WebRTC DataChannel with backpressure | ✅ Done |
| NACK chunk retry | ✅ Done |
| Universal QR scanner (jsQR — all browsers) | ✅ Done |
| QR code generation for metadata | ✅ Done |
| Mobile-responsive UI | ✅ Done |
| How it Works page with visual diagram | ✅ Done |
| Reed-Solomon FEC | 🔜 Planned |
| OPFS partial resume after reload | 🔜 Planned |
| Docker + production build | 🔜 Planned |

---

## ✦ License

MIT © 2026 ShareIt

---

<div align="center">
<sub>Built with WebRTC · AES-GCM-256 · ECDH P-256 · TextEncoder/Decoder · No cloud. No compromise.</sub>
</div>