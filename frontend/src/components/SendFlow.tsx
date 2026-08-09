"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, Loader2, Wifi,
  ClipboardPaste, Type, FileUp, X, Shield, Activity, HardDrive, CheckCircle2,
  Copy, Check
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import * as fflate from "fflate";
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
  const [showCompletionPopup, setShowCompletionPopup] = useState(true);

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
      }, 10000);
    } else {
      setShowNudge(false);
    }
    return () => clearTimeout(timer);
  }, [phase]);

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  // Auto-load file from tools if it exists in sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("share2me_tool_output");
    if (stored) {
      try {
        const { dataUrl, filename, mimeType } = JSON.parse(stored);
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], filename, { type: mimeType });
            setFiles([file]);
            sessionStorage.removeItem("share2me_tool_output");
          })
          .catch(err => console.error("Failed to recover tool output blob", err));
      } catch (e) {
        console.error("Failed to parse tool output from session storage", e);
      }
    }
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!otc) return;
    navigator.clipboard.writeText(otc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [textInput, setTextInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!otc) { setQrDataUrl(null); return; }
    QRCode.toDataURL(otc, {
      width: 260, margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#070B14", light: "#FFD54A" },
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
    e.preventDefault(); setDragging(false);
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

  const canPrepare = isIdle && !isZipping && (transferType === "file" ? files.length > 0 : textInput.trim().length > 0);
  const textBytes  = new TextEncoder().encode(textInput).length;

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in w-full relative z-10 text-on-surface">
      
      {/* ── LEFT PANEL: UPLOAD & CONTROLS ── */}
      <div className="flex flex-col gap-6">
        
        {/* Type Selector */}
        <div className="flex p-1 bg-[#F7F8F8] rounded-xl border border-[#E1E3E5]">
          <button
            onClick={() => setTransferType("file")}
            disabled={!isIdle}
            className={`flex-1 flex items-center justify-center gap-2 text-[13px] font-medium py-2 rounded-lg transition-all duration-150
              ${transferType === "file" ? "bg-white text-black shadow-sm border border-[#E1E3E5]" : "text-[#5F6368] hover:text-black disabled:opacity-40"}`}
          >
            <FileUp className="w-[15px] h-[15px]" strokeWidth={1.75} /> Files
          </button>
          <button
            onClick={() => setTransferType("text")}
            disabled={!isIdle}
            className={`flex-1 flex items-center justify-center gap-2 text-[13px] font-medium py-2 rounded-lg transition-all duration-150
              ${transferType === "text" ? "bg-white text-black shadow-sm border border-[#E1E3E5]" : "text-[#5F6368] hover:text-black disabled:opacity-40"}`}
          >
            <Type className="w-[15px] h-[15px]" strokeWidth={1.75} /> Text
          </button>
        </div>

        {/* Upload Zone */}
        {transferType === "file" ? (
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => isIdle && fileInputRef.current?.click()}
              className={`relative bg-white rounded-2xl border border-dashed border-[#8A8F93]/50 px-6 py-8 text-center transition-all duration-200 select-none
                ${!isIdle ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-[#F7F8F8] hover:border-[#8A8F93]"}
                ${dragging ? "bg-[#EEF6F2] border-[#35B94A]" : ""}
                ${files.length > 0 ? "bg-[#F7F8F8]/40" : ""}
              `}
            >
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} disabled={!isIdle} />
              
              <div className="flex flex-col items-center gap-3">
                <span className={`icon-tile-lg w-12 h-12 rounded-xl ${
                  files.length > 0 ? "text-[#35B94A]" : ""
                }`}>
                  {files.length > 0 ? <FileText className="w-5 h-5" strokeWidth={1.75} /> : <Upload className="w-5 h-5" strokeWidth={1.75} />}
                </span>
                <div>
                  <p className="text-[#111111] text-[14px] font-semibold">
                    {files.length > 0
                      ? (files.length === 1 ? files[0].name : `${files.length} files selected`)
                      : "Drop files here or click to browse"}
                  </p>
                  <p className="text-[#8A8F93] text-[12px] mt-1">
                    {files.length > 0
                      ? `${formatBytes(files.reduce((acc, f) => acc + f.size, 0))} total`
                      : "Up to 1.5 GB · Everything stays end-to-end encrypted"}
                  </p>
                </div>
              </div>
            </div>

            {/* File List Queue */}
            <AnimatePresence>
              {files.length > 0 && isIdle && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#F7F8F8] px-4 py-3 rounded-2xl border border-[#E1E3E5] group hover:border-[#8A8F93]/60 transition-all duration-150 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-[#5F6368] flex-shrink-0" />
                        <span className="text-[13px] text-[#111111] font-semibold truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-3 pl-3">
                        <span className="text-[12px] text-[#8A8F93] whitespace-nowrap font-mono">{formatBytes(f.size)}</span>
                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-[#8A8F93] hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
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
          <div className="relative">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={!isIdle}
              placeholder="Type, paste, or drop your text here..."
              rows={8}
              className="w-full bg-[#F7F8F8] border border-[#E1E3E5] rounded-[24px] p-5 text-[#111111] text-[14px] font-mono resize-y focus:outline-none focus:bg-white focus:border-black transition-all placeholder:text-[#8A8F93] disabled:opacity-50"
            />
            <div className="absolute bottom-4 left-5 right-5 flex justify-between items-center">
              <span className="text-[11px] text-[#8A8F93] bg-white px-2 py-0.5 rounded border border-[#E1E3E5] font-mono">
                {textInput.length.toLocaleString()} chars · {formatBytes(textBytes)}
              </span>
              {isIdle && textInput.length === 0 && (
                <button onClick={async () => { try { const t = await navigator.clipboard.readText(); setTextInput(t); } catch {} }} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5F6368] bg-white hover:bg-[#F7F8F8] hover:text-black px-3 py-1.5 rounded-lg border border-[#E1E3E5] transition-all">
                  <ClipboardPaste className="w-3.5 h-3.5 text-[#35B94A]" /> Paste
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Button — one contextual CTA at a time (clean on mobile) */}
        <div className="mt-6 sm:mt-auto w-full">
          {(isIdle || isPreparing) && !isDone && (
            <button
              disabled={!canPrepare}
              onClick={handleCreateRoom}
              className={`w-full h-12 flex items-center justify-center gap-2 px-4 text-[14px] font-semibold rounded-full transition-all duration-200 ${
                !canPrepare
                  ? "bg-white/60 text-[#B0B4B8] border border-[#E1E3E5] cursor-not-allowed"
                  : "bg-black hover:bg-[#262626] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {isPreparing || isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isPreparing || isZipping ? (isZipping ? "Packaging…" : "Encrypting…") : "Generate Transfer Code"}
            </button>
          )}

          {!isIdle && !isPreparing && !isDone && (
            <button
              disabled={phase !== "key_exchange"}
              onClick={onStartSend}
              className={`w-full h-12 flex items-center justify-center gap-2 px-4 text-[14px] font-semibold rounded-full transition-all duration-200 ${
                phase !== "key_exchange"
                  ? "bg-white/60 text-[#8A8F93] border border-[#E1E3E5] cursor-wait"
                  : "bg-[#35B94A] hover:bg-[#2e9f3f] text-white shadow-[0_8px_20px_rgba(53,185,74,0.3)] hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {phase === "ready" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for receiver…</>
              ) : phase === "connecting" || phase === "transferring" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
              ) : (
                <><Wifi className="w-4 h-4" /> Begin P2P Transfer</>
              )}
            </button>
          )}
        </div>

      </div>

      {/* ── RIGHT PANEL: STATUS & DASHBOARD ── */}
      <div className="bg-white border border-[#E1E3E5] rounded-2xl overflow-hidden flex flex-col relative">

        {/* Connection Header */}
        <div className="px-5 py-3 border-b border-[#E1E3E5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isIdle ? "bg-[#8A8F93]" : isDone ? "bg-[#35B94A]" : "bg-[#E98B32] animate-pulse"}`} />
            <span className="text-[12px] font-medium text-on-surface-variant">Transfer connection</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#EEF6F2] px-2 py-0.5 rounded-full">
            <Shield className="w-3 h-3 text-[#35B94A]" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-[#2E9F3F]">E2E secured</span>
          </div>
        </div>

        {/* Dynamic Content Body */}
        <div className="flex-1 flex flex-col justify-center p-8 relative">
          
          <AnimatePresence mode="wait">
            {isIdle ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center text-center gap-3 py-6">
                <span className="icon-tile-lg w-14 h-14 relative">
                  <span className="absolute inset-0 rounded-2xl border-2 border-[#35B94A]/20 animate-[radar-spin_6s_linear_infinite] border-t-[#35B94A]/60" />
                  <Activity className="w-6 h-6 text-[#5F6368]" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-on-surface font-semibold text-[14px]">Awaiting payload</p>
                  <p className="text-on-surface-variant text-[12px] mt-1 max-w-[240px] leading-relaxed">Select files or text above and generate a transfer code to connect.</p>
                </div>
              </motion.div>
            ) : null}

            {otc && !isTransferring && !isDone && (
              <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center w-full">
                {/* OTC Display */}
                <div 
                  onClick={copyToClipboard}
                  className="w-full bg-[#F7F8F8] border border-[#E1E3E5] rounded-2xl p-6 mb-6 text-center relative group cursor-pointer hover:border-[#8A8F93] hover:bg-white active:scale-[0.99] transition-all duration-200 select-none"
                  title="Click to copy code"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#8A8F93]">Single-use connection code</span>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8A8F93] group-hover:text-black transition-colors duration-150">
                      {copied ? <Check className="w-3.5 h-3.5 text-[#35B94A]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </div>
                  </div>
                  <div className="font-mono text-[38px] leading-tight font-bold text-black tracking-[0.25em] mt-2 pl-[0.125em]">{otc}</div>
                </div>

                {/* QR Code */}
                <div className="bg-[#EEF6F2] p-3.5 rounded-[24px] border border-[#E1E3E5] shadow-sm">
                  {qrDataUrl ? (
                    <Image src={qrDataUrl} alt="QR Code" width={180} height={180} className="rounded-xl" />
                  ) : (
                    <div className="w-[180px] h-[180px] bg-[#F7F8F8] rounded-xl animate-pulse" />
                  )}
                </div>
                <p className="text-[12px] text-[#8A8F93] mt-4 text-center max-w-[220px]">Scan the QR with the receiving device to connect</p>
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
                        <span className="text-[11px] font-semibold text-[#35B94A] mt-1.5">Complete</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#35B94A] mt-1.5 animate-pulse">Sending…</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-[#F7F8F8] rounded-xl p-4 flex flex-col">
                    <span className="text-[11px] text-[#8A8F93] font-medium mb-1">Data transferred</span>
                    <span className="text-[15px] font-semibold text-black font-mono">{formatBytes(bytesTransferred)}</span>
                  </div>
                  <div className="bg-[#F7F8F8] rounded-xl p-4 flex flex-col">
                    <span className="text-[11px] text-[#8A8F93] font-medium mb-1">Transfer speed</span>
                    <span className="text-[15px] font-semibold text-[#35B94A] font-mono">{speedBps > 0 ? formatSpeed(speedBps) : "--"}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Persistent Status Bar at Bottom */}
        <div className="w-full px-4 py-3 border-t border-[#E1E3E5] shrink-0">
          <div className="flex items-center gap-2">
            {isPreparing ? <Loader2 className="w-3.5 h-3.5 text-[#35B94A] animate-spin" /> : <HardDrive className="w-3.5 h-3.5 text-[#8A8F93]" strokeWidth={1.75} />}
            <span className={`text-[12px] truncate ${phase === "error" ? "text-[#D9534F] font-medium" : "text-[#5F6368]"}`}>
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
      
    {/* ── NUDGE POPUP ── */}
    <AnimatePresence>
      {showNudge && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-8 right-8 z-[100] bg-white border border-[#E1E3E5] shadow-xl rounded-[24px] p-6 flex flex-col gap-5 w-full max-w-[340px]"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#EEF6F2] flex items-center justify-center border border-[#35B94A]/25 shrink-0 text-[#35B94A]">
                <Wifi className="w-5.5 h-5.5" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-black leading-tight">Receiver Connected!</h4>
                <p className="text-[12px] text-[#8A8F93] mt-1.5 leading-snug">Secure connection established. Click below to begin the transfer.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowNudge(false)} 
              className="text-[#8A8F93] hover:text-[#111111] transition-colors p-1 shrink-0 bg-[#F7F8F8] rounded-full border border-[#E1E3E5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              setShowNudge(false);
              onStartSend();
            }}
            className="w-full bg-black text-white hover:bg-[#262626] font-semibold text-[13px] h-11 rounded-xl transition-all"
          >
            Begin P2P Transfer
          </button>
        </motion.div>
      )}
    </AnimatePresence>

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
                Your payload has been successfully sent. The direct encrypted channel is now closed.
              </p>
            </div>
            
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => window.location.href = "/"}
                className="w-full bg-black text-white hover:bg-[#262626] font-semibold text-[14px] h-12 rounded-xl transition-all"
              >
                Send Another Payload
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
