# System Flow 

### Phase 1: Initialization & Encryption (Sender)
1. User drops file into `SendFlow` component.
2. `useTransfer` hook calls backend `create_room` to get a 6-digit OTC.
3. `worker.js` initialized. File passed to worker.
4. Worker generates ephemeral ECDH P-256 keypair and a random AES-GCM-256 key.
5. Worker calculates SHA-256 hash of entire file, encrypts file in 64 kB chunks.
6. Encrypted chunks are cached in memory (`useTransfer` state) and stored in OPFS (`storage.js`).
7. Worker generates Metadata JSON containing filename, total chunks, size, hash, and `senderPubKey` (but **no raw AES key**).

### Phase 2: Signaling & ECDH Key Exchange
8. Receiver inputs OTC into `ReceiveFlow` and joins the signaling room.
9. Receiver inputs the Metadata JSON (pasted or scanned via QR).
10. Receiver `worker.js` generates its own ECDH keypair and sends its `receiverPubKey` to Sender via Socket.io.
11. Sender receives `receiverPubKey`.
12. Sender `worker.js` performs ECDH key agreement to derive a shared key, wraps the raw AES file key, and sends `wrapped_key` to Receiver via Socket.io.
13. Receiver receives `wrapped_key`, unwraps it using their derived shared key, making the AES file key ready for decryption.

### Phase 3: WebRTC Transfer
14. Sender initiates WebRTC connection. `useTransfer` creates `RTCPeerConnection` and `RTCDataChannel`.
15. SDP Offers/Answers and ICE candidates are relayed through Socket.io `signal` event.
16. `RTCDataChannel` opens.
17. Sender streams the 64 kB encrypted chunks from memory over the DataChannel.
18. Receiver gets chunks, buffers them in memory, and passes them to `worker.js` for AES-GCM decryption.
19. Receiver issues `nack` via Socket.io for any missing chunk sequences. Sender resends them.

### Phase 4: Reassembly (Receiver)
20. Receiver `worker.js` successfully decrypts chunks and passes them to `storage.js` for OPFS persistence.
21. Sender sends a `{done: true}` DataChannel message.
22. Receiver sets `doneReceived` latch to true.
23. Once all chunks are decrypted and the latch is true, the `assembleDownload` function triggers.
24. Receiver reads all chunks from OPFS, creates a unified `Blob`, and generates an Object URL.
25. Browser triggers native download of the reassembled file using the original filename.