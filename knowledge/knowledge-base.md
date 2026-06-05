# ShareIt Knowledge Base

This document is the project handoff for coding agents. Read this first when resuming work on the ShareIt repository.

## 1. Project Summary

ShareIt is a browser-based, secure file transfer POC with two transport modes:

- `optical` for smaller transfers using QR streaming.
- `webrtc` for larger transfers using peer-to-peer DataChannels.

The current repo contains a working POC with:

- an Express + Socket.io signaling server,
- sender and receiver browser pages,
- a Web Worker for AES-GCM encryption/decryption,
- persistent chunk storage using OPFS with IndexedDB fallback,
- a Socket.io NACK/resume flow that requests only missing chunk sequences.

## 2. Repository Layout

Current top-level files and folders:

- [server.js](../server.js) - Express server and Socket.io signaling hub.
- [package.json](../package.json) - runtime dependencies and scripts.
- [package-lock.json](../package-lock.json) - locked dependency graph.
- [README.md](../README.md) - short local run instructions.
- [public/](../public/) - browser assets.
- [knowledge/](./) - long-form project handoff docs.

Important browser files:

- [public/sender.html](../public/sender.html)
- [public/receiver.html](../public/receiver.html)
- [public/worker.js](../public/worker.js)
- [public/storage.js](../public/storage.js)

Reference documents that define the original product intent:

- [knowledge/cbd.md](./cbd.md)
- [knowledge/flow.md](./flow.md)
- [knowledge/prd.md](./prd.md)
- [knowledge/trd.md](./trd.md)

## 3. Current State

### Completed in the POC

- Sender page can create a room via a 6-digit OTC.
- Sender generates metadata via a Web Worker.
- Sender encrypts chunks with AES-GCM in the worker.
- Receiver imports metadata, decrypts chunks in the worker, and assembles the file.
- Persistent chunk storage uses OPFS when available and IndexedDB as fallback.
- Socket.io NACK/resume flow is implemented for missing chunk recovery.

### Not yet implemented

- Full optical QR streaming loop.
- Reed-Solomon FEC.
- Production-grade key exchange that avoids exposing the raw AES key in metadata.
- Robust WebRTC backpressure handling.
- OPFS resume bitmap / precise partial-transfer recovery.
- CI, Docker, Terraform, test automation, and observability stack.

## 4. Architecture Overview

### Runtime Pieces

#### Backend

- `Express` serves static files from `public/`.
- `Socket.io` is used for signaling and room-based message routing.
- OTC rooms are ephemeral and held in memory.
- A lightweight join attempt counter rate-limits OTC guessing.

#### Frontend

- `sender.html` handles file selection, OTC creation, QR display, and WebRTC send.
- `receiver.html` handles OTC join, metadata import, decryption, and reassembly.
- `worker.js` performs hashing, AES-GCM encryption/decryption.
- `storage.js` persists chunks to OPFS/IndexedDB.

#### Persistence

- Preferred backend: OPFS via `navigator.storage.getDirectory()`.
- Fallback backend: IndexedDB.
- Storage is keyed by `transferId`, `side`, and `seq`.

## 5. Current Data Flow

### Sender Flow

1. User picks a file.
2. Sender emits `create_room` to get a 6-digit OTC.
3. Sender creates a Web Worker.
4. Worker computes:
   - SHA-256 of the file,
   - AES-GCM key,
   - encrypted chunks,
   - metadata object.
5. Sender stores encrypted chunks in `ShareItStorage`.
6. Sender displays metadata JSON and QR output.
7. Sender starts a WebRTC offer and opens a DataChannel.
8. Sender sends all stored chunks over DataChannel.
9. Sender listens for `nack` messages and resends only missing sequences.

### Receiver Flow

1. User enters OTC and joins the room.
2. Receiver imports metadata JSON.
3. Receiver starts a Web Worker and imports the AES key.
4. Receiver receives encrypted chunks over DataChannel.
5. Worker decrypts chunks.
6. Receiver stores decrypted chunks in `ShareItStorage`.
7. Receiver tracks received sequence numbers.
8. If chunks are missing, receiver emits `nack` with missing sequences.
9. When all chunks are present, receiver assembles the file and downloads it.

## 6. Current Message and Data Contracts

### Socket.io Events

#### `create_room`

Sender -> server

Response:

```json
{ "otc": "123456" }
```

#### `join_room`

Receiver -> server

Payload:

```json
{ "otc": "123456" }
```

#### `signal`

Bidirectional room routing for WebRTC signaling.

Payload:

```json
{ "otc": "123456", "type": "offer|answer|ice", "data": {} }
```

#### `nack`

Receiver -> server -> sender relay.

Payload:

```json
{ "otc": "123456", "transferId": "123456", "total": 12, "missingSeqs": [3, 7, 8] }
```

#### `ack`

Currently routed by the server but not yet used by the browser flow.

### Metadata JSON

The worker currently produces metadata similar to:

```json
{
  "f": "file.txt",
  "s": 1800,
  "c": 1024,
  "h": "sha256-base64",
  "key": "aes-key-base64",
  "total": 2
}
```

Fields:

- `f`: filename.
- `s`: file size in bytes.
- `c`: chunk size.
- `h`: SHA-256 of the original file.
- `key`: raw AES-GCM key material in base64.
- `total`: total chunk count.

### Chunk Payload over DataChannel

Each chunk is sent as JSON:

```json
{
  "seq": 0,
  "total": 2,
  "data": "base64-ciphertext",
  "iv": "base64-iv"
}
```

The sender also sends a terminal message:

```json
{ "done": true, "transferId": "123456" }
```

For resends:

```json
{ "seq": 3, "total": 3, "data": "...", "iv": "...", "resend": true }
```

## 7. Storage Design

### API Surface

`ShareItStorage` is exposed globally from [public/storage.js](../public/storage.js).

Methods:

- `openDB()`
- `saveChunk(transferId, side, seq, data, iv)`
- `getChunks(transferId, side)`
- `getChunk(transferId, side, seq)`
- `clearTransfer(transferId, side)`
- `hasOPFS`

### OPFS Backend

If available, OPFS is used first.

Files are stored in a directory named `shareit_chunks` using names like:

- `<transferId>_<side>_<seq>.bin`
- `<transferId>_<side>_<seq>.iv`

### IndexedDB Backend

If OPFS is unavailable or fails, chunks are stored in an object store named `chunks`.

Index key:

- `transfer = [transferId, side, seq]`

## 8. Current Known Issues and Caveats

These are important for any future coding agent.

### Security caveat

- The AES key is still included in metadata JSON.
- That is acceptable only for the POC and should be hardened before production.

### Sender implementation caveat

- The sender code currently resends stored chunks directly from persistent storage.
- It is not yet a minimal diff bitmap protocol; it simply sends the missing sequence numbers requested by the receiver.

### Resume caveat

- Resume is implemented as storage-backed resend, not as a full transfer checkpoint/rejoin protocol.
- The receiver can request missing sequences, but automatic partial reconstruction after reload still needs more work.

### Optical caveat

- `optical` mode is still not implemented end-to-end.
- The repo currently documents it in the PRD/TRD, but the code path is still WebRTC-first.

### Browser compatibility caveat

- OPFS detection uses `navigator.storage.getDirectory()`.
- If the browser lacks it, the code falls back to IndexedDB.

### Code quality caveat

- The POC is intentionally lightweight and not production hardened.
- It lacks automated tests and build-time lint/type checks.

## 9. What Future Agents Should Read First

When context is tight, read these files in this order:

1. [server.js](../server.js)
2. [public/sender.html](../public/sender.html)
3. [public/receiver.html](../public/receiver.html)
4. [public/worker.js](../public/worker.js)
5. [public/storage.js](../public/storage.js)
6. [knowledge/trd.md](./trd.md)
7. [knowledge/flow.md](./flow.md)

## 10. Recommended Next Engineering Steps

If continuing product work, the best next tasks are:

1. Replace raw-key metadata with a safer key-wrapping flow.
2. Improve NACK resume into a proper chunk bitmap handshake.
3. Add OPFS partial recovery support and cleanup policies.
4. Implement optical QR streaming and FEC.
5. Add automated browser tests for sender/receiver flows.
6. Add Docker + compose for local repeatable runs.

## 11. Local Run Commands

```bash
npm install
npm start
```

Then open:

- http://localhost:3000/sender.html
- http://localhost:3000/receiver.html

## 12. Debugging Notes

- If sender metadata never appears, check the browser console and confirm the file input contains a file before clicking create.
- If the receiver keeps requesting missing chunks, confirm the sender has an open DataChannel and that the same OTC is used in both tabs.
- If chunks are not persisting, check whether OPFS is available and then fall back to IndexedDB.
- If a future edit changes `public/storage.js`, verify both sender and receiver still load it via `/storage.js`.

## 13. Current Git State

Recent commits added:

- POC scaffold and server.
- AES-GCM worker.
- IndexedDB / OPFS storage.
- Socket.io NACK/resume routing.

If a future agent needs the exact state, inspect `git log --oneline` and start from the latest commit.
