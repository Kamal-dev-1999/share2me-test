# Product Requirements Document (PRD)
## Project: Secure Multi-Platform File Transfer System (QR-Handshake / P2P)

### 1. Overview
A highly secure, scalable web application facilitating file transfers across Desktop-to-Mobile, Mobile-to-Desktop, and Mobile-to-Mobile. The system utilizes a dynamic transport layer, automatically switching between a pure visual QR stream (for files < 5 MB) and a high-speed WebRTC P2P connection (for files >= 5 MB).

### 2. Core Objectives
* **Cross-Platform:** Browser-based (no native app required).
* **High Scalability:** Capable of transferring unlimited file sizes (GBs+) without crashing the browser.
* **Zero Data Loss:** Implementation of robust chunking, validation, and reassembly.
* **Security:** End-to-End Encryption (E2EE); data does not persist on intermediary servers.
* **Smart Transport Switching:** Automatically selects the optimal chunk size and transport medium based on the file payload.

### 3. User Flows
**Flow A: Sender Initiation**
1. User selects a file via drag-and-drop or file picker.
2. System reads the file into a Web Worker and converts it to a binary blob.
3. System checks file size:
   - **< 5 MB:** Prepares for Optical QR Stream (chunks of 512B - 1024B).
   - **>= 5 MB:** Prepares for WebRTC P2P Stream (chunks of 64 kB).
4. System generates a Metadata QR code (contains filename, total chunks, hash, transport mode, and signaling SDP offer).
5. System displays the Metadata QR code (and a 6-digit One-Time Code fallback).

**Flow B: Receiver Processing**
1. User opens the receiver URL.
2. User scans the Metadata QR using the device camera (or enters the 6-digit OTC).
3. Context is established. 
   - If WebRTC mode: Connects to sender's stream.
   - If Optical mode: Prompts sender to start cycling QR frames.
4. Chunks are transmitted, verified via checksums, and stored locally (IndexedDB/OPFS).
5. Upon 100% completion, chunks are reassembled into the original file format and automatically downloaded.

### 4. Edge Cases & Error Handling
* **QR Scan Failure / Camera Unavailable:** User inputs the 6-digit OTC to establish a WebSocket/WebRTC signaling connection.
* **Network Interruption:** The system maintains the current chunk index and resumes exactly where it dropped off.
* **Tab Closure:** Warn user before closing if a transfer is active.