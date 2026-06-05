### 3_System_Flow.md
```markdown
# System Flow 

### Phase 1: Initialization & Smart Chunking
1. `FilePickerComponent` captures file.
2. `Worker.ts` initialized. File passed to worker.
3. Worker calculates SHA-256 hash of entire file.
4. Transport Logic branches based on `file.size`:
   - If >= 5MB: Sets chunk size to 64 kB. Transport mode = `webrtc`.
   - If < 5MB: Sets chunk size to 512 bytes. Transport mode = `optical`.
5. AES-GCM key generated. Chunks encrypted.

### Phase 2: Signaling & Handshake
6. `SignalingService` generates a 6-digit OTC via Socket.io backend.
7. `QRCodeGenerator` renders the Metadata QR containing the AES key, metadata, transport mode, and WebRTC SDP offer.
8. Receiver device scans QR.
9. Receiver decodes metadata, extracts AES key.
   - If `webrtc`: Sends SDP Answer back via Signaling Server (using OTC room).
   - If `optical`: UI prepares for high-speed camera scanning.

### Phase 3: The Stream
**Branch A: WebRTC Stream**
10a. `WebRTCDataChannel` opens.
11a. Sender streams 64 kB encrypted chunks. Backpressure handling applied.
12a. Receiver gets chunks, validates CRC32 checksum. NACK sent for missing chunks.

**Branch B: Optical Stream**
10b. Sender starts `requestAnimationFrame` loop, displaying 512B chunks as QR codes at 15 fps.
11b. Receiver camera scans continuously. Reed-Solomon FEC applied to fix dropped frames.
12b. Missing chunk IDs are communicated back to sender via OTC signaling if network exists, or user must wait for loop to restart.

### Phase 4: Reassembly
13. Receiver `Worker.ts` decrypts chunks using the AES key.
14. Chunks appended to OPFS (Origin Private File System).
15. Once `received_chunks == total_chunks`, OPFS generates a Blob URL.
16. Browser triggers native download of the reassembled file.