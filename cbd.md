# Component-Based Design (CBD)

### 1. UI Components (Frontend - React/Next.js)
* **`FileDropzone`**: Handles drag-and-drop, validates file types/sizes.
* **`QRDisplay`**: Renders the dynamic SVG/Canvas QR code. Optimized for 15-30 fps cycling for the optical stream.
* **`ScannerView`**: Uses `jsQR` or a WebAssembly-compiled QR scanner for high-performance frame processing.
* **`OTCForm`**: 6-digit PIN input fields (fallback for ScannerView).
* **`TransferProgress`**: Circular progress bar showing chunk transmission status, speed (MB/s), ETA, and active transport mode.

### 2. Service Modules (Frontend Core Logic)
* **`TransportController`**: Evaluates file size and automatically routes data to either `OpticalStreamManager` or `WebRTCManager`.
* **`FileProcessorWorker`**: Web Worker for non-blocking file chunking, hashing, and AES-GCM encryption.
* **`WebRTCManager`**: Manages RTCPeerConnection, STUN/TURN configurations, and DataChannel backpressure (64 kB chunks).
* **`OpticalStreamManager`**: Cycles an array of base64 chunks (512B-1024B) to the `QRDisplay` component using `requestAnimationFrame`. Integrates Reed-Solomon FEC.

### 3. Backend Components (Node.js/Socket.io)
* **`RoomManager`**: Manages ephemeral rooms tied to the 6-digit OTC.
* **`SignalingController`**: Passes SDP offers, ICE candidates, and NACK requests. Destroys data immediately after routing.
* **`RateLimiter`**: Prevents brute-forcing of the 6-digit OTC.

### 4. Infrastructure (DevOps)
* **`Dockerfile`**: Containerizes the Node.js signaling server.
* **`docker-compose.yml`**: Spins up the application, backend, and a local Redis instance.
* **`Terraform`**: AWS configuration for auto-scaling EC2 instances behind an Application Load Balancer.