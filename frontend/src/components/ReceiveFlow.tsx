"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Key, Loader2, CheckCircle2, Camera, CameraOff, Copy, Check } from "lucide-react";
import jsQR from "jsqr";
import { TransferPhase } from "@/hooks/useTransfer";

/** Rolling 3-second window speed calculator */
function useTransferSpeed(bytesTransferred: number) {
  const history = useRef<{ bytes: number; ts: number }[]>([]);
  const [speedBps, setSpeedBps] = useState(0);
  useEffect(() => {
    const now = Date.now();
    history.current.push({ bytes: bytesTransferred, ts: now });
    const cutoff = now - 3000;
    history.current = history.current.filter((h) => h.ts >= cutoff);
    if (history.current.length >= 2) {
      const oldest = history.current[0];
      const newest = history.current[history.current.length - 1];
      const dt = (newest.ts - oldest.ts) / 1000;
      const db = newest.bytes - oldest.bytes;
      if (dt > 0) setSpeedBps(db / dt);
    }
  }, [bytesTransferred]);
  return speedBps;
}

function formatSpeed(bps: number): string {
  if (bps >= 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps >= 1024)        return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  phase: TransferPhase;
  status: string;
  keyStatus: "pending" | "generated" | "ready";
  progress: number;
  receivedText: string | null;
  onJoin: (otc: string) => Promise<void>;
  bytesTransferred?: number;
}

const KEY_STATUS_STYLES = {
  pending:   "text-muted",
  generated: "text-primary",
  ready:     "text-trading-up",
};

const KEY_STATUS_LABELS = {
  pending:   "Key: pending",
  generated: "Key: generated",
  ready:     "Key: ready ✓",
};

export function ReceiveFlow({ phase, status, keyStatus, progress, receivedText, onJoin, bytesTransferred = 0 }: Props) {
  const speedBps = useTransferSpeed(bytesTransferred);
  const [otc, setOtc]         = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied]   = useState(false);

  // ── QR scanner ───────────────────────────────────────────────────────────
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const scanningRef = useRef(false); // stable ref inside RAF

  const [scanning,    setScanning]    = useState(false);
  const [videoReady,  setVideoReady]  = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setVideoReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startScan = useCallback(async () => {
    setCameraError(null);
    setScanSuccess(false);
    setVideoReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      scanningRef.current = true;
      setScanning(true);
      // video element is always in DOM (just hidden) so videoRef is always available
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(
        msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")
          ? "Camera permission denied. Please allow camera access and try again."
          : "Could not start camera. Enter the 6-digit code manually instead."
      );
      setScanning(false);
    }
  }, []);

  // Started from onCanPlay on the <video> element — guarantees real pixels
  const startTick = useCallback(() => {
    setVideoReady(true);
    const tick = () => {
      if (!scanningRef.current) return;
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

      const canvas = canvasRef.current;
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code?.data) {
        const scanned = code.data.trim();
        stopCamera();
        setScanSuccess(true);
        if (/^\d{6}$/.test(scanned)) {
          // QR encodes 6-digit OTC → auto-join the room
          setOtc(scanned);
          onJoin(scanned).catch(console.error);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onJoin, stopCamera]);

  // ── Manual join ──────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!otc.trim()) return;
    setJoining(true);
    try { await onJoin(otc.trim()); } finally { setJoining(false); }
  };

  const isIdle     = phase === "idle";
  const isReady    = phase === "ready";
  const isExchange = phase === "key_exchange";
  const isTransfer = phase === "transferring";
  const isDone     = phase === "done";

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── OTC input ── */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          One-Time Code
        </label>
        <div className="flex flex-col xs:flex-row gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={otc}
            onChange={(e) => setOtc(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="flex-1 bg-surface-cardDark border border-hairline-dark rounded-lg
                       px-4 py-3 text-white font-mono text-xl tracking-[0.25em] placeholder:text-muted
                       focus:outline-none focus:border-primary transition-colors"
          />
          <button
            disabled={otc.length !== 6 || joining || !isIdle}
            onClick={handleJoin}
            className="w-full xs:w-auto bg-primary text-ink font-semibold text-sm px-6 py-3 rounded-md
                       hover:bg-primary-active transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Join Room
          </button>
        </div>
      </div>

      {/* ── QR scanner (idle only — scan sender's QR to auto-join) ── */}
      {isIdle && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark overflow-hidden">
          {/* Always-mounted video so videoRef is always in DOM */}
          <video
            ref={videoRef}
            muted
            playsInline
            onCanPlay={startTick}
            className={`w-full object-cover rounded-t-xl ${scanning && videoReady ? "block" : "hidden"}`}
            style={{ maxHeight: 260 }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {scanSuccess ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-trading-up/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-trading-up" />
              </div>
              <p className="text-trading-up font-semibold text-sm">QR scanned — joining room…</p>
            </div>
          ) : scanning ? (
            /* Live camera view */
            <div className="relative" style={{ minHeight: videoReady ? 0 : 180 }}>
              {!videoReady && (
                <div className="flex items-center justify-center py-16 gap-2 text-muted text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Starting camera…
                </div>
              )}
              {/* Scanning reticle */}
              {videoReady && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 rounded-2xl border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                    <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                    <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                    <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-xl" />
                  </div>
                </div>
              )}
              {/* Controls */}
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white
                             text-xs font-semibold px-3 py-2 rounded-lg backdrop-blur-sm transition-colors"
                >
                  <CameraOff className="w-3.5 h-3.5" /> Stop
                </button>
              </div>
              <div className="absolute bottom-3 left-3">
                <span className="flex items-center gap-1.5 bg-black/60 text-primary text-xs font-semibold px-3 py-2 rounded-lg backdrop-blur-sm">
                  <Loader2 className="w-3 h-3 animate-spin" /> Scanning…
                </span>
              </div>
            </div>
          ) : (
            /* Idle prompt */
            <div className="flex flex-col items-center justify-center gap-4 py-10 px-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-sm mb-1">Scan sender&apos;s QR code</p>
                <p className="text-muted text-xs">
                  Point your camera at the QR on the sender&apos;s screen to auto-join the room.
                </p>
              </div>
              {cameraError && (
                <p className="text-trading-down text-xs text-center bg-trading-down/10 rounded-lg px-4 py-2">
                  {cameraError}
                </p>
              )}
              <button
                onClick={startScan}
                className="bg-primary text-ink font-semibold text-sm px-8 py-3 rounded-md
                           hover:bg-primary-active transition-colors flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Open Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Key status badge ── */}
      {phase !== "idle" && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Key className={`w-4 h-4 ${KEY_STATUS_STYLES[keyStatus]}`} />
          <span className={`text-sm font-semibold ${KEY_STATUS_STYLES[keyStatus]}`}>
            {KEY_STATUS_LABELS[keyStatus]}
          </span>
          {isExchange && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin ml-1" />}
        </div>
      )}

      {/* ── Waiting for sender (after joining, before metadata arrives) ── */}
      {isReady && (
        <div className="bg-surface-cardDark border border-primary/20 rounded-xl p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            <span className="text-white font-semibold text-sm">Waiting for sender…</span>
          </div>
          <p className="text-muted text-xs leading-relaxed">
            Connected to room. Encryption keys will sync automatically once the sender is ready.
            No manual steps needed.
          </p>
        </div>
      )}

      {/* ── Progress ── */}
      {(isTransfer || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span className="text-white text-sm font-semibold">
                {receivedText !== null ? "Receiving Text" : "Receiving File"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isTransfer && speedBps > 0 && (
                <span className="text-xs font-mono font-semibold text-trading-up bg-trading-up/10 px-2 py-0.5 rounded-md">
                  ↓ {formatSpeed(speedBps)}
                </span>
              )}
              <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div
              className="h-full bg-trading-up rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-muted text-xs">{formatBytes(bytesTransferred)} received</span>
            {isDone && !receivedText && (
              <span className="text-trading-up text-xs font-semibold">File received — download started</span>
            )}
          </div>
        </div>
      )}

      {/* ── Received text result ── */}
      {receivedText !== null && isDone && (
        <div className="bg-surface-cardDark rounded-xl border border-trading-up/30 p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-trading-up" />
              <span className="text-trading-up text-sm font-semibold">Text received</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted text-xs">{receivedText.length.toLocaleString()} chars</span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(receivedText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                            border transition-all duration-200
                            ${copied
                  ? "text-trading-up border-trading-up/40 bg-trading-up/10"
                  : "text-primary border-primary/30 bg-primary/10 hover:bg-primary/20"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy All"}
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={receivedText}
            rows={10}
            className="w-full bg-surface-elevatedDark border border-hairline-dark rounded-xl
                       px-4 py-3 text-white text-sm font-mono resize-y leading-relaxed
                       focus:outline-none focus:border-primary/30 transition-colors
                       scrollbar-hide"
          />
          <p className="text-muted text-xs mt-2">
            Text decoded from UTF-8 · formatting preserved · AES-GCM-256 decrypted
          </p>
        </div>
      )}

      {/* ── Status bar ── */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
