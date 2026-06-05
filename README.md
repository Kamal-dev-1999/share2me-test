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

3. Open the sender page:
- http://localhost:3000/sender.html

4. Open the receiver page in another device or tab:
- http://localhost:3000/receiver.html

Flow

- Sender: pick a file, click `Create OTC & Prepare` to generate a 6-digit code and a QR. Share that with the receiver.
- Receiver: enter the OTC and `Join` to connect and receive the file via WebRTC DataChannel.

Notes
- This is a minimal POC focusing on signaling and chunked DataChannel transfer. It omits AES encryption and full optical streaming/FEC; those are next steps.
