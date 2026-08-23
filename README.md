<div align="center">

<br />

```text
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
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-DataChannel-333333?style=flat-square&logo=webrtc&logoColor=white)](https://webrtc.org/)

<br />

</div>

---

## ✦ What is Share2Me?

Share2Me is a **browser-native, serverless transfer tool** for files and text. Pick a file or paste any text on one device, share a 6-digit code or scan a QR with the other device, and the data streams peer-to-peer with AES-GCM-256 encryption — no accounts, no uploads, no cloud storage.

### Transfer modes

| Mode | Input | Sender output | Receiver output |
|---|---|---|---|
| **File** | Drag & drop or browse any file | OTC + QR | Browser download triggered automatically |
| **Text** | Paste or type any text | OTC + QR | Scrollable text panel with Copy All button |

> Both modes use the **identical** AES-GCM-256 + ECDH + WebRTC pipeline with NACK retry — zero data loss, zero formatting change.

---

## ✦ G2P Dashboard & Print Shops

Share2Me now features a robust **Get 2 Peer (G2P) Portal**, designed as a modern Bento-Box dashboard. This allows businesses, educators, and print shops to create permanent "Share Codes" to receive files seamlessly.

- 🛍️ **Print Shop Integrations**: Vendors can set their B&W and Color pricing, upload shop banners to Cloudflare R2, and receive print jobs in real time via Socket.io.
- 🗺️ **Nearby Map Discovery**: Users can discover local print shops dynamically through a highly responsive Leaflet map (`/g2p/nearby`) powered by PostGIS `ST_DWithin` queries and OpenStreetMap geocoding.
- 💳 **Stripe Checkout**: Monetization and Pro Plan up-sells are fully integrated.
- 🎨 **LoadLogic UI**: The entire dashboard utilizes a sleek, dark-accented glass-morphism aesthetic ensuring a professional, distraction-free environment.

---

## ✦ Security Model

| Layer | Mechanism |
|---|---|
| **Encryption** | AES-GCM-256 — every chunk individually encrypted with a random IV |
| **Key Exchange** | ECDH P-256 ephemeral keypair — sender wraps AES key, receiver unwraps it |
| **Key Safety** | Raw AES key is **never** in QR metadata, never sent over the network |
| **Transport** | WebRTC DataChannel — direct P2P path, no server relay |
| **Signaling** | Socket.io used only for OTC room join + key exchange + WebRTC SDP relay |

> The signaling server sees encrypted blobs and public keys only. It cannot decrypt your file or text.

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router) · React 18 · Tailwind CSS |
| **UI Icons** | Lucide React · Framer Motion |
| **Database** | PostgreSQL · PostGIS (Geospatial) · Prisma/Raw SQL |
| **Storage** | Cloudflare R2 (S3-compatible) |
| **Crypto** | Web Crypto API (AES-GCM-256, ECDH P-256) |
| **Transport** | WebRTC DataChannel with bufferedAmount backpressure |
| **Signaling** | Node.js · Express · Socket.io |

---

## ✦ Quick Start — Local

### Prerequisites
- Node.js 18+
- PostgreSQL database (with PostGIS enabled)
- Cloudflare R2 credentials (optional, for images)

### 1. Install all dependencies
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
cd backend && npm run dev
```

### 3. Open the app
```text
http://localhost:3000
```

---

<div align="center">
<sub>Built with WebRTC · AES-GCM-256 · ECDH P-256 · PostGIS · No cloud. No compromise.</sub>
</div>