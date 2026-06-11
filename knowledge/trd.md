# Technical Requirements Document (TRD)

### 1. Technology Stack
* **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS. Binance-inspired dark-mode UI.
* **Backend / Signaling:** Node.js, Express, Socket.io. Also acts as an HTTP proxy via `http-proxy-middleware` forwarding port 3000 to the Next.js dev server (port 3001) for single-URL ngrok testing.
* **Data Processing:** WebRTC Data Channels (primary transfer), Web Workers (`worker.js` for off-main-thread AES-GCM encryption and ECDH key wrapping).
* **Storage (Client):** Origin Private File System (OPFS) with IndexedDB fallback (`storage.js`).
* **Infrastructure:** Root orchestration via `package.json`. Future deployment: Docker containers.

### 2. Architecture & Data Structures
**Dynamic Chunking Protocol:**
* **WebRTC P2P Size:** 64 kB packet chunks for stability and speed.
* **Optical QR Size:** Planned: 512 bytes to 1024 bytes chunks.
* **Structure:** JSON messages over DataChannel (e.g. `{ seq: number, total: number, data: base64, iv: base64 }`).

**Metadata Object (QR / JSON Exchange):**
```json
{
  "f": "video.mp4",
  "s": 1073741824, 
  "c": 65536,
  "h": "sha256-hash-of-file",
  "total": 16384,
  "otc": "123456",
  "senderPubKey": { "crv": "P-256", "kty": "EC", "x": "...", "y": "..." },
  "transport": "webrtc"
}
```
*Note: The raw AES key is **never** included in the metadata. It is wrapped using an ephemeral ECDH keypair and sent over Socket.io.*

### 3. Core Mechanisms
* **Key Exchange:** Sender generates ephemeral ECDH P-256 keypair + AES-GCM-256 file key. Receiver generates ECDH keypair, sends public key. Sender wraps AES key via `AES-KW` or direct encrypt, sends to Receiver. Receiver unwraps. 
* **Backpressure / Cache:** Sender caches chunks in-memory (`chunks[]`) to prevent OPFS async read bottlenecks during transfer.
* **Resumption:** Receiver issues `nack` requests over Socket.io for missing chunk sequences. Sender resends them over WebRTC.