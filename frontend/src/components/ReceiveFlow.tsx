"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { 
  Key, Loader2, CheckCircle2, Camera, CameraOff, Copy, Check, 
  Shield, Activity, HardDrive, X, ArrowRight, Laptop, Smartphone,
  Download, RefreshCw, Sparkles, AlertCircle
} from "lucide-react";
import jsQR from "jsqr";
import confetti from "canvas-confetti";
import { TransferPhase } from "@/hooks/useTransfer";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedCopyIcon } from "@/components/ui/AnimatedCopyIcon";

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
  initialCode?: string;
}

export function ReceiveFlow({
  phase,
  status,
  keyStatus,
  progress,
  receivedText,
  onJoin,
  bytesTransferred = 0,
  initialCode = ""
}: Props) {
  const speedBps = useTransferSpeed(bytesTransferred);
  const [otc, setOtc]         = useState(initialCode);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied]   = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const scanningRef = useRef(false);

  const [scanning,    setScanning]    = useState(false);
  const [videoReady,  setVideoReady]  = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  useEffect(() => {
    if (phase === "error") {
      setShowErrorPopup(true);
    } else {
      setShowErrorPopup(false);
    }
  }, [phase]);

  // Confetti on done
  useEffect(() => {
    if (phase === "done") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#8b5cf6", "#3b82f6"]
      });
    }
  }, [phase]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setVideoReady(false);
  }, []);

  useEffect(() => () => {
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleJoin = useCallback(async (code: string) => {
    if (!code || joining) return;
    setJoining(true);
    stopCamera();
    try {
      await onJoin(code);
    } catch {
      setJoining(false);
      setShowErrorPopup(true);
    }
  }, [joining, onJoin, stopCamera]);

  // Auto-connect if initialCode passed via URL query param
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      handleJoin(initialCode);
    }
  }, [initialCode, handleJoin]);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
    } catch (err: unknown) {
      setCameraError(err instanceof Error ? err.message : "Camera access denied");
    }
  }, []);

  const tick = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      if (!videoReady) setVideoReady(true);
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
        if (code && code.data) {
          let resolvedCode = code.data.trim();
          // Support scanning full URL: https://share2me.in/p2p?mode=receive&code=ABC123
          if (resolvedCode.includes("code=")) {
            const match = resolvedCode.match(/code=([A-Z0-9]{6})/i);
            if (match) resolvedCode = match[1];
          }
          if (resolvedCode.length === 6) {
            scanningRef.current = false;
            setScanSuccess(true);
            setOtc(resolvedCode.toUpperCase());
            handleJoin(resolvedCode.toUpperCase());
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [videoReady, handleJoin]);

  const startTick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const copyText = useCallback(() => {
    if (!receivedText) return;
    navigator.clipboard.writeText(receivedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [receivedText]);

  const isIdle         = phase === "idle" || phase === "error";
  const isTransferring = phase === "transferring";
  const isDone         = phase === "done";
  const isConnecting   = !isIdle && !isTransferring && !isDone;

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* ── STATE 1: IDLE / PIN INPUT & QR SCANNER ── */}
      {isIdle && (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
          
          <div className="text-center mb-1">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-indigo-600 shadow-inner">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold font-display text-gray-900">
              Receive Direct Transfer
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Enter the 6-digit share code or scan the QR code from the sender device.
            </p>
          </div>

          {/* 6-Digit PIN Input Card */}
          <div className="bg-gradient-to-br from-[#F7F8FA] to-white border border-gray-200/90 rounded-[28px] p-6 sm:p-8 shadow-sm flex flex-col gap-4">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block text-center">
              Enter 6-Digit Code
            </label>

            <div className="relative w-full max-w-xs mx-auto">
              <input
                type="text"
                maxLength={6}
                value={otc}
                onChange={(e) => {
                  const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  setOtc(cleaned);
                  if (cleaned.length === 6 && !joining) {
                    handleJoin(cleaned);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && otc.length === 6 && !joining) {
                    handleJoin(otc);
                  }
                }}
                placeholder="• • • • • •"
                className="w-full bg-white border-2 border-gray-200 focus:border-black rounded-2xl py-3.5 px-4 text-center font-mono text-3xl font-extrabold tracking-[0.3em] text-gray-900 focus:outline-none transition-all placeholder:text-gray-300 placeholder:tracking-widest uppercase shadow-sm"
              />
            </div>

            <button
              disabled={otc.length !== 6 || joining}
              onClick={() => handleJoin(otc)}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                otc.length !== 6 || joining
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  : "bg-[#111827] hover:bg-black text-white shadow-md hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>{joining ? "Linking Devices…" : "Connect & Receive"}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full my-1">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">or scan with camera</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* QR Camera Scanner Section */}
          <div className="bg-white border border-gray-200/90 rounded-[28px] overflow-hidden shadow-sm flex flex-col items-center">
            {!scanning && !scanSuccess ? (
              <button
                onClick={startScan}
                className="w-full py-6 px-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-gray-800">
                  Scan Sender's QR Code
                </span>
                <span className="text-xs text-gray-400">
                  Instant pairing via webcam or phone camera
                </span>
              </button>
            ) : null}

            {/* Live Camera Viewport */}
            <div className={`relative bg-black w-full overflow-hidden transition-all duration-300 ${scanning || scanSuccess ? "h-[320px]" : "h-0"}`}>
              <video
                ref={videoRef}
                muted
                playsInline
                onCanPlay={startTick}
                className={`w-full h-full object-cover ${scanning && videoReady ? "block" : "hidden"}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {scanSuccess ? (
                <div className="absolute inset-0 bg-emerald-50 flex flex-col items-center justify-center p-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2 text-emerald-600 shadow-inner">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <p className="text-emerald-700 font-bold text-sm">QR Code Verified!</p>
                  <p className="text-xs text-emerald-600 mt-1">Connecting to sender…</p>
                </div>
              ) : scanning && !videoReady ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  <p className="text-xs text-gray-300">Initializing camera sensor…</p>
                </div>
              ) : scanning && videoReady ? (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Modern Reticle */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-56 h-56 rounded-3xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] relative">
                      <div className="absolute inset-0 rounded-3xl border-2 border-white/40" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 pointer-events-auto">
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 rounded-xl bg-white/90 hover:bg-white text-xs font-bold text-black border border-white/40 transition-colors shadow-md"
                    >
                      Cancel Scanner
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {cameraError && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold w-full text-center border-t border-red-100">
                {cameraError}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── STATE 2: LINKING & ENCRYPTING ── */}
      {isConnecting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full flex flex-col items-center justify-center py-10 text-center gap-4"
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-inner">
              <Key className="w-6 h-6" />
            </div>
          </div>

          <div>
            <h4 className="text-base font-bold text-gray-900">
              Establishing Direct Encrypted Link
            </h4>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              {status || "Exchanging one-time cryptographic keys directly with sender…"}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
            <span>Room PIN: {otc}</span>
          </div>
        </motion.div>
      )}

      {/* ── STATE 3: ACTIVE TRANSFERRING (CIRCULAR PROGRESS RING) ── */}
      {isTransferring && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full flex flex-col items-center justify-center py-6 sm:py-8 text-center"
        >
          {/* Connected devices pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/[0.04] border border-black/[0.06] text-xs font-semibold text-gray-700 mb-8">
            <Laptop className="w-3.5 h-3.5 text-gray-600" />
            <span>Sender</span>
            <span className="text-gray-400">→</span>
            <Smartphone className="w-3.5 h-3.5 text-gray-600" />
            <span>Your Device</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] ml-1" />
          </div>

          {/* Fluid Circular Wave Progress Ring */}
          <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center mb-6">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="42%"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                className="text-gray-100"
              />
              <circle
                cx="50%"
                cy="50%"
                r="42%"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * progress) / 100}
                className="text-emerald-600 transition-all duration-300 ease-out"
                strokeLinecap="round"
              />
            </svg>

            <div className="flex flex-col items-center justify-center z-10">
              <span className="text-4xl sm:text-5xl font-mono font-black text-gray-900 tracking-tight">
                {progress}%
              </span>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mt-1 animate-pulse">
                Receiving
              </span>
            </div>
          </div>

          {/* Transfer Info & Speed */}
          <div className="flex flex-col items-center gap-2 max-w-sm">
            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              <span>{formatBytes(bytesTransferred)} received</span>
              <span>•</span>
              <span className="text-emerald-600 font-bold">
                {speedBps > 0 ? formatSpeed(speedBps) : "--"}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── STATE 4: TRANSFER COMPLETE ── */}
      {isDone && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full flex flex-col items-center justify-center py-8 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-2xl font-bold font-display text-gray-900">
            Transfer Complete!
          </h3>

          <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-sm">
            {formatBytes(bytesTransferred)} safely received directly to your browser memory.
          </p>

          {/* If text payload was transferred */}
          {receivedText && (
            <div className="w-full max-w-md mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Decrypted Note
                </span>
                <button
                  onClick={copyText}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:text-black shadow-sm"
                >
                  <AnimatedCopyIcon copied={copied} className="w-3 h-3" />
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {receivedText}
              </pre>
            </div>
          )}

          <button
            onClick={() => {
              setOtc("");
              window.location.reload();
            }}
            className="mt-8 px-6 py-3 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Receive Another File</span>
          </button>
        </motion.div>
      )}

      {/* Error Popup */}
      <AnimatePresence>
        {showErrorPopup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[100] bg-white border border-rose-200 shadow-2xl rounded-2xl p-5 flex flex-col gap-3 w-full max-w-[320px]"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Transfer Connection Error</h4>
                <p className="text-xs text-gray-500 mt-0.5">{status || "Invalid code or connection timed out."}</p>
              </div>
            </div>
            <button
              onClick={() => setShowErrorPopup(false)}
              className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
