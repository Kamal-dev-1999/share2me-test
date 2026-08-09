"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Key, Loader2, CheckCircle2, Camera, CameraOff, Copy, Check, Shield, Activity, HardDrive, X } from "lucide-react";
import jsQR from "jsqr";
import { TransferPhase } from "@/hooks/useTransfer";
import { motion, AnimatePresence } from "framer-motion";

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

export function ReceiveFlow({ phase, status, keyStatus, progress, receivedText, onJoin, bytesTransferred = 0 }: Props) {
  const speedBps = useTransferSpeed(bytesTransferred);
  const [otc, setOtc]         = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(true);

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
        if (code && code.data && code.data.length === 6) {
          scanningRef.current = false;
          setScanSuccess(true);
          setOtc(code.data);
          handleJoin(code.data);
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
  
  const getFriendlyError = (errStatus: string) => {
    if (!errStatus) return "Invalid or expired transfer code";
    const s = errStatus.toLowerCase();
    if (s.includes("not_found") || s.includes("not found")) return "The code you entered is invalid or has expired.";
    if (s.includes("full")) return "This transfer is already in progress with someone else.";
    if (s.includes("timeout")) return "Connection timed out. The sender might be offline.";
    if (s.includes("network")) return "Network error. Please check your connection.";
    if (s === "error") return "Could not connect to the sender. Please verify the code.";
    return errStatus;
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in w-full relative z-10 text-on-surface">
      {/* ── LEFT PANEL: CODE INPUT & SCANNER ── */}
      <div className="flex flex-col gap-6">
        
        {isIdle ? (
          <div className="flex flex-col gap-6">
            {/* OTC Input Box */}
            <div className="bg-white border border-[#E1E3E5] rounded-[24px] p-8 relative z-10 shadow-sm">
              <label className="block text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider mb-3">
                Enter 6-Digit Code
              </label>
              
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  maxLength={6}
                  value={otc}
                  onChange={(e) => setOtc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otc.length === 6 && !joining) {
                      handleJoin(otc);
                    }
                  }}
                  placeholder="ENTER CODE"
                  className="w-full bg-[#F7F8F8] border border-[#E1E3E5] rounded-xl px-4 py-3.5 text-black font-mono text-[22px] font-bold tracking-[0.25em] text-center focus:outline-none focus:bg-white focus:border-black transition-all uppercase placeholder:text-[#E1E3E5] placeholder:font-sans placeholder:tracking-normal"
                />
              </div>
              
              <button
                disabled={otc.length !== 6 || joining}
                onClick={() => handleJoin(otc)}
                className={`w-full mt-4 font-semibold text-[13px] h-12 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                  otc.length !== 6 || joining
                    ? "bg-[#F7F8F8] text-[#8A8F93] border border-[#E1E3E5] cursor-not-allowed opacity-60 h-12 rounded-xl flex items-center justify-center gap-2"
                    : "bg-black text-white hover:bg-[#262626] hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
                }`}
              >
                {joining ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : null}
                {joining ? "Joining Room…" : "Connect & Receive"}
              </button>
            </div>


            {/* QR Scanner */}
            <div className="bg-white border border-[#E1E3E5] rounded-[24px] overflow-hidden flex flex-col relative z-10 shadow-sm">
              
              {!scanning && !scanSuccess && (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#EEF6F2] flex items-center justify-center text-[#35B94A] border border-[#EEF6F2] mb-4">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-[#111111]">Scan Connection QR</h3>
                  <p className="text-[12px] text-[#8A8F93] mt-1.5 mb-5">Position the QR code in front of the camera to link devices.</p>
                  
                  {cameraError ? (
                    <p className="text-[12px] text-red-400 mb-4 px-4 bg-red-50 py-2 rounded-lg border border-red-100">{cameraError}</p>
                  ) : null}

                  <button
                    onClick={startScan}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F7F8F8] border border-[#E1E3E5] hover:bg-white text-[12px] font-semibold text-[#5F6368] hover:text-black rounded-xl transition-all"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#35B94A]" /> Start Scanner
                  </button>
                </div>
              )}

              {/* Live Camera View */}
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
                  <div className="absolute inset-0 bg-[#EEF6F2] border-t border-[#E1E3E5] flex flex-col items-center justify-center p-4">
                    <div className="w-14 h-14 rounded-full bg-[#35B94A]/15 flex items-center justify-center mb-3 text-[#35B94A]">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-[#35B94A] font-semibold text-[14px]">QR scanned successfully!</p>
                  </div>
                ) : scanning && !videoReady ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F7F8F8] gap-2.5">
                    <Loader2 className="w-5 h-5 animate-spin text-[#35B94A]" />
                    <p className="text-[12px] text-[#8A8F93]">Starting camera…</p>
                  </div>
                ) : scanning && videoReady ? (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Reticle */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-52 h-52 rounded-[24px] border-2 border-[#35B94A]/55 shadow-[0_0_0_9999px_rgba(247,248,248,0.85)] relative">
                        <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#35B94A] rounded-tl-lg" />
                        <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#35B94A] rounded-tr-lg" />
                        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#35B94A] rounded-bl-lg" />
                        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#35B94A] rounded-br-lg" />
                        {/* Red Laser Scan Bar */}
                        <div className="absolute left-1 right-1 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] top-0 animate-[scan_2.5s_ease-in-out_infinite]" />
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="absolute bottom-4 right-4 pointer-events-auto">
                      <button
                        onClick={stopCamera}
                        className="flex items-center gap-2 bg-white/90 hover:bg-white text-black text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#E1E3E5] transition-colors"
                      >
                        <CameraOff className="w-3.5 h-3.5" /> Stop
                      </button>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="flex items-center gap-2 bg-[#EEF6F2] text-[#35B94A] text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#35B94A]/25">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting QR…
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Connected Info Box */}
            <div className="bg-white border border-[#E1E3E5] rounded-[24px] p-8 relative z-10 shadow-sm">
              <label className="block text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider mb-2">
                Linked to Sender Device
              </label>
              <div className="font-mono text-3xl font-bold text-black tracking-[0.25em]">{otc}</div>
              
              <div className="mt-6 p-5 rounded-2xl bg-[#EEF6F2] border border-[#35B94A]/20 flex items-start gap-3.5">
                <Shield className="w-5.5 h-5.5 text-[#35B94A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-[#35B94A]">Secured Direct Channel</p>
                  <p className="text-[12.5px] text-[#5F6368] mt-1.5 leading-relaxed">
                    Your connection is verified. The payload is encrypted end-to-end and streams directly peer-to-peer.
                  </p>
                </div>
              </div>
            </div>

            {/* Received Text Panel */}
            {receivedText && (
              <div className="bg-white border border-[#E1E3E5] rounded-[24px] p-8 animate-fade-in relative z-10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">Decrypted Text Payload</span>
                  <button
                    onClick={copyText}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5F6368] bg-[#F7F8F8] hover:bg-[#E1E3E5] px-3 py-1.5 rounded-lg border border-[#E1E3E5] transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#35B94A]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="bg-[#F7F8F8] border border-[#E1E3E5] rounded-xl p-4 max-h-64 overflow-y-auto custom-scrollbar">
                  <pre className="text-[13px] font-mono text-black whitespace-pre-wrap break-all">
                    {receivedText}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: STATUS & DASHBOARD ── */}
      <div className="bg-white border border-[#E1E3E5] rounded-[24px] overflow-hidden flex flex-col h-full min-h-[400px] relative shadow-sm">
        
        {/* Connection Header */}
        <div className="px-6 py-4.5 border-b border-[#E1E3E5] bg-[#F7F8F8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${isIdle ? "bg-[#8A8F93]" : isDone ? "bg-[#35B94A] shadow-[0_0_8px_rgba(53,185,74,0.3)]" : "bg-[#E98B32] shadow-[0_0_8px_rgba(233,139,50,0.3)] animate-pulse"}`} />
            <span className="text-[11px] font-bold text-[#5F6368] uppercase tracking-wider">Transfer Connection</span>
          </div>
          {(!isIdle) ? (
            <div className="flex items-center gap-1.5 bg-[#EEF6F2] border border-[#35B94A]/20 px-2.5 py-1 rounded-md text-[#35B94A]">
              <Shield className="w-3.5 h-3.5" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
                {keyStatus === "ready" ? "Key Ready" : keyStatus === "generated" ? "Key Generated" : "Secured P2P"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#F7F8F8] border border-[#E1E3E5] px-2.5 py-1 rounded text-[#8A8F93]">
              <Activity className="w-3.5 h-3.5" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
                Standby
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Content Body */}
        <div className="flex-1 flex flex-col justify-center p-8 relative">
          
          <AnimatePresence mode="wait">
            {isIdle && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center text-center gap-4">
                <div className="w-20 h-20 rounded-full border border-[#E1E3E5] flex items-center justify-center bg-[#F7F8F8] text-[#8A8F93] shadow-inner relative">
                  <div className="absolute inset-0 rounded-full border border-[#35B94A]/10 animate-[radar-spin_6s_linear_infinite] border-t-[#35B94A]/40" />
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[#111111] font-semibold text-[15px]">Awaiting Connection</p>
                  <p className="text-[#8A8F93] text-[13px] mt-1.5 max-w-[230px] leading-relaxed">Enter the code or scan the QR code from the sender to start the transfer.</p>
                </div>
              </motion.div>
            )}

            {!isIdle && !isTransferring && !isDone && (
              <motion.div key="connecting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center w-full">
                <div className="w-16 h-16 rounded-full border border-[#E1E3E5] flex items-center justify-center bg-[#F7F8F8] relative text-[#8A8F93]">
                  <div className="absolute inset-0 rounded-full border border-[#35B94A]/30 animate-[radar-spin_3s_linear_infinite] border-t-[#35B94A]" />
                  <Key className="w-7 h-7 text-[#111111]" />
                </div>
                <h3 className="text-[14px] font-semibold text-black mt-5 mb-1">Establishing Encryption Channel</h3>
                <p className="text-[12px] text-[#8A8F93] text-center max-w-[220px] leading-relaxed">{status}</p>
              </motion.div>
            )}

            {(isTransferring || isDone) && (
              <motion.div key="transfer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full h-full justify-center">
                
                {/* Big Circular/Visual Progress Area */}
                <div className="flex flex-col items-center justify-center mb-8">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    {/* Background Circle */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="68" fill="none" stroke="currentColor" strokeWidth="5" className="text-[#E1E3E5]" />
                      <circle cx="72" cy="72" r="68" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="427" strokeDashoffset={427 - (427 * progress) / 100} className="text-[#35B94A] transition-all duration-350 ease-out" />
                    </svg>
                    <div className="flex flex-col items-center justify-center z-10">
                      <span className="text-[28px] font-mono font-bold text-black leading-none">{progress}%</span>
                      {isDone ? (
                        <span className="text-[10px] font-bold text-[#35B94A] mt-1.5 uppercase tracking-widest">Complete</span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#35B94A] mt-1.5 uppercase tracking-widest animate-pulse">Receiving</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-[#F7F8F8] border border-[#E1E3E5] rounded-[20px] p-5 flex flex-col shadow-sm">
                    <span className="text-[10px] text-[#8A8F93] font-bold uppercase tracking-wider mb-1.5">Data Received</span>
                    <span className="text-[14px] font-bold text-black font-mono">{formatBytes(bytesTransferred)}</span>
                  </div>
                  <div className="bg-[#F7F8F8] border border-[#E1E3E5] rounded-[20px] p-5 flex flex-col shadow-sm">
                    <span className="text-[10px] text-[#8A8F93] font-bold uppercase tracking-wider mb-1.5">Transfer Speed</span>
                    <span className="text-[14px] font-bold text-[#35B94A] font-mono">{speedBps > 0 ? formatSpeed(speedBps) : "--"}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Persistent Status Bar at Bottom */}
        <div className="w-full p-4.5 border-t border-[#E1E3E5] bg-[#F7F8F8] shrink-0">
          <div className="flex items-center gap-3">
            {isTransferring ? <Loader2 className="w-4 h-4 text-[#35B94A] animate-spin" /> : <HardDrive className="w-4 h-4 text-[#8A8F93]" />}
            <span className={`text-[12px] font-semibold truncate ${phase === "error" ? "text-[#D9534F]" : "text-[#5F6368]"}`}>
              {phase === "error" ? getFriendlyError(status) : status}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* ── COMPLETION POPUP ── */}
    <AnimatePresence>
      {isDone && showCompletionPopup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#111111]/30 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white border border-[#E1E3E5] shadow-2xl rounded-[28px] p-8 flex flex-col items-center gap-6 w-full max-w-[400px] relative text-black"
          >
            <button
              onClick={() => setShowCompletionPopup(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#F7F8F8] transition-colors text-[#8A8F93] hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-20 h-20 rounded-full bg-[#EEF6F2] border border-[#35B94A]/20 flex items-center justify-center mb-1 text-[#35B94A]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h3 className="text-[22px] font-bold text-black">Direct Transfer Complete</h3>
              <p className="text-[13.5px] text-[#8A8F93] mt-2.5 leading-relaxed">
                The data stream completed successfully. The direct encrypted channel is now closed.
              </p>
            </div>
            
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => window.location.href = "/"}
                className="w-full bg-black text-white hover:bg-[#262626] font-semibold text-[14px] h-12 rounded-xl transition-all"
              >
                Receive Another Payload
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── ERROR TOAST ── */}
    <AnimatePresence>
      {showErrorPopup && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -20, x: "-50%" }}
          className="fixed top-24 left-1/2 z-[200] bg-[#FEECEB] text-[#A82520] px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 border border-[#D9534F]/30 w-[90%] sm:w-auto min-w-[300px] max-w-[400px] cursor-pointer"
          onClick={() => setShowErrorPopup(false)}
        >
          <div className="w-8 h-8 bg-[#D9534F]/10 rounded-full flex items-center justify-center shrink-0">
            <X className="w-4 h-4 text-[#D9534F]" />
          </div>
          <div className="flex flex-col flex-1 pr-2">
            <span className="font-semibold text-[15px] text-[#A82520]">Connection Failed</span>
            <span className="text-[13px] text-[#D9534F]/90">{getFriendlyError(status)}</span>
          </div>
          <button className="ml-2 opacity-70 hover:opacity-100 transition-opacity p-1 focus:outline-none">
            <X className="w-4 h-4 text-[#D9534F]" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>


    </>
  );
}
