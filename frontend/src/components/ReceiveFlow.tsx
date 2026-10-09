"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { 
  Key, Loader2, CheckCircle2, Camera, X, ArrowRight, Laptop, Smartphone,
  Download, RefreshCw, AlertCircle, QrCode, KeyRound
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

function getFriendlyErrorMessage(status: string | null | undefined, code: string) {
  if (!status) {
    return code 
      ? `Could not connect with code "${code}". Please verify the code and try again.` 
      : "Transfer connection timed out or code was invalid.";
  }
  const s = status.toLowerCase();
  if (s.includes("not_found")) {
    return `Transfer code "${code || "entered"}" was not found or has expired. The sender device may have closed their transfer window, or the code was mistyped.`;
  }
  if (s.includes("timeout")) {
    return "Connection timed out while waiting for the sender device. Please ensure both devices have an active internet connection.";
  }
  if (s.includes("socket not connected")) {
    return "Signaling network disconnected. Please wait a moment and try again.";
  }
  if (s.includes("rejected") || s.includes("denied")) {
    return "The transfer request was declined by the sender device.";
  }
  if (s.includes("closed") || s.includes("disconnect")) {
    return "The sender device disconnected or closed the session.";
  }
  return status.replace(/^Join error:\s*/i, "");
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

  const pinInputRef = useRef<HTMLInputElement>(null);
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
      setJoining(false);
    } else {
      setShowErrorPopup(false);
    }
  }, [phase]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showErrorPopup) {
        setShowErrorPopup(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showErrorPopup]);

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

  const handleInputChange = (rawVal: string) => {
    let cleaned = rawVal.trim().toUpperCase();
    if (cleaned.includes("CODE=")) {
      const match = cleaned.match(/CODE=([A-Z0-9]{6})/i);
      if (match) cleaned = match[1];
    }
    cleaned = cleaned.replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setOtc(cleaned);
    if (cleaned.length === 6 && !joining) {
      handleJoin(cleaned);
    }
  };

  const isIdle         = phase === "idle" || phase === "error";
  const isTransferring = phase === "transferring";
  const isDone         = phase === "done";
  const isConnecting   = !isIdle && !isTransferring && !isDone;

  const digits = Array.from({ length: 6 }, (_, i) => otc[i] || "");

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* ── STATE 1: IDLE / PIN INPUT & QR SCANNER (2-COLUMN BALANCED BENTO) ── */}
      {isIdle && (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
          
          {/* Header Title */}
          <div className="text-center mb-1">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-indigo-600 shadow-inner">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold font-display text-gray-900 tracking-tight">
              Receive Direct Transfer
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Enter the 6-digit share code or scan the QR code from the sender device.
            </p>
          </div>

          {/* 2-Column Responsive Bento Layout (Eliminating whitespace voids) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-stretch w-full">
            
            {/* ── COLUMN 1: 6-DIGIT PIN INPUT CARD ── */}
            <div className="bg-gradient-to-b from-[#F9FAFC] to-white border border-gray-200/90 rounded-[28px] p-6 sm:p-7 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden group">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100/90 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
                    <KeyRound className="w-3 h-3 text-indigo-600" /> Method 1 • Enter PIN
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-gray-400">
                    {otc.length}/6
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-gray-900">
                    6-Digit Share Code
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Click below and type or paste the code
                  </p>
                </div>

                {/* Segmented Digit Input View */}
                <div 
                  onClick={() => pinInputRef.current?.focus()}
                  className="relative cursor-text flex items-center justify-center gap-2 sm:gap-2.5 my-2"
                >
                  <input
                    ref={pinInputRef}
                    type="text"
                    maxLength={6}
                    value={otc}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && otc.length === 6 && !joining) {
                        handleJoin(otc);
                      }
                    }}
                    autoFocus
                    autoComplete="one-time-code"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-text pointer-events-auto"
                    aria-label="Enter 6-digit transfer code"
                  />

                  {digits.map((digit, idx) => {
                    const isCurrent = otc.length === idx;
                    const isFilled = digit !== "";
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-13 sm:w-11 sm:h-14 md:w-12 md:h-15 rounded-2xl border-2 flex items-center justify-center font-mono text-2xl sm:text-3xl font-black transition-all duration-150 select-none ${
                          isCurrent
                            ? "border-black bg-white shadow-md ring-4 ring-black/5 scale-105"
                            : isFilled
                            ? "border-gray-900/40 bg-white text-gray-900 shadow-sm"
                            : "border-gray-200 bg-gray-50/70 text-gray-300"
                        }`}
                      >
                        {digit ? (
                          digit
                        ) : isCurrent ? (
                          <span className="w-0.5 h-6 bg-gray-800 animate-pulse rounded-full" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col gap-2">
                <button
                  disabled={otc.length !== 6 || joining}
                  onClick={() => handleJoin(otc)}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                    otc.length !== 6 || joining
                      ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                      : "bg-[#111827] hover:bg-black text-white shadow-md hover:-translate-y-0.5 active:translate-y-0"
                  }`}
                >
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{joining ? "Linking Devices…" : "Connect & Receive"}</span>
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 text-center">
                  <span>🔒 Direct P2P • No server upload required</span>
                </div>
              </div>
            </div>

            {/* ── COLUMN 2: CAMERA QR SCANNER CARD ── */}
            <div className="bg-gradient-to-b from-[#F9FAFC] to-white border border-gray-200/90 rounded-[28px] p-6 sm:p-7 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
                    <QrCode className="w-3 h-3 text-purple-600" /> Method 2 • Camera Scan
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    Live Webcam
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-gray-900">
                    Scan Sender&apos;s QR Code
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Point camera at the QR code on the sender screen
                  </p>
                </div>

                {/* Idle Scanner Launcher */}
                {!scanning && !scanSuccess ? (
                  <div
                    onClick={startScan}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-gray-200/90 hover:border-purple-300 bg-white/80 hover:bg-purple-50/20 transition-all cursor-pointer group text-center gap-3 min-h-[160px]"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform shadow-inner">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-purple-900 transition-colors">
                        Click to Launch Camera
                      </span>
                      <span className="text-[11px] text-gray-400 max-w-[220px]">
                        Webcam or phone camera supported
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Active Live Video Viewport */}
                <div className={`relative bg-black w-full rounded-2xl overflow-hidden transition-all duration-300 ${scanning || scanSuccess ? "h-[220px] sm:h-[240px]" : "h-0"}`}>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    onCanPlay={startTick}
                    className={`w-full h-full object-cover ${scanning && videoReady ? "block" : "hidden"}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {scanSuccess ? (
                    <div className="absolute inset-0 bg-emerald-600/95 flex flex-col items-center justify-center p-4 text-white text-center">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </div>
                      <p className="font-bold text-sm sm:text-base">QR Code Verified!</p>
                      <p className="text-xs text-emerald-100 mt-1">Connecting to sender device…</p>
                    </div>
                  ) : scanning && !videoReady ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                      <p className="text-xs text-gray-300">Initializing camera sensor…</p>
                    </div>
                  ) : scanning && videoReady ? (
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-36 h-36 rounded-2xl border-2 border-emerald-400 relative overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                        </div>
                      </div>
                      
                      <div className="z-10 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold py-1 px-3 rounded-full mx-auto">
                        Align QR Code within frame
                      </div>

                      <div className="z-10 flex justify-end pointer-events-auto">
                        <button
                          onClick={stopCamera}
                          className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-xs font-bold text-black border border-white/40 transition-colors shadow-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {cameraError && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold w-full text-center rounded-xl border border-red-100">
                    {cameraError}
                  </div>
                )}
              </div>

              {/* Action Button */}
              {!scanning && !scanSuccess ? (
                <button
                  onClick={startScan}
                  className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Open Camera Scanner</span>
                </button>
              ) : null}
            </div>

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

      {/* ── DEAD-CENTER VIEWPORT ERROR MODAL OVERLAY ── */}
      <AnimatePresence>
        {showErrorPopup && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop with blur & click outside to dismiss */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowErrorPopup(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[460px] bg-white rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.35),0_0_0_1px_rgba(244,63,94,0.15)] p-6 sm:p-8 flex flex-col gap-5 z-10 overflow-hidden"
            >
              {/* Top ambient highlight gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500" />

              {/* Header with Icon and Close button */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/90 flex items-center justify-center text-rose-600 shadow-inner shrink-0">
                    <AlertCircle className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-gray-900 tracking-tight">
                      Transfer Connection Error
                    </h3>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md inline-block mt-0.5">
                      Session Unreachable
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowErrorPopup(false)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Close error popup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Human-readable message */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 flex flex-col gap-2.5">
                <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed">
                  {getFriendlyErrorMessage(status, otc)}
                </p>

                <div className="pt-2 border-t border-gray-200/60 flex flex-col gap-1.5 text-[11px] text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Double check the 6-character code on the sender device.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Make sure the sender still has their transfer tab open.</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowErrorPopup(false);
                    setOtc("");
                    setTimeout(() => pinInputRef.current?.focus(), 150);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#111827] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Another Code</span>
                </button>
                <button
                  onClick={() => setShowErrorPopup(false)}
                  className="py-3 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-semibold transition-colors active:scale-95"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

