# Product Requirements Document (PRD)
## Project: ShareIt — Secure Multi-Platform File Transfer System (QR-Handshake / P2P)

### 1. Overview
A highly secure, scalable web application facilitating file transfers across Desktop-to-Mobile, Mobile-to-Desktop, and Mobile-to-Mobile. The system currently utilizes a high-speed WebRTC P2P connection, with plans to introduce a pure visual QR stream (Optical mode) for very small files (< 5 MB) without requiring any network connectivity between devices.

### 2. Core Objectives
* **Cross-Platform:** Browser-based (no native app required, using Next.js 14).
* **High Scalability:** Capable of transferring unlimited file sizes (GBs+) without crashing the browser by utilizing Web Workers and OPFS.
* **Zero Data Loss:** Implementation of robust chunking, checksum validation, and NACK-based chunk re-requesting.
* **Security:** End-to-End Encryption (E2EE) using AES-GCM-256 and ECDH P-256 key exchange; raw AES key never touches the server or the QR code.
* **Ease of Use:** Users can initiate transfers via QR code scans or a 6-digit OTC.

### 3. User Flows
**Flow A: Sender Initiation**
1. User opens the web app and selects a file via drag-and-drop or file picker on the "Send" tab.
2. System reads the file into a Web Worker and begins AES-GCM encryption in chunks.
3. System generates an ephemeral ECDH keypair and an OTC room via the signaling server.
4. System displays a Metadata QR code (contains filename, total chunks, hash, transport mode, and the sender's ECDH public key) along with the 6-digit OTC fallback.
5. Sender waits for the receiver's public key to perform the AES key wrap.

**Flow B: Receiver Processing**
1. User opens the receiver URL ("Receive" tab).
2. User enters the 6-digit OTC to join the room.
3. User scans the Metadata QR using the device camera (or pastes the JSON).
4. System generates its own ECDH keypair and sends its public key to the sender over the signaling server.
5. Sender wraps the AES file key and sends it to the receiver. Receiver unwraps the key.
6. WebRTC DataChannel connection is established.
7. Chunks are transmitted, decrypted in the Web Worker, verified via checksums, and stored locally (OPFS/IndexedDB).
8. Upon 100% completion, chunks are reassembled into a Blob and automatically downloaded to the user's device.

### 4. Edge Cases & Error Handling
* **QR Scan Failure / Camera Unavailable:** User can manually paste the JSON metadata along with the 6-digit OTC.
* **Network Interruption / Missing Chunks:** Receiver's `useTransfer` hook tracks missing sequences and sends a `nack` event to request resends.
* **Cross-Device Testing:** Supported seamlessly via single-port reverse proxies (like `ngrok`), ensuring Socket.io and the Next.js UI run over the same domain/port.