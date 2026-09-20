# Cloud Run Backend Cost Optimization & WebSocket Architecture Guide

## 1. Problem Statement & Root Cause Analysis

### Symptoms
* Cloud Run `share2me-backend` accumulated **₹1,567.78** over ~8 days (~₹191/day, projected ~₹5,740/month) with only **158 requests** in 14 days.
* In contrast, `share2me-frontend` cost **₹30.04** and `share2me-ai` cost **₹15.16**.

### Root Cause
1. **Serverless Billing Model vs. Persistent Connections**:
   * Google Cloud Run charges by the millisecond for allocated vCPU and Memory during active requests.
   * **In Cloud Run, an open WebSocket connection is treated as an active in-flight request.**
   * As long as even one client has an open WebSocket connection, the container is marked `State: active (1 instance)`, preventing scale-to-zero and incurring full vCPU + RAM billing 24/7.
2. **Nighttime Mystery Solved (Next.js SSR Socket Leak)**:
   * Even when the vendor's PC was turned off at night (disconnected at 10:46 PM IST), the backend received continuous WebSocket connections every 300 seconds from IP `34.96.40.142` (Google Cloud infrastructure).
   * **Source**: In `frontend/src/hooks/useSocket.ts`, `io(url, { transports: ["websocket"] })` was called at module/render scope without guarding for `typeof window !== "undefined"`.
   * When Next.js pre-rendered pages during SSR on Cloud Run (`share2me-frontend`), the Node.js frontend process opened and maintained a persistent WebSocket to the backend container 24/7.
3. **Local Print Agent Background Service**:
   * `Share2Me-PrintAgent.exe` runs silently in the background on Windows (`HKCU\...\Run`) and maintains an active Socket.io connection to `api.share2me.in` whenever the vendor's PC is powered on.

---

## 2. Evaluation of Architectural Approaches

### Approach 1: Smart HTTP Short/Long-Polling (Zero-Cost Serverless Native)
Instead of holding a WebSocket connection open 24/7, the client (Print Agent or dashboard) polls the backend via standard HTTP requests.

* **Latency Optimization**:
  * Instead of a slow 30-60s interval, use a **smart adaptive poll**:
    * **Active Work Hours (or when dashboard is open)**: Poll every **3 to 5 seconds**. A 3-5s delay is imperceptible in a physical print shop setting (the customer is still walking to the counter).
    * **Idle Hours (no print jobs for > 15 mins)**: Exponential backoff up to **15 to 30 seconds**.
    * **Instant Trigger**: When a new job is created, the student's browser or mobile checkout triggers an immediate lightweight push or webhook.
* **Profits (Pros)**:
  * **Cost drops to ₹0 / month**: An HTTP poll takes ~15–25ms of compute. Even polling every 5s across working hours uses only ~4–6 minutes of compute per day, falling 100% inside GCP's **Free Tier** (2M requests and 180,000 vCPU-seconds free per month).
  * **Zero DevOps overhead**: No extra VMs, no container clusters, no OS patching.
  * **Resilient**: Works across corporate firewalls, NATs, and unstable mobile Wi-Fi without connection dropouts.
* **Limitations (Cons)**:
  * 3–5 second latency for print jobs compared to < 100ms WebSocket push.
  * Slightly higher request count (though still well within the 2M free tier limit).

---

### Approach 2: Decoupled WebSocket Gateway (Small Fixed-Cost VM or Container)
Separate the heavy stateless backend from the stateful WebSocket connection manager.
* **Architecture**:
  * **Backend (Cloud Run)**: Handles heavy compute (LibreOffice, Puppeteer PDF rendering, Tesseract OCR, DB transactions). Scales to 0 when idle.
  * **Signaling Gateway (Tiny VM or Container)**: A lightweight Node.js/Go service whose only job is holding WebSocket connections and relaying events via Redis or HTTP webhook to Cloud Run.
* **Latency**: **Instant (< 50ms)** real-time push.
* **Profits (Pros)**:
  * **Zero or fixed low cost**: Can be hosted on GCP's **Forever-Free e2-micro VM** (1 vCPU, 1 GB RAM, 30 GB disk free in US regions) or a $3/month VPS.
  * Handles 20,000+ concurrent idle WebSocket connections on 256MB of RAM.
  * Cloud Run compute drops to near-zero since it only runs when an actual job is processed.
* **Limitations (Cons)**:
  * Requires managing a Linux VM (systemd, SSL renewal, security patches) or maintaining a separate service.

---

### Approach 3: Managed Realtime Backend-as-a-Service (Supabase Realtime / Firebase / Pusher)
Outsource persistent connection handling entirely to a managed real-time provider.
* **Architecture**:
  * When a print job is uploaded, Cloud Run inserts the row into PostgreSQL/Supabase.
  * Supabase Realtime (or Firebase Realtime Database) automatically pushes the change to the subscribed Print Agent via its WebSocket infrastructure.
* **Latency**: **Near-instant (< 100–200ms)**.
* **Profits (Pros)**:
  * Zero server management.
  * Automatically scales from 1 to 50,000+ connections without infrastructure changes.
  * Free tier covers up to 200 concurrent connections and 2M messages/month on Supabase.
* **Limitations (Cons)**:
  * Dependency on a third-party managed service.
  * Requires refactoring the Print Agent socket client to use the Supabase/Firebase SDK.

---

### Approach 4: Ephemeral On-Demand WebSockets
Keep WebSockets on Cloud Run, but strictly control the connection lifecycle so sockets are never held open continuously.
* **Architecture**:
  * The Print Agent only connects when the vendor explicitly clicks "Start Printing Session" or when the shop dashboard is in active focus.
  * Automatic disconnect after 5 minutes of idle time.
* **Latency**: Instant once connected, but 3–5s cold start for the first connection.
* **Profits (Pros)**:
  * Retains Socket.io without architecture rewrites.
* **Limitations (Cons)**:
  * Prone to human error (vendor leaves tab open, container stays active 24/7).
  * Cold start latency when reconnecting.

---

## 3. What a Senior Cloud Architect Would Choose at Scale

If scaling Share2Me to **10,000 to 100,000+ active users**:

> **Golden Rule of Cloud Architecture**:  
> *"Never co-locate persistent stateful connections (WebSockets) on a serverless compute engine that charges by active execution duration."*

### The Recommended Architecture at Scale:
1. **Stateless Compute on Cloud Run**:
   Keep PDF processing, OCR, billing, and REST APIs on Cloud Run. Serverless is ideal for spiky, heavy tasks because it scales from 0 to 100 instances in seconds and costs $0 when idle.
2. **Stateful Connection Gateway (Decoupled)**:
   Deploy a minimal, ultra-lightweight WebSocket gateway (Node.js/Go) on a dedicated instance (e2-micro free tier or small Kubernetes pod). Its sole responsibility is maintaining client connections and passing messages.
3. **For the Print Agent specifically**:
   Implement **Smart Adaptive Polling (3–5s during open hours)**. In real-world print shops, a 3-second delay is completely imperceptible to human customers, eliminates all WebSocket complexity, and guarantees **₹0 cloud cost**.

---

## 4. Immediate Remediation Implemented

1. **SSR Leak Fixed in `frontend/src/hooks/useSocket.ts`**:
   Guarded socket creation with `typeof window !== "undefined"`. The Next.js frontend container will no longer open or maintain background WebSockets during server-side pre-rendering, allowing the backend container to shut down and scale to zero at night.
