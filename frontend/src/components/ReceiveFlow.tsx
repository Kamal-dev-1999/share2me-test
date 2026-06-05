"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Key, Loader2, CheckCircle2, Camera, CameraOff, ClipboardPaste } from "lucide-react";
import jsQR from "jsqr";
import { TransferPhase } from "@/hooks/useTransfer";

interface Props {
  phase: TransferPhase;
  status: string;
  keyStatus: "pending" | "generated" | "ready";
  progress: number;
  onJoin: (otc: string) => Promise<void>;
  onImport: (json: string) => void;
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

type MetaInputMode = "scan" | "paste";

export function ReceiveFlow({ phase, status, keyStatus, progress, onJoin, onImport }: Props) {
  const [otc, setOtc]           = useState("");
  const [metaJson, setMetaJson] = useState("");
  const [joining, setJoining]   = useState(false);
  const [metaMode, setMetaMode] = useState<MetaInputMode>("scan");

  // QR scanner state
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const [scanning,    setScanning]    = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const startScan = useCallback(async () => {
    setCameraError(null);
    setScanSuccess(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);

      // Wait for video element to be in DOM after state update
      await new Promise<void>((res) => setTimeout(res, 100));
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const tick = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        if (video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

        const canvas = canvasRef.current;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(video, 0, 0);

        // jsQR — pure JS, works in every browser
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code?.data) {
          stopCamera();
          setScanSuccess(true);
          onImport(code.data);
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(
        msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")
          ? "Camera permission denied. Please allow camera access and try again."
          : "Could not start camera. Try pasting the metadata manually."
      );
      setScanning(false);
    }
  }, [onImport, stopCamera]);

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

  const showMeta = isReady || isExchange || isTransfer || isDone;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* OTC input */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          One-Time Code
        </label>
        {/* OTC input — stacks on very narrow screens */}
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

      {/* Key status badge */}
      {phase !== "idle" && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Key className={`w-4 h-4 ${KEY_STATUS_STYLES[keyStatus]}`} />
          <span className={`text-sm font-semibold ${KEY_STATUS_STYLES[keyStatus]}`}>
            {KEY_STATUS_LABELS[keyStatus]}
          </span>
          {isExchange && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin ml-1" />}
        </div>
      )}

      {/* Metadata input — QR scan or manual paste */}
      {showMeta && (
        <div className="animate-fade-in">
          {/* Label + toggle — stack on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Sender Metadata
            </label>
            {/* Toggle between scan and paste */}
            <div className="flex items-center gap-1 bg-surface-cardDark border border-hairline-dark rounded-lg p-1">
              <button
                onClick={() => { setMetaMode("scan"); setCameraError(null); }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors
                  ${metaMode === "scan" ? "bg-primary text-ink" : "text-muted hover:text-white"}`}
              >
                <Camera className="w-3.5 h-3.5" />
                Scan QR
              </button>
              <button
                onClick={() => { setMetaMode("paste"); stopCamera(); }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors
                  ${metaMode === "paste" ? "bg-primary text-ink" : "text-muted hover:text-white"}`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Paste JSON
              </button>
            </div>
          </div>

          {/* ── SCAN MODE ── */}
          {metaMode === "scan" && (
            <div className="bg-surface-cardDark rounded-xl border border-hairline-dark overflow-hidden">
              {scanSuccess ? (
                /* Success state */
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <div className="w-14 h-14 rounded-full bg-trading-up/10 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-trading-up" />
                  </div>
                  <p className="text-trading-up font-semibold text-sm">QR scanned — metadata imported!</p>
                </div>
              ) : scanning ? (
                /* Camera live view */
                <div className="relative">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="w-full rounded-t-xl object-cover"
                    style={{ maxHeight: 260 }}
                  />
                  {/* Scanning reticle overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 rounded-2xl border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                      {/* Corner accents */}
                      <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                      <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                      <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                      <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-xl" />
                    </div>
                  </div>
                  {/* Stop button */}
                  <div className="absolute bottom-3 right-3">
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white
                                 text-xs font-semibold px-3 py-2 rounded-lg backdrop-blur-sm transition-colors"
                    >
                      <CameraOff className="w-3.5 h-3.5" /> Stop
                    </button>
                  </div>
                  {/* Scanning label */}
                  <div className="absolute bottom-3 left-3">
                    <span className="flex items-center gap-1.5 bg-black/60 text-primary text-xs font-semibold px-3 py-2 rounded-lg backdrop-blur-sm">
                      <Loader2 className="w-3 h-3 animate-spin" /> Scanning…
                    </span>
                  </div>
                </div>
              ) : (
                /* Idle / start prompt */
                <div className="flex flex-col items-center justify-center gap-4 py-10 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm mb-1">Scan the sender&apos;s QR code</p>
                    <p className="text-muted text-xs">
                      Point your camera at the QR on the sender&apos;s screen to auto-import file metadata.
                      No copy-pasting needed.
                    </p>
                  </div>
                  {cameraError && (
                    <p className="text-trading-down text-xs text-center bg-trading-down/10 rounded-lg px-4 py-2">
                      {cameraError}
                    </p>
                  )}
                  <button
                    disabled={isTransfer || isDone}
                    onClick={startScan}
                    className="bg-primary text-ink font-semibold text-sm px-8 py-3 rounded-md
                               hover:bg-primary-active transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed
                               flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Start Camera
                  </button>
                </div>
              )}
              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* ── PASTE MODE ── */}
          {metaMode === "paste" && (
            <div>
              <textarea
                value={metaJson}
                onChange={(e) => setMetaJson(e.target.value)}
                placeholder="Paste the sender metadata JSON here…"
                rows={5}
                className="w-full bg-surface-cardDark border border-hairline-dark rounded-lg
                           px-4 py-3 text-white text-xs font-mono resize-none
                           focus:outline-none focus:border-primary transition-colors
                           placeholder:text-muted"
              />
              <button
                disabled={!metaJson.trim() || isTransfer || isDone}
                onClick={() => onImport(metaJson)}
                className="mt-3 w-full bg-surface-elevatedDark text-white font-semibold text-sm px-6 py-3 rounded-md
                           border border-hairline-dark hover:border-primary/50 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4 text-primary" />
                Import Metadata &amp; Start Key Exchange
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {(isTransfer || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span className="text-white text-sm font-semibold">Receiving File</span>
            </div>
            <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div
              className="h-full bg-trading-up rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isDone && (
            <div className="flex items-center gap-2 mt-3">
              <CheckCircle2 className="w-4 h-4 text-trading-up" />
              <span className="text-trading-up text-sm font-semibold">File received — download started</span>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
