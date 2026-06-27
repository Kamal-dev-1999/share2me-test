# ShareIt / Share2Me - Reported Bugs & Fixes Log

This document serves as a knowledge base to track major bugs encountered during the development of Share2Me, the symptoms they caused, and the specific architectural fixes applied to resolve them.

---

## 1. WebRTC Desktop-to-Desktop Transfer Frozen at 0%
**Symptom:** When transferring between two powerful desktop PCs, the sender's progress bar would freeze immediately at 0%, while the receiver would be stuck at "Answer sent. Waiting for data...".
**Cause:** The streaming start trigger relied on the condition `s.streamingIndex === frames.length - 1`. Because desktop PCs encrypt chunks incredibly fast, the worker would push 50+ encrypted chunks to the array *before* the WebRTC DataChannel finished negotiating. When the DataChannel finally triggered `onopen`, the index was `0` but the length was `50`. The condition failed, and the data transfer was never kickstarted.
**Fix:** Modified the `chunk` message handler in `useTransfer.ts` to unconditionally kickstart the stream when the DataChannel is open and unpaused (`if (s.dc?.readyState === "open" && !s.streamPaused && s.chunksReady === false) { resumeStream(); }`).

---

## 2. PC-to-PC Client Isolation Block (TURN Server Missing)
**Symptom:** Cross-device transfers over the same college Wi-Fi / LAN failed to connect. The STUN server successfully generated candidates, but the router's "Client Isolation" prevented direct peer-to-peer data channel connections.
**Cause:** During the high-scalability rewrite, the hardcoded fallback credentials for the free TURN server (`turn:free.expressturn.com:3478`) were removed from `server.js` without being replaced in the `.env` file, leaving the backend without a TURN relay to offer the frontend.
**Fix:** Restored the `free.expressturn.com` configuration directly into the default fallback variables in `backend/server.js` so that NAT-restricted devices can seamlessly relay traffic through the TURN server when direct peer-to-peer drops.

---

## 3. The NACK Receiver Flood
**Symptom:** The receiver UI would display active downloading, but the sender's progress bar would freeze at 5% while displaying messages like "Resent chunk 460". 
**Cause:** The receiver's 300ms NACK timer checked for missing chunks against the `total` file length immediately. Because it only had chunks 1-112, it eagerly sent a NACK requesting chunks 113 to 2254, even though the sender simply hadn't transmitted them yet. This flooded the sender with NACKs, forcing it into a perpetual resend loop.
**Fix:** Updated the receiver's `scheduleNackCheck` to only evaluate missing chunks up to the `highestSeq` (the highest chunk number successfully received on the wire so far) instead of `total`. 

---

## 4. Sender Stream Pipeline Frozen by NACK Overwrite
**Symptom:** After a single chunk was dropped and recovered, the main file transfer permanently paused.
**Cause:** When the sender paused the main stream to resend a dropped chunk (`resendMissingChunks`), it temporarily hijacked the `s.dc.onbufferedamountlow` event handler to apply backpressure to the NACKs. However, when finished, it never restored the main stream pipeline, leaving it orphaned.
**Fix:** Added a conditional check at the end of `resendMissingChunks` to cleanly trigger `resumeStream()` and restore the main stream pipeline once the NACK loop finishes.

---

## 5. Async Promise Anti-Pattern in `joinRoom`
**Symptom:** Silent failure when a receiver attempted to join a room, where `setupReceiverPeer` crashed but the UI just sat loading indefinitely.
**Cause:** `joinRoom` was wrapped in an explicit `new Promise(async (resolve, reject) => { ... })`. If the `await setupReceiverPeer()` threw an error, it rejected the hidden inner async function, but the outer Promise swallowed the error completely.
**Fix:** Refactored `joinRoom` so that `await setupReceiverPeer()` executes sequentially before entering the explicit Promise block for the Socket.io callback.

---

## 6. Mixed Content HTTP/HTTPS Socket.io Blocking
**Symptom:** After deploying the Next.js frontend to Vercel (HTTPS), it immediately failed to connect to the AWS EC2 backend.
**Cause:** Modern web browsers enforce strict security policies blocking encrypted HTTPS websites from communicating with unencrypted HTTP backends. This killed the `fetch` to `/api/ice-servers` and downgraded WebSockets to polling, which subsequently failed due to proxy intercept loops (`ws: true` in `http-proxy-middleware`).
**Fix:** Installed and configured a Caddy reverse proxy on the AWS EC2 instance to handle automatic SSL termination (mapping `https://api.share2.me` to `localhost:3000`). Disabled the proxy middleware in `server.js` to prevent it from intercepting and mangling Socket.io upgrade requests.
