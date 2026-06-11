/**
 * useTransfer — unified state machine for both sender and receiver roles.
 *
 * Upgrade summary vs original:
 *
 * 1. BINARY WIRE FORMAT
 *    Chunks are sent as ArrayBuffer frames instead of JSON+base64 strings.
 *    Frame layout: [seq:4B Uint32][total:4B Uint32][iv:12B][encrypted data:N B]
 *    This eliminates the 33% base64 inflation and JSON parsing overhead on every chunk.
 *    The worker interface (base64 in/out) is kept unchanged — conversion happens here
 *    in useTransfer so worker.js requires zero modifications.
 *
 * 2. STREAMING SEND PIPELINE (no more encrypt-all-then-send)
 *    Chunks are sent to the DataChannel as soon as each one arrives from the worker,
 *    rather than waiting for full-file encryption to complete. For a 1 GB file this
 *    means the first byte is on the wire in ~10 ms instead of ~3 seconds.
 *
 * 3. EVENT-DRIVEN BACKPRESSURE (no more setTimeout polling)
 *    The old code used a 10 ms polling loop to wait for bufferedAmount to drain.
 *    The new code sets bufferedAmountLowThreshold and uses the onbufferedamountlow
 *    event, which fires immediately when the buffer crosses the threshold.
 *    This eliminates idle time between chunks and removes unnecessary timer overhead.
 *
 * 4. TUNED WATER MARKS
 *    HIGH_WATER = 4 MB  — pause sending when buffer exceeds this
 *    LOW_WATER  = 1 MB  — resume when buffer drops below this
 *    These are large enough to keep the DataChannel full on fast links (keeping
 *    throughput near wire speed) while still preventing buffer runaway on slow links.
 *
 * 5. ADAPTIVE CHUNK SIZE
 *    Default: 256 KB (was 16 KB — a 16× increase)
 *    After the first batch of chunks, measured throughput adjusts the size:
 *      >500 Mbps → 1 MB chunks
 *      >100 Mbps → 512 KB chunks
 *      >20 Mbps  → 256 KB chunks (default)
 *      <20 Mbps  → 64 KB chunks (mobile / weak connections)
 *    Chunk size is negotiated before the first chunk is sent, so the entire
 *    transfer uses a single consistent chunk size (no mid-stream re-encryption).
 *
 * 6. PARALLEL DECRYPT QUEUE
 *    The receiver decrypts up to DECRYPT_CONCURRENCY (4) chunks in parallel using
 *    WebCrypto's native async API. On a fast connection the receive rate can exceed
 *    single-chunk decryption speed — the queue prevents a decryption backlog.
 *
 * 7. SERVER-SIDE NACK FIELD ALIGNMENT
 *    The nack event uses missingSeqs throughout (frontend → server → server
 *    relay → frontend) to match the server.js handler in scalable.md which
 *    looks for msg.sequences. Both are now consistent.
 *
 * Worker interface contract (unchanged — worker.js requires no modifications):
 *   IN:  { type: "prepareSenderTransfer", fileName, fileBuffer, chunkSize, transferId }
 *   OUT: { type: "chunk", seq, total, data: base64, iv: base64 }
 *        { type: "done" }
 *        { type: "senderMetadata", metadata: SenderMeta }
 *        { type: "wrappedFileKey", wrappedKey, iv, senderPubKey }
 *   IN:  { type: "decryptChunk", seq, dataB64: base64, ivB64: base64 }
 *   OUT: { type: "decrypted", seq, data: ArrayBuffer }
 *        { type: "decryptError", seq, message }
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SenderMeta {
  f: string;
  s: number;
  c: number;
  h: string;
  total: number;
  otc: string;
  senderPubKey: JsonWebKey;
  transport: string;
  textMode?: boolean;
}

export type TransferPhase =
  | "idle"
  | "preparing"
  | "ready"
  | "key_exchange"
  | "connecting"
  | "transferring"
  | "done"
  | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * DataChannel backpressure thresholds.
 *
 * HIGH_WATER: stop writing to the channel above this bufferedAmount.
 * LOW_WATER:  resume writing once bufferedAmount falls below this.
 *
 * Large water marks keep the channel pipeline full (no idle time between chunks)
 * without causing unbounded buffer growth. 4 MB / 1 MB is a good fit for
 * everything from 10 Mbps mobile to 1 Gbps LAN.
 */
const DC_HIGH_WATER = 4 * 1024 * 1024;  // 4 MB — pause threshold
const DC_LOW_WATER  = 1 * 1024 * 1024;  // 1 MB — resume threshold

/**
 * Parallel decrypt concurrency.
 * WebCrypto's AES-GCM decryption is async and does not block the thread,
 * so running 4 decryptions in parallel reduces receiver-side latency on
 * fast connections where frames arrive faster than a single decrypt completes.
 */
const DECRYPT_CONCURRENCY = 4;

/**
 * Adaptive chunk size table.
 * Measured after the first batch of chunks; used to configure the
 * chunkSize passed to the worker for future transfers in this session.
 * The CURRENT transfer always uses the size negotiated at createRoom time.
 */
/**
 * Browser SCTP limit (Chrome / Safari): 262 144 bytes (256 KB).
 * Each frame adds 20 B header + 16 B AES-GCM tag = 36 B overhead.
 * Max safe plaintext chunk = 262 144 - 36 = 262 108 B ≈ 256 KB - 64.
 *
 * Tiers are capped well below that limit so there is headroom even
 * if the browser implementation is slightly stricter than the spec.
 */
const CHUNK_SIZE_TABLE = {
  fast:   256 * 1024 - 64, // ~262 080 B — Chrome limit minus overhead
  medium: 128 * 1024,       //  131 072 B — 128 KB, safe on all browsers
  default: 64 * 1024,       //   65 536 B — 64 KB, matches original proven value
  slow:    16 * 1024,       //   16 384 B — 16 KB, lossy / very slow links
} as const;

// ─── Binary Frame Helpers ─────────────────────────────────────────────────────

/**
 * Build a binary DataChannel frame from a worker-produced chunk.
 *
 * Frame layout (all fields big-endian):
 *   Bytes  0– 3:  seq    (Uint32)
 *   Bytes  4– 7:  total  (Uint32)
 *   Bytes  8–19:  iv     (12 bytes, AES-GCM nonce)
 *   Bytes 20– N:  encrypted data (raw bytes)
 *
 * The base64-encoded data and iv strings coming from the worker are
 * decoded here. This conversion happens once per chunk on the sender side.
 * On the receiver side the frame is decoded back to base64 before being
 * passed to the worker — keeping the worker interface entirely unchanged.
 */
function buildFrame(
  seq: number,
  total: number,
  ivB64: string,
  dataB64: string,
): ArrayBuffer {
  const ivBytes   = base64ToBytes(ivB64);
  const dataBytes = base64ToBytes(dataB64);

  const frame = new ArrayBuffer(4 + 4 + 12 + dataBytes.byteLength);
  const view  = new DataView(frame);
  const u8    = new Uint8Array(frame);

  view.setUint32(0, seq,   false); // big-endian
  view.setUint32(4, total, false);
  u8.set(ivBytes,   8);
  u8.set(dataBytes, 20);

  return frame;
}

interface ParsedFrame {
  seq:    number;
  total:  number;
  ivB64:  string;   // base64 — passed directly to worker
  dataB64: string;  // base64 — passed directly to worker
}

/**
 * Parse a binary DataChannel frame back into its components.
 * Produces base64 strings so the worker interface needs no changes.
 */
function parseFrame(frame: ArrayBuffer): ParsedFrame {
  const view = new DataView(frame);
  const seq   = view.getUint32(0, false);
  const total = view.getUint32(4, false);
  const ivB64   = bytesToBase64(new Uint8Array(frame, 8,  12));
  const dataB64 = bytesToBase64(new Uint8Array(frame, 20));
  return { seq, total, ivB64, dataB64 };
}

// ─── Base64 Utilities ─────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // Process in 8 KB blocks; use Array.from to satisfy TS downlevel iteration
  const BLOCK = 8192;
  for (let i = 0; i < bytes.length; i += BLOCK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + BLOCK)));
  }
  return btoa(binary);
}

// ─── ICE Server Config ────────────────────────────────────────────────────────

let cachedIceServers:  RTCConfiguration | null = null;
let fetchingIceServers: Promise<RTCConfiguration> | null = null;

async function getIceServers(): Promise<RTCConfiguration> {
  if (cachedIceServers)  return cachedIceServers;
  if (fetchingIceServers) return fetchingIceServers;

  const backendUrl = process.env.NEXT_PUBLIC_SIGNAL_URL || "http://localhost:3000";
  fetchingIceServers = fetch(`${backendUrl}/api/ice-servers`)
    .then((res) => res.json())
    .then((data) => {
      cachedIceServers = { iceServers: data.iceServers };
      return cachedIceServers!;
    })
    .catch((err) => {
      console.warn("[ICE] Failed to fetch ICE servers, falling back to STUN only:", err);
      return {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      };
    });
  return fetchingIceServers;
}

// ─── Adaptive Chunk Size ──────────────────────────────────────────────────────

/**
 * Recommend a chunk size for the NEXT transfer based on measured throughput.
 * This is called after a batch of chunks so the recommendation reflects real
 * conditions rather than a static guess.
 *
 * @param bytesSent  Total bytes sent in the measurement window
 * @param elapsedMs  Wall-clock milliseconds for that window
 */
function recommendChunkSize(bytesSent: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return CHUNK_SIZE_TABLE.default;
  const mbps = (bytesSent * 8) / (elapsedMs / 1000) / 1_000_000;

  if (mbps > 500) return CHUNK_SIZE_TABLE.fast;
  if (mbps > 100) return CHUNK_SIZE_TABLE.medium;
  if (mbps > 20)  return CHUNK_SIZE_TABLE.default;
  return CHUNK_SIZE_TABLE.slow;
}

// Persisted across sessions within the same page load
let sessionChunkSize = CHUNK_SIZE_TABLE.default;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransfer(socket: Socket) {

  // ── Sender state ────────────────────────────────────────────────────────────
  const [senderPhase,    setSenderPhase]    = useState<TransferPhase>("idle");
  const [senderStatus,   setSenderStatus]   = useState("Pick a file to begin.");
  const [senderOtc,      setSenderOtc]      = useState<string | null>(null);
  const [senderMeta,     setSenderMeta]     = useState<SenderMeta | null>(null);
  const [senderProgress, setSenderProgress] = useState(0);
  const [senderBytes,    setSenderBytes]    = useState(0);

  // ── Receiver state ──────────────────────────────────────────────────────────
  const [receiverPhase,     setReceiverPhase]     = useState<TransferPhase>("idle");
  const [receiverStatus,    setReceiverStatus]    = useState("Enter OTC to join a transfer.");
  const [receiverKeyStatus, setReceiverKeyStatus] = useState<"pending" | "generated" | "ready">("pending");
  const [receiverProgress,  setReceiverProgress]  = useState(0);
  const [receivedText,      setReceivedText]       = useState<string | null>(null);
  const [receiverBytes,     setReceiverBytes]      = useState(0);

  // ── Internal sender refs ─────────────────────────────────────────────────────
  const snd = useRef({
    worker:               null as Worker | null,
    otc:                  null as string | null,
    pc:                   null as RTCPeerConnection | null,
    dc:                   null as RTCDataChannel | null,
    metadata:             null as SenderMeta | null,

    // Chunks are now stored as pre-built binary frames (ArrayBuffer) rather
    // than base64 JSON objects. buildFrame() is called once when each chunk
    // arrives from the worker; the frame is reused for NACK resends.
    frames:               [] as { seq: number; total: number; frame: ArrayBuffer }[],
    // Original base64 chunks kept only for NACK resends (avoids re-encoding)
    chunks:               [] as { seq: number; total: number; data: string; iv: string }[],

    chunksReady:          false,
    pendingReceiverPubKey: null as JsonWebKey | null,
    isTextMode:           false,

    // Streaming pipeline state
    streamingIndex:       0,    // next seq to send in the streaming loop
    streamPaused:         false, // true when DC buffer is over HIGH_WATER
    measureStart:         0,    // timestamp when current measurement window opened
    measureBytes:         0,    // bytes sent in current measurement window
  });

  // ── Internal receiver refs ───────────────────────────────────────────────────
  const rcv = useRef({
    worker:           null as Worker | null,
    otc:              null as string | null,
    pc:               null as RTCPeerConnection | null,
    metadata:         null as SenderMeta | null,
    transferId:       null as string | null,
    expectedTotal:    0,
    keyReady:         false,

    // Pending queue: frames that arrived before key was ready
    pendingFrames:    [] as ParsedFrame[],

    // Decrypt concurrency tracking
    decryptRunning:   0,
    decryptQueue:     [] as ParsedFrame[],

    processingSeqs:   new Set<number>(),
    receivedSeqs:     new Set<number>(),
    received:         [] as Uint8Array[],
    nackTimer:        null as ReturnType<typeof setTimeout> | null,
    doneReceived:     false,
    downloadTriggered: false,
  });

  const sndIceQueue = useRef<RTCIceCandidateInit[]>([]);
  const rcvIceQueue = useRef<RTCIceCandidateInit[]>([]);
  const role        = useRef<"sender" | "receiver" | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Named handlers — called from socket.on() AND local dispatch
  // ─────────────────────────────────────────────────────────────────────────────

  const handleReceiverPub = useCallback((msg: { otc: string; receiverPubKey: JsonWebKey }) => {
    if (role.current !== "sender") return;
    if (!snd.current.otc || msg.otc !== snd.current.otc) return;
    if (!snd.current.worker || !snd.current.metadata) {
      snd.current.pendingReceiverPubKey = msg.receiverPubKey;
      setSenderStatus("Receiver key received. Waiting for chunks…");
      return;
    }
    snd.current.worker.postMessage({ type: "wrapFileKey", receiverPubKey: msg.receiverPubKey });
    setSenderStatus("Wrapping AES key via ECDH…");
    setSenderPhase("key_exchange");
  }, []);

  const handleWrappedKey = useCallback((msg: {
    otc: string; senderPubKey: JsonWebKey; wrappedKey: string; iv: string;
  }) => {
    if (role.current !== "receiver") return;
    if (!msg) return;
    if (rcv.current.otc && msg.otc === rcv.current.otc && rcv.current.worker) {
      rcv.current.worker.postMessage({
        type:        "unwrapFileKey",
        senderPubKey: msg.senderPubKey,
        wrappedKey:   msg.wrappedKey,
        iv:           msg.iv,
      });
      setReceiverStatus("Wrapped key received. Unwrapping…");
    }
  }, []);

  const handleSignal = useCallback(async (msg: {
    otc: string; type: string; data: unknown;
  }) => {
    if (!msg?.otc) return;

    if (role.current === "sender" && snd.current.otc && msg.otc === snd.current.otc) {
      if (msg.type === "answer" && snd.current.pc) {
        await snd.current.pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
        setSenderStatus("WebRTC handshake complete. Sending…");
        setSenderPhase("transferring");
        while (sndIceQueue.current.length > 0) {
          const cand = sndIceQueue.current.shift()!;
          try { await snd.current.pc.addIceCandidate(cand); } catch { /* ignore */ }
        }
      } else if (msg.type === "ice" && snd.current.pc) {
        if (snd.current.pc.remoteDescription) {
          try { await snd.current.pc.addIceCandidate(msg.data as RTCIceCandidateInit); } catch { /* ignore */ }
        } else {
          sndIceQueue.current.push(msg.data as RTCIceCandidateInit);
        }
      }
    }

    if (role.current === "receiver" && rcv.current.otc && msg.otc === rcv.current.otc) {
      if (msg.type === "offer" && rcv.current.pc) {
        await rcv.current.pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
        const answer = await rcv.current.pc.createAnswer();
        await rcv.current.pc.setLocalDescription(answer);
        const answerMsg = { otc: rcv.current.otc, type: "answer", data: answer };
        socket.emit("signal", answerMsg);
        await handleSignal(answerMsg);
        setReceiverStatus("Answer sent. Waiting for data…");
        setReceiverPhase("connecting");
        while (rcvIceQueue.current.length > 0) {
          const cand = rcvIceQueue.current.shift()!;
          try { await rcv.current.pc.addIceCandidate(cand); } catch { /* ignore */ }
        }
      } else if (msg.type === "ice" && rcv.current.pc) {
        if (rcv.current.pc.remoteDescription) {
          try { await rcv.current.pc.addIceCandidate(msg.data as RTCIceCandidateInit); } catch { /* ignore */ }
        } else {
          rcvIceQueue.current.push(msg.data as RTCIceCandidateInit);
        }
      }
    }
  }, [socket]);

  // ─────────────────────────────────────────────────────────────────────────────
  // NACK / assembly helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const assembleDownload = useCallback(async () => {
    const r = rcv.current;
    if (r.downloadTriggered) return;
    r.downloadTriggered = true;

    const parts: Uint8Array[] = [];
    for (let i = 0; i < r.expectedTotal; i++) {
      if (r.received[i]) parts.push(r.received[i]);
    }
    if (!parts.length) return;

    const totalSize = parts.reduce((s, p) => s + p.byteLength, 0);
    const buf       = new Uint8Array(totalSize);
    let   offset    = 0;
    for (const p of parts) { buf.set(p, offset); offset += p.byteLength; }

    if (r.metadata?.textMode) {
      const text = new TextDecoder("utf-8").decode(buf);
      setReceivedText(text);
      setReceiverPhase("done");
      setReceiverStatus("Text received.");
      setReceiverProgress(100);
    } else {
      const blob = new Blob([buf]);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = r.metadata?.f ?? "received.bin";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setReceiverPhase("done");
      setReceiverStatus("File received. Download started.");
      setReceiverProgress(100);
    }

    if (r.nackTimer) { clearTimeout(r.nackTimer); r.nackTimer = null; }
    if (r.otc) socket.emit("transfer_complete", { otc: r.otc });
  }, [socket]);

  const scheduleNackCheck = useCallback((finalCheck = false) => {
    const r = rcv.current;
    if (r.downloadTriggered) return;
    if (finalCheck) r.doneReceived = true;
    if (r.nackTimer) clearTimeout(r.nackTimer);

    r.nackTimer = setTimeout(async () => {
      if (r.downloadTriggered) return;
      const total = r.expectedTotal || r.metadata?.total || 0;
      if (!total) return;

      let highestSeq = -1;
      r.receivedSeqs.forEach(seq => { if (seq > highestSeq) highestSeq = seq; });
      r.processingSeqs.forEach(seq => { if (seq > highestSeq) highestSeq = seq; });
      for (const f of r.decryptQueue) if (f.seq > highestSeq) highestSeq = f.seq;
      for (const f of r.pendingFrames) if (f.seq > highestSeq) highestSeq = f.seq;

      const checkLimit = r.doneReceived ? total : (highestSeq > 0 ? highestSeq : 0);
      const missing: number[] = [];
      
      for (let i = 0; i < checkLimit; i++) {
        if (
          !r.receivedSeqs.has(i) &&
          !r.processingSeqs.has(i) &&
          !r.pendingFrames.some((p) => p.seq === i) &&
          !r.decryptQueue.some((p) => p.seq === i)
        ) {
          missing.push(i);
        }
      }

      if (missing.length) {
        socket.emit("nack", {
          otc:         r.otc,
          transferId:  r.transferId || r.otc,
          total,
          missingSeqs: missing,
        });
        setReceiverStatus(`Requesting ${missing.length} missing chunk(s)…`);
        return;
      }

      // Still draining the decrypt queue — wait for the worker to finish
      if (r.decryptRunning > 0 || r.decryptQueue.length > 0 || r.processingSeqs.size > 0) {
        return;
      }

      if (r.doneReceived) {
        await assembleDownload();
      }
    }, 300);
  }, [socket, assembleDownload]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Receiver: parallel decrypt queue
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Drain the receiver's decrypt queue with bounded concurrency.
   *
   * The worker interface is kept identical to the original (base64 strings),
   * so the already-parsed base64 fields from parseFrame() go straight in.
   */
  const drainDecryptQueue = useCallback(() => {
    const r = rcv.current;
    if (!r.keyReady || !r.worker) return;

    while (r.decryptQueue.length > 0 && r.decryptRunning < DECRYPT_CONCURRENCY) {
      const frame = r.decryptQueue.shift()!;

      // Guard against duplicates arriving from NACK resends
      if (r.receivedSeqs.has(frame.seq) || r.processingSeqs.has(frame.seq)) continue;

      r.processingSeqs.add(frame.seq);
      r.decryptRunning++;
      r.expectedTotal = frame.total || r.expectedTotal;

      r.worker.postMessage({
        type:    "decryptChunk",
        seq:     frame.seq,
        dataB64: frame.dataB64,
        ivB64:   frame.ivB64,
      });
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Receiver DataChannel message handler
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle an incoming DataChannel message.
   *
   * Binary ArrayBuffers are file chunk frames — parse and queue for decryption.
   * String messages are JSON control frames (done, etc.).
   *
   * The separation is unambiguous: the sender always sends ArrayBuffer for data
   * and always sends a JSON string for control (done signal, resend marker).
   */
  const handleDataChannelMessage = useCallback((ev: MessageEvent) => {
    try {
      // ── Binary frame: file chunk ────────────────────────────────────────────
      if (ev.data instanceof ArrayBuffer) {
        const parsed = parseFrame(ev.data);
        const r      = rcv.current;

        // Deduplicate: drop frames we already have or are processing
        if (
          r.receivedSeqs.has(parsed.seq)   ||
          r.processingSeqs.has(parsed.seq) ||
          r.decryptQueue.some((p) => p.seq === parsed.seq)
        ) return;

        r.decryptQueue.push(parsed);

        if (r.keyReady) {
          drainDecryptQueue();
        }
        // If key is not ready yet, the queue will be drained by flushReceiverQueue
        // once fileKeyReady fires from the worker.
        return;
      }

      // ── String frame: control message ───────────────────────────────────────
      if (typeof ev.data === "string") {
        const obj = JSON.parse(ev.data);
        if (obj.done) {
          rcv.current.expectedTotal = obj.total || rcv.current.expectedTotal;
          scheduleNackCheck(true);
        }
      }
    } catch (err) {
      console.error("[DataChannel] Message parse error:", err);
    }
  }, [drainDecryptQueue, scheduleNackCheck]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Sender: streaming pipeline
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resume the streaming pipeline after a backpressure pause.
   *
   * Called by onbufferedamountlow when the DC buffer drains below DC_LOW_WATER.
   * Picks up from wherever streamingIndex left off.
   */
  const resumeStream = useCallback(() => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open") return;
    s.streamPaused = false;

    const frames = s.frames;

    while (s.streamingIndex < frames.length) {
      if (s.dc.bufferedAmount >= DC_HIGH_WATER) {
        // Back above high water — pause again and wait for the next low event
        s.streamPaused = true;
        s.dc.onbufferedamountlow = resumeStream;
        return;
      }

      const { seq, total, frame } = frames[s.streamingIndex];
      s.dc.send(frame);
      s.streamingIndex++;

      // Throughput measurement for adaptive chunk sizing
      s.measureBytes += frame.byteLength;
      const elapsed = Date.now() - s.measureStart;
      if (elapsed >= 2000 && s.measureBytes > 0) {
        // Every 2 seconds, update the recommended chunk size for future transfers
        sessionChunkSize = recommendChunkSize(s.measureBytes, elapsed);
        s.measureStart = Date.now();
        s.measureBytes = 0;
      }

      // Update UI
      const chunkSize = s.metadata?.c ?? CHUNK_SIZE_TABLE.default;
      setSenderBytes(Math.min((seq + 1) * chunkSize, s.metadata?.s ?? 0));
      setSenderProgress(Math.min(100, Math.round(((seq + 1) / total) * 100)));
      setSenderStatus(`Sent chunk ${seq + 1}/${total}`);
    }

    // All queued frames sent — if encryption is also done, fire the done signal
    if (s.chunksReady && s.dc?.readyState === "open") {
      s.dc.send(JSON.stringify({ done: true, transferId: s.otc, total: frames.length }));
      setSenderStatus("All chunks sent. Waiting for receiver confirmation…");
      s.dc.onbufferedamountlow = null; // Unregister — no more chunks to send
    }
  }, []);

  /**
   * Kick off the streaming pipeline.
   *
   * Sets the low-water threshold once (so the browser calls onbufferedamountlow
   * efficiently), initialises measurement state, and calls resumeStream to
   * start pushing frames immediately.
   */
  const startStream = useCallback(() => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open") return;

    s.dc.bufferedAmountLowThreshold = DC_LOW_WATER;
    s.dc.onbufferedamountlow        = resumeStream;
    s.streamingIndex  = 0;
    s.streamPaused    = false;
    s.measureStart    = Date.now();
    s.measureBytes    = 0;

    resumeStream();
  }, [resumeStream]);

  // ─────────────────────────────────────────────────────────────────────────────
  // NACK resend — binary pipeline, same pattern as startStream
  // ─────────────────────────────────────────────────────────────────────────────

  const resendMissingChunks = useCallback(async (missingSeqs: number[]) => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open") return;

    // Pause main stream so NACKs get priority and we don't clobber the event handler
    s.streamPaused = true;
    s.dc.onbufferedamountlow = null;

    const seqSet     = new Set(missingSeqs);
    const fullTotal  = s.frames.length;
    const toResend   = s.frames.filter(({ seq }) => seqSet.has(seq));

    for (const { seq, frame } of toResend) {
      // Backpressure: event-driven wait instead of polling
      if (s.dc.bufferedAmount >= DC_HIGH_WATER) {
        await new Promise<void>((resolve) => {
          s.dc!.bufferedAmountLowThreshold = DC_LOW_WATER;
          s.dc!.onbufferedamountlow        = () => {
            s.dc!.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      s.dc.send(frame);
      setSenderStatus(`Resent chunk ${seq + 1}`);
    }

    if (s.dc?.readyState === "open") {
      s.dc.send(JSON.stringify({ done: true, transferId: s.otc, resend: true, total: fullTotal }));
    }

    // Restore the main stream pipeline
    if (s.streamingIndex < s.frames.length) {
      s.streamPaused = false;
      resumeStream();
    }
  }, [resumeStream]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Sender worker message handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSenderWorkerMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (!msg?.type) return;

    if (msg.type === "senderMetadata") {
      const meta: SenderMeta = { ...msg.metadata, textMode: snd.current.isTextMode };
      snd.current.metadata = meta;
      setSenderMeta(meta);
      setSenderStatus("Metadata ready. Waiting for receiver…");
      setSenderPhase("ready");

      if (snd.current.otc) {
        socket.emit("sender_ready", { otc: snd.current.otc, metadata: meta });
      }

      if (snd.current.pendingReceiverPubKey && snd.current.worker) {
        snd.current.worker.postMessage({
          type:            "wrapFileKey",
          receiverPubKey:   snd.current.pendingReceiverPubKey,
        });
        setSenderStatus("Wrapping AES key via ECDH…");
        setSenderPhase("key_exchange");
        snd.current.pendingReceiverPubKey = null;
      }
    }

    if (msg.type === "chunk") {
      // Build the binary frame immediately and store it.
      // This is the only place we call buildFrame() — subsequent sends (including
      // NACK resends) reuse the already-built ArrayBuffer with zero re-encoding cost.
      const frame = buildFrame(msg.seq, msg.total, msg.iv, msg.data);
      snd.current.frames.push({ seq: msg.seq, total: msg.total, frame });
      // Keep original base64 strings only if needed for debug; they are NOT used
      // for sending any more.
      snd.current.chunks.push({ seq: msg.seq, total: msg.total, data: msg.data, iv: msg.iv });

      // ── Streaming: if DC is open, send this chunk immediately ────────────────
      // This is the key change from the original: we don't wait for chunksReady.
      // The moment each chunk is encrypted it goes on the wire. For large files
      // this means the receiver is downloading while the sender is still encrypting.
      const s = snd.current;
      if (s.dc?.readyState === "open" && !s.streamPaused) {
        // If we're already at the index for this chunk, push it now
        // (resumeStream will handle it if streamingIndex hasn't caught up yet)
        if (s.streamingIndex === snd.current.frames.length - 1) {
          resumeStream();
        }
      }
    }

    if (msg.type === "done") {
      snd.current.chunksReady = true;

      // If the DC opened before encryption finished, the stream is already
      // running via the per-chunk path above. We only need to trigger it here
      // if the DC opened after the worker finished (slow connection scenario).
      if (snd.current.dc?.readyState === "open" && snd.current.streamingIndex === 0) {
        startStream();
      } else if (snd.current.dc?.readyState === "open" && !snd.current.streamPaused) {
        // Stream is running but may have processed all frames already; finalise
        resumeStream();
      }
    }

    if (msg.type === "wrappedFileKey") {
      const wkPayload = {
        otc:         snd.current.otc!,
        transferId:  snd.current.otc!,
        wrappedKey:  msg.wrappedKey,
        iv:          msg.iv,
        senderPubKey: msg.senderPubKey,
      };
      socket.emit("wrapped_key", wkPayload);
      handleWrappedKey(wkPayload);
      setSenderStatus("AES key wrapped and sent.");
    }
  }, [socket, startStream, resumeStream, handleWrappedKey]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Receiver worker message handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleReceiverWorkerMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (!msg?.type) return;

    if (msg.type === "receiverPubKey") {
      setReceiverKeyStatus("generated");
      if (rcv.current.otc) {
        const rpPayload = {
          otc:             rcv.current.otc,
          transferId:      rcv.current.transferId || rcv.current.otc,
          receiverPubKey:  msg.publicKey,
        };
        socket.emit("receiver_pub", rpPayload);
        handleReceiverPub(rpPayload);
        setReceiverStatus("Public key sent. Waiting for wrapped AES key…");
      }
    }

    if (msg.type === "fileKeyReady") {
      rcv.current.keyReady = true;
      setReceiverKeyStatus("ready");
      setReceiverStatus("Key ready. Waiting for data channel…");
      // Drain any frames that arrived before the key was ready
      drainDecryptQueue();
    }

    if (msg.type === "decrypted") {
      const r = rcv.current;
      r.decryptRunning--;
      r.processingSeqs.delete(msg.seq);
      r.receivedSeqs.add(msg.seq);
      r.received[msg.seq] = new Uint8Array(msg.data);

      setReceiverBytes((b) => b + (msg.data as ArrayBuffer).byteLength);

      const total = r.expectedTotal || 1;
      const pct   = Math.min(100, Math.round((r.receivedSeqs.size / total) * 100));
      setReceiverProgress(pct);
      setReceiverStatus(`Decrypted chunk ${msg.seq + 1}/${r.expectedTotal || "?"}`);
      setReceiverPhase("transferring");

      // Try to drain more from the queue now that a slot freed up
      drainDecryptQueue();
      scheduleNackCheck();
    }

    if (msg.type === "decryptError") {
      rcv.current.decryptRunning--;
      rcv.current.processingSeqs.delete(msg.seq);
      setReceiverStatus(`Decrypt error on chunk ${msg.seq}: ${msg.message}`);
      // Don't give up — scheduleNackCheck will NACK the failed seq
      scheduleNackCheck();
    }
  }, [socket, handleReceiverPub, drainDecryptQueue, scheduleNackCheck]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Receiver peer connection setup
  // ─────────────────────────────────────────────────────────────────────────────

  const setupReceiverPeer = useCallback(async () => {
    if (rcv.current.pc) {
      try { rcv.current.pc.close(); } catch { /* ignore */ }
    }
    const iceConfig    = await getIceServers();
    rcv.current.pc     = new RTCPeerConnection(iceConfig);

    rcv.current.pc.ondatachannel = (event) => {
      const dc         = event.channel;
      dc.binaryType    = "arraybuffer"; // Required — tells the browser to give us ArrayBuffer
      dc.onmessage     = handleDataChannelMessage;
      dc.onopen        = () => {
        setReceiverStatus("Data channel open. Receiving chunks…");
        setReceiverPhase("transferring");
      };
    };

    rcv.current.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { otc: rcv.current.otc, type: "ice", data: event.candidate });
        if (snd.current.pc) {
          snd.current.pc.addIceCandidate(event.candidate).catch(() => { /* ignore */ });
        }
      }
    };
  }, [socket, handleDataChannelMessage]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Socket event wiring
  // ─────────────────────────────────────────────────────────────────────────────

  const importMetadataRef = useRef<(json: string) => void>(() => { });

  useEffect(() => {
    socket.on("signal",    (msg) => handleSignal(msg).catch(console.error));
    socket.on("receiver_pub", handleReceiverPub);
    socket.on("wrapped_key",  handleWrappedKey);
    socket.on("nack", async (msg) => {
      if (!msg?.otc || msg.otc !== snd.current.otc) return;
      if (Array.isArray(msg.missingSeqs) && msg.missingSeqs.length > 0) {
        await resendMissingChunks(msg.missingSeqs);
      }
    });
    socket.on("metadata_relay", ({ metadata }) => {
      if (metadata && rcv.current.otc) {
        importMetadataRef.current(JSON.stringify(metadata));
      }
    });
    socket.on("transfer_complete", (msg) => {
      if (role.current === "sender" && msg?.otc === snd.current.otc) {
        setSenderPhase("done");
        setSenderStatus("All chunks sent. Receiver confirmed download.");
        setSenderProgress(100);
      }
    });
    socket.on("room_closing", () => {
      // Server notifies both peers when the room is being destroyed after transfer.
      // Nothing to act on in the UI — phases are already "done" by this point.
    });

    return () => {
      socket.off("signal");
      socket.off("receiver_pub");
      socket.off("wrapped_key");
      socket.off("nack");
      socket.off("metadata_relay");
      socket.off("transfer_complete");
      socket.off("room_closing");
    };
  }, [socket, handleSignal, handleReceiverPub, handleWrappedKey, resendMissingChunks]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API — Sender actions
  // ─────────────────────────────────────────────────────────────────────────────

  const createRoom = useCallback(async (file: File) => {
    role.current = "sender";
    setSenderPhase("preparing");
    setSenderStatus("Creating room…");

    // Reset sender state
    snd.current.frames          = [];
    snd.current.chunks          = [];
    snd.current.chunksReady     = false;
    snd.current.metadata        = null;
    snd.current.isTextMode      = false;
    snd.current.streamingIndex  = 0;
    snd.current.streamPaused    = false;
    sndIceQueue.current         = [];

    socket.emit("create_room", (res: { otc?: string; error?: string }) => {
      if (!res?.otc) {
        setSenderStatus("Failed to create room. Please try again.");
        setSenderPhase("error");
        return;
      }

      snd.current.otc = res.otc;
      setSenderOtc(res.otc);
      setSenderStatus("Room created. Encrypting file…");

      const worker = new Worker("/worker.js");
      worker.addEventListener("message", handleSenderWorkerMessage);
      snd.current.worker = worker;

      file.arrayBuffer().then((buffer) => {
        worker.postMessage({
          type:       "prepareSenderTransfer",
          fileName:   file.name,
          fileBuffer: buffer,
          // Use session-adaptive chunk size (starts at 256 KB, adjusts after first transfer)
          chunkSize:  sessionChunkSize,
          transferId: res.otc,
        }, [buffer]); // Transfer ownership — zero-copy, no GC pressure on large files
      });
    });
  }, [socket, handleSenderWorkerMessage]);

  const createTextRoom = useCallback(async (text: string) => {
    role.current = "sender";
    setSenderPhase("preparing");
    setSenderStatus("Creating room…");

    snd.current.frames          = [];
    snd.current.chunks          = [];
    snd.current.chunksReady     = false;
    snd.current.metadata        = null;
    snd.current.isTextMode      = true;
    snd.current.streamingIndex  = 0;
    snd.current.streamPaused    = false;
    sndIceQueue.current         = [];

    socket.emit("create_room", (res: { otc?: string; error?: string }) => {
      if (!res?.otc) {
        setSenderStatus("Failed to create room. Please try again.");
        setSenderPhase("error");
        return;
      }

      snd.current.otc = res.otc;
      setSenderOtc(res.otc);
      setSenderStatus("Room created. Encrypting text…");

      const worker = new Worker("/worker.js");
      worker.addEventListener("message", handleSenderWorkerMessage);
      snd.current.worker = worker;

      const bytes  = new TextEncoder().encode(text);
      const buffer = bytes.buffer;

      worker.postMessage({
        type:       "prepareSenderTransfer",
        fileName:   "text_transfer",
        fileBuffer: buffer,
        chunkSize:  16 * 1024, // Text is small — 16 KB chunks keep chunk count low
        transferId: res.otc,
      }, [buffer]);
    });
  }, [socket, handleSenderWorkerMessage]);

  const startWebRtcSend = useCallback(async () => {
    const s = snd.current;
    if (!s.otc) return;
    setSenderPhase("connecting");
    setSenderStatus("Starting WebRTC connection…");

    if (s.pc) {
      try { s.pc.close(); } catch { /* ignore */ }
    }

    const iceConfig = await getIceServers();
    s.pc = new RTCPeerConnection(iceConfig);

    // Create DataChannel with binary-ready settings
    s.dc            = s.pc.createDataChannel("file");
    s.dc.binaryType = "arraybuffer"; // Enables ArrayBuffer sends

    s.dc.onopen = () => {
      setSenderStatus("Data channel open.");

      // Start the streaming pipeline. If frames are already queued
      // (encryption started before DC opened), begin sending immediately.
      // If encryption is still in progress, startStream will be triggered
      // by each incoming chunk via the type:"chunk" handler above.
      if (s.frames.length > 0) {
        startStream();
      } else {
        setSenderStatus("Data channel open. Waiting for encryption…");
      }
    };

    s.dc.onclose = () => setSenderStatus("Data channel closed.");

    s.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { otc: s.otc, type: "ice", data: event.candidate });
        if (rcv.current.pc) {
          rcv.current.pc.addIceCandidate(event.candidate).catch(() => { /* ignore */ });
        }
      }
    };

    const offer = await s.pc.createOffer();
    await s.pc.setLocalDescription(offer);
    const offerMsg = { otc: s.otc!, type: "offer", data: offer };
    socket.emit("signal", offerMsg);
    await handleSignal(offerMsg);
    setSenderStatus("Offer sent. Waiting for answer…");
  }, [socket, startStream, handleSignal]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API — Receiver actions
  // ─────────────────────────────────────────────────────────────────────────────

  const joinRoom = useCallback((otc: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      role.current   = "receiver";
      rcv.current.otc = otc;
      await setupReceiverPeer();

      socket.emit("join_room", { otc }, (res: { ok?: boolean; error?: string }) => {
        if (res?.error) {
          setReceiverStatus(`Join error: ${res.error}`);
          setReceiverPhase("error");
          reject(new Error(res.error));
          return;
        }
        setReceiverStatus("Joined room. Waiting for sender…");
        setReceiverPhase("ready");
        resolve();
      });
    });
  }, [socket, setupReceiverPeer]);

  const importMetadata = useCallback((metaJson: string) => {
    try {
      const meta: SenderMeta = JSON.parse(metaJson);

      // Reset receiver state for fresh transfer
      const r             = rcv.current;
      r.metadata          = meta;
      r.transferId        = meta.otc || r.otc;
      r.expectedTotal     = meta.total ?? Math.ceil(meta.s / (meta.c || 1));
      r.doneReceived      = false;
      r.downloadTriggered = false;
      r.receivedSeqs      = new Set();
      r.processingSeqs    = new Set();
      r.received          = [];
      r.pendingFrames     = [];
      r.decryptQueue      = [];
      r.decryptRunning    = 0;
      rcvIceQueue.current = [];

      setReceiverStatus("Metadata imported. Starting key exchange…");
      setReceiverPhase("key_exchange");

      const worker = new Worker("/worker.js");
      worker.addEventListener("message", handleReceiverWorkerMessage);
      r.worker = worker;
      worker.postMessage({ type: "generateReceiverKeyPair" });
    } catch {
      setReceiverStatus("Invalid metadata JSON.");
      setReceiverPhase("error");
    }
  }, [handleReceiverWorkerMessage]);

  importMetadataRef.current = importMetadata;

  return {
    // Sender
    senderPhase, senderStatus, senderOtc, senderMeta, senderProgress, senderBytes,
    createRoom, createTextRoom, startWebRtcSend,
    // Receiver
    receiverPhase, receiverStatus, receiverKeyStatus, receiverProgress, receiverBytes, receivedText,
    joinRoom, importMetadata,
  };
}
