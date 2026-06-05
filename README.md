# ShareIt POC

Minimal proof-of-concept for Secure Multi-Platform File Transfer (QR handshake + WebRTC datachannel).

Quick start

1. Install dependencies

```bash
npm install
```

2. Start the signaling server

```bash
npm start
```

3. Open the unified app:
- http://localhost:3000/index.html

4. Use the Sender and Receiver panels on the same page, or open the same URL in two tabs/devices and use one as sender and the other as receiver.

Flow

- Sender: pick a file, click `Create OTC & Prepare` to generate a 6-digit code and a QR-safe metadata payload. Share that with the receiver.
- Receiver: enter the OTC, join the room, paste/import metadata, and complete the secure key exchange before receiving the file.

Notes
- This POC now includes AES-GCM chunk encryption, ECDH-based key wrapping over Socket.io, OPFS/IndexedDB chunk persistence, and a NACK-based resume flow. Optical streaming/FEC remains next.
