/**
 * useTransfer — unified state machine for both sender and receiver roles.
 *
 * All socket, WebRTC, worker, and storage logic from the POC app.js is
 * faithfully translated here. The local-dispatch pattern is preserved:
 * after every socket.emit() that the other role needs, we also call the
 * corresponding handler directly so same-tab transfers work without a
 * server round-trip.
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SenderMeta {
  f: string;
  s: number;
  c: number;
  h: string;
  total: number;
  otc: string;
  senderPubKey: JsonWebKey;
  transport: string;
  textMode?: boolean; // true when transferring plain text instead of a file
}

export type TransferPhase =
  | "idle"
  | "preparing"      // worker encrypting
  | "ready"          // chunks stored, waiting for receiver
  | "key_exchange"   // ECDH in progress
  | "connecting"     // WebRTC offer/answer
  | "transferring"   // chunks flowing
  | "done"
  | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────


// ─── ICE server config ───────────────────────────────────────────────────────
// Google's free public STUN servers let WebRTC discover each peer's public IP
// so transfers work across different networks (different WiFi, mobile data, etc.).
// STUN covers ~85% of NAT types. TURN (relay) would cover the remaining ~15%
// (symmetric NAT / strict firewalls) but requires a paid relay server.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    }
  ],
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTransfer(socket: Socket) {
  // ── Sender state ──────────────────────────────────────────────────────────
  const [senderPhase, setSenderPhase] = useState<TransferPhase>("idle");
  const [senderStatus, setSenderStatus] = useState("Pick a file to begin.");
  const [senderOtc, setSenderOtc] = useState<string | null>(null);
  const [senderMeta, setSenderMeta] = useState<SenderMeta | null>(null);
  const [senderProgress, setSenderProgress] = useState(0); // 0-100
  const [senderBytes, setSenderBytes]       = useState(0); // bytes sent so far

  // ── Receiver state ────────────────────────────────────────────────────────
  const [receiverPhase, setReceiverPhase] = useState<TransferPhase>("idle");
  const [receiverStatus, setReceiverStatus] = useState("Enter OTC to join a transfer.");
  const [receiverKeyStatus, setReceiverKeyStatus] = useState<"pending"|"generated"|"ready">("pending");
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receivedText, setReceivedText] = useState<string | null>(null);
  const [receiverBytes, setReceiverBytes] = useState(0); // bytes decrypted so far

  // ── Internal refs (not exposed to UI) ─────────────────────────────────────
  const snd = useRef({
    worker: null as Worker | null,
    otc: null as string | null,
    pc: null as RTCPeerConnection | null,
    dc: null as RTCDataChannel | null,
    metadata: null as SenderMeta | null,
    chunks: [] as { seq: number; total: number; data: string; iv: string }[],
    chunksReady: false,
    pendingReceiverPubKey: null as JsonWebKey | null,
    isTextMode: false, // true when sending text instead of a file
  });

  const rcv = useRef({
    worker: null as Worker | null,
    otc: null as string | null,
    pc: null as RTCPeerConnection | null,
    metadata: null as SenderMeta | null,
    transferId: null as string | null,
    expectedTotal: 0,
    keyReady: false,
    pendingEncrypted: [] as { seq: number; total: number; data: string; iv: string }[],
    receivedSeqs: new Set<number>(),
    nackTimer: null as ReturnType<typeof setTimeout> | null,
    doneReceived: false,
  });

  const sndIceQueue = useRef<RTCIceCandidateInit[]>([]);
  const rcvIceQueue = useRef<RTCIceCandidateInit[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Named handlers — called both from socket.on() AND local dispatch
  // ─────────────────────────────────────────────────────────────────────────

  const handleReceiverPub = useCallback((msg: { otc: string; receiverPubKey: JsonWebKey }) => {
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

  const handleWrappedKey = useCallback((msg: { otc: string; senderPubKey: JsonWebKey; wrappedKey: string; iv: string }) => {
    if (!msg) return;
    if (rcv.current.otc && msg.otc === rcv.current.otc && rcv.current.worker) {
      rcv.current.worker.postMessage({
        type: "unwrapFileKey",
        senderPubKey: msg.senderPubKey,
        wrappedKey: msg.wrappedKey,
        iv: msg.iv,
      });
      setReceiverStatus("Wrapped key received. Unwrapping…");
    }
  }, []);

  const handleSignal = useCallback(async (msg: { otc: string; type: string; data: unknown }) => {
    if (!msg || !msg.otc) return;
    // Sender side: receives answer + ICE from receiver
    if (snd.current.otc && msg.otc === snd.current.otc) {
      if (msg.type === "answer" && snd.current.pc) {
        await snd.current.pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
        setSenderStatus("WebRTC handshake complete. Sending…");
        setSenderPhase("transferring");
        // Flush queued ICE candidates
        while (sndIceQueue.current.length > 0) {
          const cand = sndIceQueue.current.shift()!;
          try { await snd.current.pc.addIceCandidate(cand); } catch { }
        }
      } else if (msg.type === "ice" && snd.current.pc) {
        if (snd.current.pc.remoteDescription) {
          try { await snd.current.pc.addIceCandidate(msg.data as RTCIceCandidateInit); } catch { }
        } else {
          sndIceQueue.current.push(msg.data as RTCIceCandidateInit);
        }
      }
    }
    // Receiver side: receives offer + ICE from sender
    if (rcv.current.otc && msg.otc === rcv.current.otc) {
      if (msg.type === "offer" && rcv.current.pc) {
        await rcv.current.pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
        const answer = await rcv.current.pc.createAnswer();
        await rcv.current.pc.setLocalDescription(answer);
        const answerMsg = { otc: rcv.current.otc, type: "answer", data: answer };
        socket.emit("signal", answerMsg);
        await handleSignal(answerMsg); // local dispatch answer back to sender
        setReceiverStatus("Answer sent. Waiting for data…");
        setReceiverPhase("connecting");
        // Flush queued ICE candidates
        while (rcvIceQueue.current.length > 0) {
          const cand = rcvIceQueue.current.shift()!;
          try { await rcv.current.pc.addIceCandidate(cand); } catch { }
        }
      } else if (msg.type === "ice" && rcv.current.pc) {
        if (rcv.current.pc.remoteDescription) {
          try { await rcv.current.pc.addIceCandidate(msg.data as RTCIceCandidateInit); } catch { }
        } else {
          rcvIceQueue.current.push(msg.data as RTCIceCandidateInit);
        }
      }
    }
  }, [socket]);

  // ─────────────────────────────────────────────────────────────────────────
  // NACK / assembly
  // ─────────────────────────────────────────────────────────────────────────

  const assembleDownload = useCallback(async () => {
    const r = rcv.current;
    const parts: Uint8Array[] = [];
    for (let i = 0; i < r.expectedTotal; i++) {
      const chunk = (window as unknown as { _received?: Uint8Array[] })._received?.[i];
      if (chunk) parts.push(chunk);
    }
    if (!parts.length) return;
    const size = parts.reduce((s, p) => s + p.byteLength, 0);
    const buf = new Uint8Array(size);
    let offset = 0;
    for (const p of parts) { buf.set(p, offset); offset += p.byteLength; }

    if (r.metadata?.textMode) {
      // ── Text mode: decode UTF-8 bytes → string, show in UI ──
      const text = new TextDecoder("utf-8").decode(buf);
      setReceivedText(text);
      setReceiverPhase("done");
      setReceiverStatus("Text received.");
      setReceiverProgress(100);
    } else {
      // ── File mode: trigger browser download ──
      const blob = new Blob([buf]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.metadata?.f ?? "received.bin";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setReceiverPhase("done");
      setReceiverStatus("File received. Download started.");
      setReceiverProgress(100);
    }
  }, []);

  const scheduleNackCheck = useCallback((finalCheck = false) => {
    const r = rcv.current;
    if (finalCheck) r.doneReceived = true;
    if (r.nackTimer) clearTimeout(r.nackTimer);
    r.nackTimer = setTimeout(async () => {
      const total = r.expectedTotal || r.metadata?.total || 0;
      if (!total) return;
      const missing: number[] = [];
      for (let i = 0; i < total; i++) {
        if (!r.receivedSeqs.has(i)) missing.push(i);
      }
      if (missing.length) {
        socket.emit("nack", { otc: r.otc, transferId: r.transferId || r.otc, total, missingSeqs: missing });
        setReceiverStatus(`Requesting ${missing.length} missing chunk(s)…`);
        return;
      }
      if (r.doneReceived) {
        await assembleDownload();
      }
    }, 300);
  }, [socket, assembleDownload]);

  // ─────────────────────────────────────────────────────────────────────────
  // Receiver DataChannel message handler
  // ─────────────────────────────────────────────────────────────────────────

  const flushReceiverQueue = useCallback(() => {
    const r = rcv.current;
    if (!r.keyReady || !r.worker) return;
    while (r.pendingEncrypted.length) {
      const obj = r.pendingEncrypted.shift()!;
      r.worker.postMessage({ type: "decryptChunk", seq: obj.seq, dataB64: obj.data, ivB64: obj.iv });
      r.expectedTotal = obj.total || r.expectedTotal;
    }
  }, []);

  const handleDataChannelMessage = useCallback((raw: string) => {
    try {
      const obj = JSON.parse(raw);
      if (obj.done) {
        rcv.current.expectedTotal = obj.total || rcv.current.expectedTotal;
        scheduleNackCheck(true);
        return;
      }
      rcv.current.pendingEncrypted.push(obj);
      flushReceiverQueue();
    } catch (err) {
      console.error(err);
    }
  }, [scheduleNackCheck, flushReceiverQueue]);

  // ─────────────────────────────────────────────────────────────────────────
  // Sender: send all stored chunks
  // ─────────────────────────────────────────────────────────────────────────

  const sendAllChunks = useCallback(async () => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open") return;
    const chunks = s.chunks;
    if (!chunks.length) { setSenderStatus("No chunks to send."); return; }
    const sorted = [...chunks].sort((a, b) => a.seq - b.seq);

    const HIGH_WATER = 256 * 1024; // pause above 256 KB buffered
    const LOW_WATER  =  64 * 1024; // resume below 64 KB buffered

    for (const chunk of sorted) {
      if (!s.dc || s.dc.readyState !== "open") break;

      // Backpressure: wait for the send buffer to drain before continuing
      while (s.dc.bufferedAmount > HIGH_WATER) {
        await new Promise<void>((res) => {
          const check = () => {
            if (!s.dc || s.dc.bufferedAmount <= LOW_WATER) res();
            else setTimeout(check, 10);
          };
          check();
        });
      }

      s.dc.send(JSON.stringify({ seq: chunk.seq, total: sorted.length, data: chunk.data, iv: chunk.iv }));
      const chunkSize = snd.current.metadata?.c ?? 65536;
      setSenderBytes((chunk.seq + 1) * chunkSize);   // approximate; last chunk may be smaller
      setSenderProgress(Math.min(100, Math.round(((chunk.seq + 1) / sorted.length) * 100)));
      setSenderStatus(`Sent chunk ${chunk.seq + 1}/${sorted.length}`);
    }

    if (s.dc?.readyState === "open") {
      s.dc.send(JSON.stringify({ done: true, transferId: s.otc, total: sorted.length }));
    }
    setSenderPhase("done");
    setSenderStatus("All chunks sent.");
  }, []);

  const resendMissingChunks = useCallback(async (missingSeqs: number[]) => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open") return;
    const seqSet = new Set(missingSeqs);
    const toSend = s.chunks.filter((c) => seqSet.has(c.seq));
    const fullTotal = s.chunks.length; // always use the original total, not missing count

    const HIGH_WATER = 256 * 1024;
    const LOW_WATER  =  64 * 1024;

    for (const chunk of toSend.sort((a, b) => a.seq - b.seq)) {
      if (!s.dc || s.dc.readyState !== "open") break;

      while (s.dc.bufferedAmount > HIGH_WATER) {
        await new Promise<void>((res) => {
          const check = () => {
            if (!s.dc || s.dc.bufferedAmount <= LOW_WATER) res();
            else setTimeout(check, 10);
          };
          check();
        });
      }

      s.dc.send(JSON.stringify({ seq: chunk.seq, total: fullTotal, data: chunk.data, iv: chunk.iv, resend: true }));
      setSenderStatus(`Resent chunk ${chunk.seq + 1}`);
    }
    if (s.dc?.readyState === "open") {
      s.dc.send(JSON.stringify({ done: true, transferId: s.otc, resend: true, total: fullTotal }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Sender worker message handler
  // ─────────────────────────────────────────────────────────────────────────

  const handleSenderWorkerMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (!msg?.type) return;

    if (msg.type === "senderMetadata") {
      // Merge isTextMode flag into metadata so the receiver knows how to assemble
      const meta: SenderMeta = { ...msg.metadata, textMode: snd.current.isTextMode };
      snd.current.metadata = meta;
      setSenderMeta(meta);
      setSenderStatus("Metadata ready. Waiting for receiver…");
      setSenderPhase("ready");
      // Relay metadata via signaling server — receiver auto-imports it
      // This means the QR only needs to carry the 6-digit OTC, not the full JSON
      if (snd.current.otc) {
        socket.emit("sender_ready", { otc: snd.current.otc, metadata: meta });
      }
      // Process any pending receiver pub key
      if (snd.current.pendingReceiverPubKey && snd.current.worker) {
        snd.current.worker.postMessage({ type: "wrapFileKey", receiverPubKey: snd.current.pendingReceiverPubKey });
        setSenderStatus("Wrapping AES key via ECDH…");
        setSenderPhase("key_exchange");
        snd.current.pendingReceiverPubKey = null;
      }
    }

    if (msg.type === "chunk") {
      snd.current.chunks.push({ seq: msg.seq, total: msg.total, data: msg.data, iv: msg.iv });
    }

    if (msg.type === "done") {
      snd.current.chunksReady = true;
      setSenderStatus("Chunks ready. Waiting for WebRTC connection…");
      if (snd.current.dc?.readyState === "open") sendAllChunks();
    }

    if (msg.type === "wrappedFileKey") {
      const wkPayload = {
        otc: snd.current.otc!,
        transferId: snd.current.otc!,
        wrappedKey: msg.wrappedKey,
        iv: msg.iv,
        senderPubKey: msg.senderPubKey,
      };
      socket.emit("wrapped_key", wkPayload);
      handleWrappedKey(wkPayload); // local dispatch
      setSenderStatus("AES key wrapped and sent.");
    }
  }, [socket, sendAllChunks, handleWrappedKey]);

  // ─────────────────────────────────────────────────────────────────────────
  // Receiver worker message handler
  // ─────────────────────────────────────────────────────────────────────────

  const handleReceiverWorkerMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (!msg?.type) return;

    if (msg.type === "receiverPubKey") {
      setReceiverKeyStatus("generated");
      if (rcv.current.otc) {
        const rpPayload = {
          otc: rcv.current.otc,
          transferId: rcv.current.transferId || rcv.current.otc,
          receiverPubKey: msg.publicKey,
        };
        socket.emit("receiver_pub", rpPayload);
        handleReceiverPub(rpPayload); // local dispatch
        setReceiverStatus("Public key sent. Waiting for wrapped AES key…");
      }
    }

    if (msg.type === "fileKeyReady") {
      rcv.current.keyReady = true;
      setReceiverKeyStatus("ready");
      setReceiverStatus("Key ready. Waiting for data channel…");
      flushReceiverQueue();
    }

    if (msg.type === "decrypted") {
      const w = window as unknown as { _received?: Uint8Array[] };
      if (!w._received) w._received = [];
      w._received[msg.seq] = new Uint8Array(msg.data);
      rcv.current.receivedSeqs.add(msg.seq);
      setReceiverBytes((b) => b + (msg.data as ArrayBuffer).byteLength);
      const total = rcv.current.expectedTotal || 1;
      const pct = Math.min(100, Math.round((rcv.current.receivedSeqs.size / total) * 100));
      setReceiverProgress(pct);
      setReceiverStatus(`Decrypted chunk ${msg.seq + 1}/${rcv.current.expectedTotal || "?"}`);
      setReceiverPhase("transferring");
      scheduleNackCheck();
    }

    if (msg.type === "decryptError") {
      setReceiverStatus(`Decrypt error on chunk ${msg.seq}: ${msg.message}`);
    }
  }, [socket, handleReceiverPub, flushReceiverQueue, scheduleNackCheck]);

  // ─────────────────────────────────────────────────────────────────────────
  // Setup receiver peer connection
  // ─────────────────────────────────────────────────────────────────────────

  const setupReceiverPeer = useCallback(() => {
    if (rcv.current.pc) {
      try { rcv.current.pc.close(); } catch {}
    }
    rcv.current.pc = new RTCPeerConnection(ICE_SERVERS);
    rcv.current.pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = "arraybuffer";
      dc.onmessage = (ev) => handleDataChannelMessage(ev.data as string);
      dc.onopen = () => {
        setReceiverStatus("Data channel open. Receiving chunks…");
        setReceiverPhase("transferring");
      };
    };
    rcv.current.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { otc: rcv.current.otc, type: "ice", data: event.candidate });
        if (snd.current.pc) snd.current.pc.addIceCandidate(event.candidate).catch(() => {});
      }
    };
  }, [socket, handleDataChannelMessage]);

  // ─────────────────────────────────────────────────────────────────────────
  // Socket event wiring
  // ─────────────────────────────────────────────────────────────────────────

  // Use a ref so the socket useEffect can call importMetadata without it
  // being a dependency (importMetadata is declared later in the file).
  const importMetadataRef = useRef<(json: string) => void>(() => {});

  useEffect(() => {
    socket.on("signal", (msg) => handleSignal(msg).catch(console.error));
    socket.on("receiver_pub", handleReceiverPub);
    socket.on("wrapped_key", handleWrappedKey);
    socket.on("nack", async (msg) => {
      if (!msg?.otc || msg.otc !== snd.current.otc) return;
      if (Array.isArray(msg.missingSeqs) && msg.missingSeqs.length) {
        await resendMissingChunks(msg.missingSeqs);
      }
    });
    // Auto-import metadata relayed by the server — no manual JSON paste needed
    socket.on("metadata_relay", ({ metadata }) => {
      if (metadata && rcv.current.otc) {
        importMetadataRef.current(JSON.stringify(metadata));
      }
    });

    return () => {
      socket.off("signal");
      socket.off("receiver_pub");
      socket.off("wrapped_key");
      socket.off("nack");
      socket.off("metadata_relay");
    };
  }, [socket, handleSignal, handleReceiverPub, handleWrappedKey, resendMissingChunks]);

  // ─────────────────────────────────────────────────────────────────────────
  // Public API — Sender actions
  // ─────────────────────────────────────────────────────────────────────────

  const createRoom = useCallback(async (file: File) => {
    setSenderPhase("preparing");
    setSenderStatus("Creating room…");
    snd.current.chunks = [];
    snd.current.chunksReady = false;
    snd.current.metadata = null;
    snd.current.isTextMode = false;
    sndIceQueue.current = [];

    socket.emit("create_room", (res: { otc: string }) => {
      snd.current.otc = res.otc;
      setSenderOtc(res.otc);
      setSenderStatus("Room created. Encrypting file…");

      const worker = new Worker("/worker.js");
      worker.addEventListener("message", handleSenderWorkerMessage);
      snd.current.worker = worker;

      file.arrayBuffer().then((buffer) => {
        worker.postMessage({
          type: "prepareSenderTransfer",
          fileName: file.name,
          fileBuffer: buffer,
          chunkSize: file.size >= 5 * 1024 * 1024 ? 64 * 1024 : 1024,
          transferId: res.otc,
        });
      });
    });
  }, [socket, handleSenderWorkerMessage]);

  // Text transfer — same pipeline as file, but encodes text to UTF-8 bytes
  const createTextRoom = useCallback(async (text: string) => {
    setSenderPhase("preparing");
    setSenderStatus("Creating room…");
    snd.current.chunks = [];
    snd.current.chunksReady = false;
    snd.current.metadata = null;
    snd.current.isTextMode = true; // flag so metadata carries textMode: true
    sndIceQueue.current = [];

    socket.emit("create_room", (res: { otc: string }) => {
      snd.current.otc = res.otc;
      setSenderOtc(res.otc);
      setSenderStatus("Room created. Encrypting text…");

      const worker = new Worker("/worker.js");
      worker.addEventListener("message", handleSenderWorkerMessage);
      snd.current.worker = worker;

      // UTF-8 encode the text to bytes, then treat it like a file buffer
      const bytes   = new TextEncoder().encode(text);
      const buffer  = bytes.buffer;
      // Use 16 KB chunks for text (good balance of overhead vs chunk count)
      const chunkSz = 16 * 1024;

      worker.postMessage({
        type: "prepareSenderTransfer",
        fileName: "text_transfer",
        fileBuffer: buffer,
        chunkSize: chunkSz,
        transferId: res.otc,
      }, [buffer]); // transfer ownership for zero-copy
    });
  }, [socket, handleSenderWorkerMessage]);

  const startWebRtcSend = useCallback(async () => {
    const s = snd.current;
    if (!s.otc) return;
    setSenderPhase("connecting");
    setSenderStatus("Starting WebRTC connection…");

    if (s.pc) {
      try { s.pc.close(); } catch {}
    }
    s.pc = new RTCPeerConnection(ICE_SERVERS);
    s.dc = s.pc.createDataChannel("file");
    s.dc.binaryType = "arraybuffer";

    s.dc.onopen = () => {
      setSenderStatus("Data channel open.");
      if (s.chunksReady) sendAllChunks();
      else setSenderStatus("Data channel open. Waiting for encryption…");
    };
    s.dc.onclose = () => setSenderStatus("Data channel closed.");

    s.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { otc: s.otc, type: "ice", data: event.candidate });
        if (rcv.current.pc) rcv.current.pc.addIceCandidate(event.candidate).catch(() => {});
      }
    };

    const offer = await s.pc.createOffer();
    await s.pc.setLocalDescription(offer);
    const offerMsg = { otc: s.otc!, type: "offer", data: offer };
    socket.emit("signal", offerMsg);
    await handleSignal(offerMsg); // local dispatch
    setSenderStatus("Offer sent. Waiting for answer…");
  }, [socket, sendAllChunks, handleSignal]);

  // ─────────────────────────────────────────────────────────────────────────
  // Public API — Receiver actions
  // ─────────────────────────────────────────────────────────────────────────

  const joinRoom = useCallback((otc: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      rcv.current.otc = otc;
      setupReceiverPeer();
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
      rcv.current.metadata = meta;
      rcv.current.transferId = meta.otc || rcv.current.otc;
      rcv.current.expectedTotal = meta.total ?? Math.ceil(meta.s / (meta.c || 1024));
      rcv.current.doneReceived = false;
      rcv.current.receivedSeqs = new Set();
      rcvIceQueue.current = [];
      (window as unknown as { _received?: unknown[] })._received = [];

      setReceiverStatus("Metadata imported. Starting key exchange…");
      setReceiverPhase("key_exchange");

      const worker = new Worker("/worker.js");
      worker.addEventListener("message", handleReceiverWorkerMessage);
      rcv.current.worker = worker;
      worker.postMessage({ type: "generateReceiverKeyPair" });
    } catch {
      setReceiverStatus("Invalid metadata JSON.");
      setReceiverPhase("error");
    }
  }, [handleReceiverWorkerMessage]);
  // Keep ref in sync so the socket useEffect (mounted once) always calls the latest version
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
