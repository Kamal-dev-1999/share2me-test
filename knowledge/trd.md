# Technical Requirements Document (TRD)

### 1. Technology Stack
* **Frontend:** Next.js (React), TypeScript, TailwindCSS.
* **Backend / Signaling:** Node.js, Express, Socket.io (for OTC fallback and WebRTC signaling).
* **Data Processing:** WebRTC Data Channels (primary transfer), Web Workers (for off-main-thread chunking/hashing).
* **Storage (Client):** Origin Private File System (OPFS) or IndexedDB for handling huge files.
* **Infrastructure:** Docker containers, AWS S3 (only for TURN server logs or extreme relay fallbacks), AWS EC2/ECS. 

### 2. Architecture & Data Structures
**Dynamic Chunking Protocol:**
* **WebRTC P2P Size (>= 5MB files):** 64 kB packet chunks grouped into 4 MB sequential slices.
* **Optical QR Size (< 5MB files):** 512 bytes (QR Version 11) to 1024 bytes (QR Version 21).
* **Structure:** `[Sequence_ID (4 bytes)] [Payload_Length (2 bytes)] [Payload] [Checksum/CRC32 (4 bytes)]`.

**Metadata Object (QR / Signaling Data):**
```json
{
  "f": "video.mp4",
  "s": 1073741824, 
  "c": 524288,
  "h": "sha256-hash-of-file",
  "m": "webrtc", // or "optical"
  "sdp": "webrtc-offer-string",
  "otc": "123456"
}