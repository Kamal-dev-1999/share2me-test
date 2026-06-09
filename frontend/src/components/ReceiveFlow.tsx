"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Key, Loader2, CheckCircle2, Camera, CameraOff, Copy, Check, Shield, Activity, HardDrive } from "lucide-react";
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
  searchNearby: () => Promise<any[]>;
  bytesTransferred?: number;
}

export function ReceiveFlow({ phase, status, keyStatus, progress, receivedText, onJoin, searchNearby, bytesTransferred = 0 }: Props) {
  const speedBps = useTransferSpeed(bytesTransferred);
  const [otc, setOtc]         = useState("");
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
    } catch (err: any) {
      setCameraError(err.message || "Camera access denied");
    }
  }, []);

  const handleJoin = useCallback(async (code: string) => {
    if (!code || joining) return;
    setJoining(true);
    stopCamera();
    try {
      await onJoin(code);
    } catch {
      setJoining(false);
    }
  }, [joining, onJoin, stopCamera]);

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

  const isIdle         = phase === "idle";
  const isTransferring = phase === "transferring";
  const isDone         = phase === "done";
  
  // Format OTC for display
  const otcDisplay = otc.padEnd(6, " ");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in w-full">
      
      {/* ── LEFT PANEL: CODE INPUT & SCANNER ── */}
      <div className="flex flex-col gap-6">
        
        {isIdle ? (
          <div className="flex flex-col gap-6">
            {/* OTC Input Box */}
            <div className="bg-background-card border border-border rounded-[20px] p-6 shadow-sm">
              <label className="block text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">
                Enter Sender's Code
              </label>
              
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  maxLength={6}
                  value={otc}
                  onChange={(e) => setOtc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="6-DIGIT CODE"
                  className="w-full bg-background border border-border rounded-xl px-5 py-4 text-primary font-mono text-[20px] font-bold tracking-[0.2em] focus:border-primary focus:outline-none transition-colors uppercase placeholder:text-border placeholder:font-sans placeholder:tracking-normal"
                />
              </div>
              
              <button
                disabled={otc.length !== 6 || joining}
                onClick={() => handleJoin(otc)}
                className="w-full mt-4 bg-primary text-background font-bold text-[15px] h-[48px] rounded-xl hover:bg-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-100 disabled:bg-background-card disabled:text-text-tertiary disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-glow disabled:shadow-none border border-transparent disabled:border-border"
              >
                {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {joining ? "Joining Room…" : "Join Transfer"}
              </button>
            </div>

            {/* Nearby Devices Scanner */}
            <div className="bg-background-card border border-border rounded-[20px] p-6 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 relative">
                <div className="absolute inset-0 rounded-full border border-primary/30 animate-[radar-spin_3s_linear_infinite] border-t-primary" />
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary">Search Available Devices Nearby</h3>
              <p className="text-[13px] text-text-tertiary mt-1 mb-5">Automatically find active transfers on your network.</p>
              
              <button
                onClick={async () => {
                  try {
                    const devices = await searchNearby();
                    if (devices.length > 0) {
                      setOtc(devices[0].otc); // Auto-fill first found
                      handleJoin(devices[0].otc);
                    } else {
                      alert("No devices found nearby. Make sure the sender has generated a code and is on the same network.");
                    }
                  } catch (e) {
                    console.error("Search failed", e);
                  }
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-background-elevated border border-border hover:border-border-hover hover:text-primary text-[14px] font-medium text-text-secondary rounded-xl transition-all w-full"
              >
                <Activity className="w-4 h-4" /> Scan Network
              </button>
            </div>

            {/* QR Scanner */}
            <div className="bg-background-card border border-border rounded-[20px] overflow-hidden flex flex-col relative shadow-sm">
              
              {!scanning && !scanSuccess && (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-background-elevated border border-border flex items-center justify-center mb-4">
                    <Camera className="w-7 h-7 text-text-tertiary" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-text-primary">Scan QR Code</h3>
                  <p className="text-[13px] text-text-tertiary mt-1 mb-5">Quickly connect by scanning the sender's code.</p>
                  
                  {cameraError ? (
                    <p className="text-[13px] text-status-error mb-4 px-4 bg-status-error/10 py-2 rounded-lg border border-status-error/20">{cameraError}</p>
                  ) : null}

                  <button
                    onClick={startScan}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-background-elevated border border-border hover:border-border-hover text-[14px] font-medium text-text-secondary hover:text-text-primary rounded-xl transition-all"
                  >
                    <Camera className="w-4 h-4" /> Open Camera
                  </button>
                </div>
              )}

              {/* Live Camera View */}
              <div className={`relative bg-black w-full overflow-hidden transition-all duration-300 ${scanning || scanSuccess ? "h-[300px]" : "h-0"}`}>
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  onCanPlay={startTick}
                  className={`w-full h-full object-cover ${scanning && videoReady ? "block" : "hidden"}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {scanSuccess ? (
                  <div className="absolute inset-0 bg-background-card flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-8 h-8 text-status-success" />
                    </div>
                    <p className="text-status-success font-semibold text-[15px]">QR scanned successfully!</p>
                  </div>
                ) : scanning && !videoReady ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background-card gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-[13px] text-text-secondary">Starting camera…</p>
                  </div>
                ) : scanning && videoReady ? (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Reticle */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-56 h-56 rounded-[24px] border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                        <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                        <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="absolute bottom-4 right-4 pointer-events-auto">
                      <button
                        onClick={stopCamera}
                        className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white text-[12px] font-semibold px-4 py-2 rounded-lg backdrop-blur-md transition-colors"
                      >
                        <CameraOff className="w-4 h-4" /> Stop
                      </button>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="flex items-center gap-2 bg-black/60 text-primary text-[12px] font-semibold px-4 py-2 rounded-lg backdrop-blur-md">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…
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
            <div className="bg-background-card border border-border rounded-[20px] p-6 shadow-sm">
              <label className="block text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Connected to Sender
              </label>
              <div className="font-mono text-3xl font-bold text-primary tracking-[0.2em]">{otc}</div>
              
              <div className="mt-6 p-4 rounded-xl bg-background border border-border flex items-start gap-3">
                <Shield className="w-5 h-5 text-status-success mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-text-primary">End-to-End Encrypted</p>
                  <p className="text-[13px] text-text-secondary mt-1">
                    Your connection is secured with AES-256-GCM. 
                    Only you and the sender can decrypt this transfer.
                  </p>
                </div>
              </div>
            </div>

            {/* Received Text Panel */}
            {receivedText && (
              <div className="bg-background-card border border-border rounded-[20px] p-6 animate-fade-in shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider">Received Text</span>
                  <button
                    onClick={copyText}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-background hover:bg-background-elevated px-3 py-1.5 rounded-lg border border-border transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="bg-background border border-border rounded-xl p-4 max-h-64 overflow-y-auto custom-scrollbar">
                  <pre className="text-[14px] font-mono text-text-primary whitespace-pre-wrap word-break-all">
                    {receivedText}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: STATUS & DASHBOARD ── */}
      <div className="bg-background-card rounded-[20px] border border-border overflow-hidden flex flex-col h-full min-h-[400px]">
        
        {/* Connection Header */}
        <div className="px-6 py-4 border-b border-border bg-background-elevated/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isIdle ? "bg-text-tertiary" : isDone ? "bg-status-success" : "bg-primary animate-pulse-ring"}`} />
            <span className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Connection Status</span>
          </div>
          <div className="flex items-center gap-1.5 bg-status-success/10 border border-status-success/20 px-2.5 py-1 rounded-md">
            <Shield className="w-3.5 h-3.5 text-status-success" />
            <span className="text-[11px] font-semibold text-status-success">
              {keyStatus === "ready" ? "Key Ready" : keyStatus === "generated" ? "Key Generated" : "Secured P2P"}
            </span>
          </div>
        </div>

        {/* Dynamic Content Body */}
        <div className="flex-1 flex flex-col justify-center p-6 relative">
          
          <AnimatePresence mode="wait">
            {isIdle && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center text-center gap-4">
                <div className="w-20 h-20 rounded-full border border-border flex items-center justify-center bg-background/50 relative">
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-[radar-spin_4s_linear_infinite] border-t-primary" />
                  <Activity className="w-8 h-8 text-text-tertiary" />
                </div>
                <div>
                  <p className="text-text-primary font-medium">Waiting for Connection</p>
                  <p className="text-text-tertiary text-[13px] mt-1 max-w-[200px]">Enter a code or scan a QR to establish a secure link.</p>
                </div>
              </motion.div>
            )}

            {!isIdle && !isTransferring && !isDone && (
              <motion.div key="connecting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center w-full">
                <div className="w-24 h-24 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5 relative">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/50 animate-[radar-spin_2s_linear_infinite] border-t-primary shadow-glow" />
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-[18px] font-semibold text-text-primary mt-6 mb-1">Negotiating WebRTC</h3>
                <p className="text-[14px] text-text-tertiary text-center max-w-[250px]">{status}</p>
              </motion.div>
            )}

            {(isTransferring || isDone) && (
              <motion.div key="transfer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full h-full justify-center">
                
                {/* Big Circular/Visual Progress Area */}
                <div className="flex flex-col items-center justify-center mb-10">
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    {/* Background Circle */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="80" cy="80" r="76" fill="none" stroke="currentColor" strokeWidth="6" className="text-border" />
                      <circle cx="80" cy="80" r="76" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="477.5" strokeDashoffset={477.5 - (477.5 * progress) / 100} className="text-primary transition-all duration-500 ease-out" />
                    </svg>
                    <div className="flex flex-col items-center justify-center z-10">
                      <span className="text-[32px] font-display font-bold text-text-primary leading-none">{progress}%</span>
                      {isDone ? (
                        <span className="text-[12px] font-bold text-status-success mt-1 uppercase tracking-wider">Complete</span>
                      ) : (
                        <span className="text-[12px] font-medium text-text-tertiary mt-1 uppercase tracking-wider">Receiving</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-background border border-border rounded-xl p-4 flex flex-col">
                    <span className="text-[12px] text-text-tertiary font-medium mb-1">Received</span>
                    <span className="text-[15px] font-semibold text-text-primary font-mono">{formatBytes(bytesTransferred)}</span>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-4 flex flex-col">
                    <span className="text-[12px] text-text-tertiary font-medium mb-1">Current Speed</span>
                    <span className="text-[15px] font-semibold text-primary font-mono">{speedBps > 0 ? formatSpeed(speedBps) : "--"}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Persistent Status Bar at Bottom */}
        <div className="w-full p-4 border-t border-border bg-background/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {isTransferring ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <HardDrive className="w-4 h-4 text-text-tertiary" />}
            <span className={`text-[13px] font-medium truncate ${phase === "error" ? "text-status-error" : "text-text-secondary"}`}>
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
