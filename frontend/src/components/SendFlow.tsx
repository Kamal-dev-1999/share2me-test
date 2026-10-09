"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, Loader2, Wifi,
  ClipboardPaste, Type, FileUp, X, Shield, Activity, HardDrive, CheckCircle2,
  Copy, Check, Sparkles, Smartphone, Laptop, ArrowRight, RefreshCw
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import * as fflate from "fflate";
import confetti from "canvas-confetti";
import { TransferPhase } from "@/hooks/useTransfer";
import { motion, AnimatePresence } from "framer-motion";
import { loadToolOutput } from "@/lib/toolOutputStore";
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
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  phase: TransferPhase;
  status: string;
  otc: string | null;
  progress: number;
  onCreateRoom:     (file: File)   => void;
  onCreateTextRoom: (text: string) => void;
  onStartSend:      () => void;
  bytesTransferred?: number;
}

type TransferType = "file" | "text";

export function SendFlow({
  phase, status, otc, progress,
  onCreateRoom, onCreateTextRoom, onStartSend,
  bytesTransferred = 0,
}: Props) {
  const speedBps = useTransferSpeed(bytesTransferred);
  const [transferType, setTransferType] = useState<TransferType>("file");
  const [isZipping, setIsZipping] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger sound when receiver connects
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "key_exchange") {
      timer = setTimeout(() => {
        setShowNudge(true);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
          }
        } catch (e) {
          console.warn("Audio generation failed", e);
        }
      }, 5000);
    } else {
      setShowNudge(false);
    }
    return () => clearTimeout(timer);
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

  // Auto-load file from tools if it exists in toolOutputStore
  useEffect(() => {
    loadToolOutput()
      .then((file) => {
        if (file) {
          setFiles([file]);
        }
      })
      .catch((err) => console.error("Failed to recover tool output file:", err));
  }, []);

  const copyToClipboard = () => {
    if (!otc) return;
    navigator.clipboard.writeText(otc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate QR with direct web link so smartphone camera opens the receiver directly
  useEffect(() => {
    if (!otc) { setQrDataUrl(null); return; }
    const origin = typeof window !== "undefined" ? window.location.origin : "https://share2me.in";
    const shareUrl = `${origin}/p2p?mode=receive&code=${otc}`;
    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => {});
  }, [otc]);

  const handleFiles = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles = Array.from(selectedFiles);
    setFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 10) {
        alert("Maximum 10 files allowed.");
        return prev;
      }
      const totalSize = combined.reduce((acc, f) => acc + f.size, 0);
      if (totalSize > 1.5 * 1024 * 1024 * 1024) {
        alert("Total size exceeds 1.5 GB limit.");
        return prev;
      }
      return combined;
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleCreateRoom = async () => {
    if (transferType === "text" && textInput.trim()) {
      onCreateTextRoom(textInput);
      return;
    }
    if (transferType === "file" && files.length > 0) {
      if (files.length === 1) {
        onCreateRoom(files[0]);
      } else {
        setIsZipping(true);
        try {
          const zipData: Record<string, Uint8Array> = {};
          for (const f of files) {
            const buffer = await f.arrayBuffer();
            let name = f.name;
            let counter = 1;
            while (zipData[name]) {
              const parts = f.name.split('.');
              if (parts.length > 1) {
                const ext = parts.pop();
                name = `${parts.join('.')}_${counter}.${ext}`;
              } else {
                name = `${f.name}_${counter}`;
              }
              counter++;
            }
            zipData[name] = new Uint8Array(buffer);
          }
          fflate.zip(zipData, { level: 0 }, (err, data) => {
            setIsZipping(false);
            if (err) { alert("Failed to zip files"); return; }
            const zipFile = new File([data], "Shared_Files.zip", { type: "application/zip" });
            onCreateRoom(zipFile);
          });
        } catch {
          setIsZipping(false);
          alert("Error reading files for zip");
        }
      }
    }
  };

  const isIdle         = phase === "idle";
  const isPreparing    = phase === "preparing";
  const isTransferring = phase === "transferring";
  const isDone         = phase === "done";
  const isWaiting      = Boolean(otc && !isTransferring && !isDone);

  const canPrepare = isIdle && !isZipping && (transferType === "file" ? files.length > 0 : textInput.trim().length > 0);
  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);

  // ETA Calculation
  const remainingBytes = Math.max(0, totalSizeBytes - bytesTransferred);
  const etaSeconds = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : null;

  // Format OTC with space: "482 195"
  const formattedOtc = otc && otc.length === 6 ? `${otc.slice(0, 3)} ${otc.slice(3)}` : (otc || "");

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* ── STATE 1: SELECTION & PAIRING (IDLE / PREPARING / WAITING) ── */}
      {!isTransferring && !isDone && (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
          
          {/* File vs Text Mode Switcher */}
          <div className="flex items-center justify-between w-full">
            <div className="flex p-1 bg-black/[0.04] rounded-2xl border border-black/[0.06] backdrop-blur-md">
              <button
                onClick={() => setTransferType("file")}
                disabled={!isIdle}
                className={`flex items-center gap-2 text-xs font-bold py-1.5 px-4 rounded-xl transition-all ${
                  transferType === "file"
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-500 hover:text-black disabled:opacity-40"
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Files</span>
              </button>
              <button
                onClick={() => setTransferType("text")}
                disabled={!isIdle}
                className={`flex items-center gap-2 text-xs font-bold py-1.5 px-4 rounded-xl transition-all ${
                  transferType === "text"
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-500 hover:text-black disabled:opacity-40"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text Note</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Direct P2P Ready</span>
            </div>
          </div>

          {/* Magnetic Glowing Dropzone */}
          {transferType === "file" ? (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => isIdle && fileInputRef.current?.click()}
                className={`relative group rounded-[28px] p-[2px] transition-all duration-300 ${
                  dragging 
                    ? "bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 shadow-[0_0_25px_rgba(16,185,129,0.3)] scale-[1.01]"
                    : "bg-gradient-to-r from-purple-400/25 via-pink-400/20 to-blue-400/25 hover:from-purple-400/40 hover:to-blue-400/40"
                }`}
              >
                <div className={`bg-white/95 backdrop-blur-xl rounded-[26px] p-8 sm:p-10 text-center transition-all select-none flex flex-col items-center justify-center ${
                  !isIdle ? "cursor-default" : "cursor-pointer hover:bg-white"
                }`}>
                  <input
                    ref={fileInputRef}
                    id="p2p-file-upload"
                    name="files"
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
                    disabled={!isIdle}
                  />

                  {/* Illustrated floating badges */}
                  <div className="relative mb-5 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-purple-100 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                      <Upload className="w-7 h-7 text-indigo-600 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    {/* Decorative floating chips */}
                    <span className="absolute -top-2 -right-3 w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-200 flex items-center justify-center text-xs shadow-sm transform rotate-12">
                      📄
                    </span>
                    <span className="absolute -bottom-2 -left-3 w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-200 flex items-center justify-center text-xs shadow-sm transform -rotate-12">
                      🖼️
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 font-display tracking-tight">
                    {files.length > 0
                      ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                      : "Drop anything to share instantly"}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-sm">
                    {files.length > 0
                      ? `${formatBytes(totalSizeBytes)} total • Click to add more files`
                      : "Photos, videos, or documents up to 1.5 GB • End-to-end encrypted"}
                  </p>
                </div>
              </div>

              {/* Selected Files Chip List */}
              <AnimatePresence>
                {files.length > 0 && isIdle && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1"
                  >
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white border border-gray-200/80 px-4 py-2.5 rounded-2xl shadow-sm text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-gray-400">{formatBytes(f.size)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFiles(files.filter((_, idx) => idx !== i));
                            }}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Text Mode Box */
            <div className="relative">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={!isIdle}
                placeholder="Type or paste any sensitive text, links, or notes to beam directly..."
                rows={6}
                className="w-full bg-white border border-gray-200/90 rounded-[24px] p-5 text-gray-900 text-sm font-mono resize-y focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all placeholder:text-gray-400 disabled:opacity-50"
              />
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[11px] font-mono text-gray-400">
                  {textInput.length.toLocaleString()} characters
                </span>
                {isIdle && textInput.length === 0 && (
                  <button
                    onClick={async () => {
                      try {
                        const t = await navigator.clipboard.readText();
                        setTextInput(t);
                      } catch {}
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black py-1 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all"
                  >
                    <ClipboardPaste className="w-3 h-3 text-indigo-600" /> Paste
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Button: Generate Code if idle */}
          {isIdle && (
            <button
              disabled={!canPrepare}
              onClick={handleCreateRoom}
              className={`w-full py-4 px-6 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 ${
                !canPrepare
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                  : "bg-[#111827] hover:bg-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
              <span>{isZipping ? "Packaging Files…" : "Generate Share Code"}</span>
            </button>
          )}

          {isPreparing && (
            <div className="w-full py-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Preparing encrypted room…</span>
            </div>
          )}

          {/* ── PAIRING CARD (WHEN ROOM OTC IS READY) ── */}
          {isWaiting && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="bg-gradient-to-br from-[#F7F8FA] to-white border border-gray-200/90 rounded-[28px] p-6 sm:p-8 shadow-sm flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-6 items-center">
                {/* Left: 6-Digit PIN Code */}
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-black/5 px-2.5 py-1 rounded-full w-fit">
                    Share Code • 6-Digit PIN
                  </span>

                  <div className="font-mono text-4xl sm:text-5xl font-black tracking-[0.18em] text-gray-900 select-all">
                    {formattedOtc}
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:text-black hover:border-black/30 shadow-sm transition-all"
                  >
                    <AnimatedCopyIcon copied={copied} className="w-3.5 h-3.5" />
                    <span>{copied ? "Copied to Clipboard!" : "Copy Code"}</span>
                  </button>

                  <p className="text-xs text-gray-500 mt-1">
                    Tell the receiver to enter this code on <span className="font-semibold text-gray-700">Share2Me.in/p2p</span>
                  </p>
                </div>

                {/* Right: Crisp Mini QR Code */}
                <div className="flex flex-col items-center justify-center bg-white border border-gray-200 p-4 rounded-2xl shadow-sm text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                    Scan With Phone
                  </span>
                  {qrDataUrl ? (
                    <div className="relative rounded-xl overflow-hidden shadow-inner p-1 bg-white">
                      <Image
                        src={qrDataUrl}
                        alt="Transfer QR Code"
                        width={150}
                        height={150}
                        className="rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-[150px] h-[150px] bg-gray-100 rounded-xl animate-pulse" />
                  )}
                  <span className="text-[11px] text-gray-400 mt-2">
                    Open camera on phone to link
                  </span>
                </div>
              </div>

              {/* Connected Receiver Banner / Begin Transfer CTA */}
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3 h-3 rounded-full ${
                    phase === "ready" || phase === "key_exchange" 
                      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                      : "bg-amber-400 animate-pulse"
                  }`} />
                  <span className="text-xs font-semibold text-gray-700">
                    {phase === "ready" || phase === "key_exchange"
                      ? "Receiver Connected! Ready to stream."
                      : "Waiting for receiver to join…"}
                  </span>
                </div>

                {/* If receiver connected, show prominent Start Transfer CTA */}
                {(phase === "ready" || phase === "key_exchange") && (
                  <button
                    onClick={onStartSend}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1.5 transition-all animate-pulse"
                  >
                    <span>Begin Direct Transfer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

        </div>
      )}

      {/* ── STATE 2: ACTIVE TRANSFER (CIRCULAR PROGRESS WAVE) ── */}
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
            <span>Receiver</span>
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
                className="text-indigo-600 transition-all duration-300 ease-out"
                strokeLinecap="round"
              />
            </svg>

            <div className="flex flex-col items-center justify-center z-10">
              <span className="text-4xl sm:text-5xl font-mono font-black text-gray-900 tracking-tight">
                {progress}%
              </span>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mt-1 animate-pulse">
                Direct Stream
              </span>
            </div>
          </div>

          {/* Transfer Info & Speed */}
          <div className="flex flex-col items-center gap-2 max-w-sm">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 truncate max-w-xs">
              {files.length === 1 ? files[0].name : `${files.length} Shared Files`}
            </h4>

            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              <span>{formatBytes(bytesTransferred)} of {formatBytes(totalSizeBytes)}</span>
              <span>•</span>
              <span className="text-emerald-600 font-bold">
                {speedBps > 0 ? formatSpeed(speedBps) : "--"}
              </span>
            </div>

            {etaSeconds !== null && (
              <span className="text-[11px] font-medium text-gray-400">
                ~{etaSeconds}s remaining
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* ── STATE 3: COMPLETE CELEBRATION ── */}
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
            Direct Transfer Complete!
          </h3>

          <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-sm">
            {formatBytes(bytesTransferred)} transferred directly between devices. The encrypted WebRTC channel is now closed.
          </p>

          <button
            onClick={() => {
              setFiles([]);
              setTextInput("");
              window.location.reload();
            }}
            className="mt-8 px-6 py-3 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Share Another File</span>
          </button>
        </motion.div>
      )}

      {/* Receiver Connection Nudge Popup */}
      <AnimatePresence>
        {showNudge && !isTransferring && !isDone && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[100] bg-white border border-gray-200 shadow-2xl rounded-2xl p-5 flex flex-col gap-4 w-full max-w-[320px]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 leading-tight">Receiver Joined!</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">Click below to start direct transfer.</p>
                </div>
              </div>
              <button onClick={() => setShowNudge(false)} className="text-gray-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { setShowNudge(false); onStartSend(); }}
              className="w-full bg-[#111827] hover:bg-black text-white text-xs font-bold py-2.5 rounded-xl transition-all"
            >
              Start Transfer Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
