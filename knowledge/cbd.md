# Component-Based Design (CBD)

### 1. UI Components (Frontend - React/Next.js)
* **`HeroSection`**: Introduces the app, displays features and value props.
* **`TopNav`**: Navigation bar with logo and E2EE/P2P badges.
* **`ModeSelector`**: Toggle switch to navigate between Send and Receive modes.
* **`SendFlow`**: Contains the drag-and-drop file picker, OTC display, QR code generation (`qrcode` package), metadata JSON output, and chunk transmission progress.
* **`ReceiveFlow`**: Contains OTC input, Receiver ECDH Key status indicator, Metadata JSON import area, and receive/decryption progress bar.

### 2. Custom Hooks & Service Modules (Frontend Core Logic)
* **`useTransfer`**: The core state machine hook encapsulating WebRTC DataChannels, Socket.io signaling, and Web Worker communication. Translates socket events into React state (`senderPhase`, `receiverPhase`).
* **`useSocket`**: Singleton Socket.io-client hook that connects to `NEXT_PUBLIC_SIGNAL_URL`.
* **`worker.js` (Web Worker)**: Runs off the main thread. Handles AES-GCM encryption/decryption of chunks, ECDH P-256 keypair generation, and key wrapping/unwrapping.
* **`storage.js`**: Handles Origin Private File System (OPFS) fallback to IndexedDB for storing chunk blobs to bypass RAM limitations.

### 3. Backend Components (Node.js/Socket.io)
* **`server.js`**: Express server handling WebSocket connections.
  * **Room Management**: Manages ephemeral rooms tied to the 6-digit OTC via in-memory Maps.
  * **Signaling Relay**: Passes WebRTC SDP offers/answers, ICE candidates, `receiver_pub`, `wrapped_key`, and `nack` requests. Destroys data immediately after routing.
  * **Rate Limiting**: Prevents brute-forcing of the 6-digit OTC.
  * **HTTP Proxy**: Uses `http-proxy-middleware` to forward all non-socket HTTP traffic to the Next.js dev server on port 3001, allowing a single unified entry point on port 3000.

### 4. Infrastructure (Future DevOps)
* **`package.json` (Root)**: Orchestrates both frontend and backend dev environments (`npm run dev`).
* **`Dockerfile`**: (Planned) Containerizes the Node.js signaling server and frontend build.
* **`Terraform`**: (Planned) AWS configuration for auto-scaling EC2 instances behind an Application Load Balancer.