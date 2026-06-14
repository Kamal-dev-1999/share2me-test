"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, Loader2, Wifi,
  ClipboardPaste, Type, FileUp, X, Shield, Activity, HardDrive, CheckCircle2
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in w-full">
      
      {/* ── LEFT PANEL: UPLOAD & CONTROLS ── */}
      <div className="flex flex-col gap-5">
        
        {/* Type Selector */}
        <div className="flex p-1 bg-background-elevated rounded-[14px] border border-border">
          <button
            onClick={() => setTransferType("file")}
            disabled={!isIdle}
            className={`flex-1 flex items-center justify-center gap-2 text-[14px] font-semibold py-2.5 rounded-[10px] transition-all
              ${transferType === "file" ? "bg-primary text-background shadow-soft" : "text-text-secondary hover:text-text-primary disabled:opacity-40"}`}
          >
            <FileUp className="w-[18px] h-[18px]" /> Files
          </button>
          <button
            onClick={() => setTransferType("text")}
            disabled={!isIdle}
            className={`flex-1 flex items-center justify-center gap-2 text-[14px] font-semibold py-2.5 rounded-[10px] transition-all
              ${transferType === "text" ? "bg-primary text-background shadow-soft" : "text-text-secondary hover:text-text-primary disabled:opacity-40"}`}
          >
            <Type className="w-[18px] h-[18px]" /> Text
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
              className={`relative bg-background-card rounded-[20px] border-2 border-dashed p-10 text-center transition-all duration-300 select-none
                ${!isIdle ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                ${files.length > 0 ? "border-primary/30" : ""}
              `}
            >
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} disabled={!isIdle} />
              
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-background-elevated border border-border flex items-center justify-center">
                  {files.length > 0 ? <FileText className="w-8 h-8 text-primary" /> : <Upload className="w-8 h-8 text-text-secondary" />}
                </div>
                <div>
                  <p className="text-text-primary text-[15px] font-semibold">
                    {files.length > 0 
                      ? (files.length === 1 ? files[0].name : `${files.length} files selected`) 
                      : "Drag & drop files here"}
                  </p>
                  <p className="text-text-secondary text-[13px] mt-1.5">
                    {files.length > 0 
                      ? `${formatBytes(files.reduce((acc, f) => acc + f.size, 0))} total size`
                      : "Up to 10 files · Max 1.5 GB total"}
                  </p>
                </div>
              </div>
            </div>

            {/* File List Queue */}
            <AnimatePresence>
              {files.length > 0 && isIdle && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-background-card px-4 py-3 rounded-xl border border-border group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                        <span className="text-[13px] text-text-primary truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-4 pl-3">
                        <span className="text-[12px] text-text-tertiary whitespace-nowrap">{formatBytes(f.size)}</span>
                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-text-tertiary hover:text-status-error transition-colors p-1 rounded-md hover:bg-status-error/10">
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
              placeholder="Paste or type any text here..."
              rows={8}
              className="w-full bg-background-card border border-border rounded-[20px] p-5 text-text-primary text-[14px] font-mono resize-y focus:outline-none focus:border-primary transition-colors placeholder:text-text-tertiary disabled:opacity-50"
            />
            <div className="absolute bottom-4 left-5 right-5 flex justify-between items-center">
              <span className="text-[12px] text-text-tertiary bg-background/50 backdrop-blur-sm px-2 py-1 rounded-md border border-border">
                {textInput.length.toLocaleString()} chars · {formatBytes(textBytes)}
              </span>
              {isIdle && textInput.length === 0 && (
                <button onClick={async () => { try { const t = await navigator.clipboard.readText(); setTextInput(t); } catch {} }} className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary bg-background/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 px-3 py-1.5 rounded-lg border border-border transition-all">
                  <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-row gap-3 mt-4 sm:mt-auto w-full">
          <button
            disabled={!canPrepare}
            onClick={handleCreateRoom}
            className={`flex-1 font-bold text-[14px] sm:text-[15px] h-[48px] rounded-xl flex items-center justify-center gap-2 whitespace-nowrap px-2 transition-all duration-200 ${
              !canPrepare
                ? "bg-background-elevated text-text-tertiary border border-border opacity-50 cursor-not-allowed"
                : "bg-primary text-background hover:bg-primary-hover hover:-translate-y-0.5 active:translate-y-0 shadow-glow border border-transparent"
            }`}
          >
            {isPreparing || isZipping ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {isPreparing || isZipping ? (isZipping ? "Packaging…" : "Encrypting…") : "Generate Code"}
          </button>
          
          <button
            disabled={phase !== "key_exchange"}
            onClick={onStartSend}
            className={`flex-1 font-bold text-[14px] sm:text-[15px] h-[48px] rounded-xl flex items-center justify-center gap-2 whitespace-nowrap px-2 transition-all duration-200 ${
              phase !== "key_exchange"
                ? "bg-background-elevated text-text-tertiary border border-border opacity-50 cursor-not-allowed"
                : "bg-primary text-background hover:bg-primary-hover hover:-translate-y-0.5 active:translate-y-0 shadow-glow border border-transparent"
            }`}
          >
            {phase === "ready" ? (
              <><Loader2 className="w-4 h-4 animate-spin hidden xs:block" /> Waiting for Receiver…</>
            ) : phase === "connecting" || phase === "transferring" ? (
              <><Loader2 className="w-4 h-4 animate-spin hidden xs:block" /> Connecting…</>
            ) : (
              <><Wifi className="w-4 h-4 hidden xs:block" /> Start Transfer</>
            )}
          </button>
        </div>

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
            <span className="text-[11px] font-semibold text-status-success">E2E Secured</span>
          </div>
        </div>

        {/* Dynamic Content Body */}
        <div className="flex-1 flex flex-col justify-center p-6 relative">
          
          <AnimatePresence mode="wait">
            {isIdle ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center text-center gap-4">
                <div className="w-20 h-20 rounded-full border border-border flex items-center justify-center bg-background/50">
                  <Activity className="w-8 h-8 text-text-tertiary" />
                </div>
                <div>
                  <p className="text-text-primary font-medium">Ready to Transfer</p>
                  <p className="text-text-tertiary text-[13px] mt-1 max-w-[200px]">Select files or text and generate a code to connect.</p>
                </div>
              </motion.div>
            ) : null}

            {otc && !isTransferring && !isDone && (
              <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center w-full">
                {/* OTC Display */}
                <div className="w-full bg-background border border-border rounded-[16px] p-5 mb-6 text-center">
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-[0.1em]">Share this code</span>
                  <div className="font-mono text-[40px] leading-tight font-bold text-primary tracking-[0.25em] mt-1">{otc}</div>
                </div>

                {/* QR Code */}
                <div className="bg-primary p-2 rounded-[20px] shadow-glow">
                  {qrDataUrl ? (
                    <Image src={qrDataUrl} alt="QR Code" width={200} height={200} className="rounded-xl" />
                  ) : (
                    <div className="w-[200px] h-[200px] bg-background-elevated rounded-xl animate-pulse" />
                  )}
                </div>
                <p className="text-[13px] text-text-secondary mt-5 font-medium">Scan QR with receiver device</p>
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
                        <span className="text-[12px] font-medium text-text-tertiary mt-1 uppercase tracking-wider">Sending</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-background border border-border rounded-xl p-4 flex flex-col">
                    <span className="text-[12px] text-text-tertiary font-medium mb-1">Transferred</span>
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
            {isPreparing ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <HardDrive className="w-4 h-4 text-text-tertiary" />}
            <span className={`text-[13px] font-medium truncate ${phase === "error" ? "text-status-error" : "text-text-secondary"}`}>
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
          className="fixed bottom-8 right-8 z-[100] bg-background-elevated border border-primary/50 shadow-[0_8px_32px_rgba(252,213,53,0.15)] rounded-[20px] p-6 flex flex-col gap-5 w-full max-w-[340px]"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-text-primary leading-tight">Receiver is Ready!</h4>
                <p className="text-[13px] text-text-secondary mt-1 leading-snug">Connection established. They are waiting for you to start.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowNudge(false)} 
              className="text-text-tertiary hover:text-text-primary transition-colors p-1 shrink-0 bg-background rounded-full border border-border"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              setShowNudge(false);
              onStartSend();
            }}
            className="w-full bg-primary text-background font-bold text-[14px] h-[44px] rounded-xl shadow-glow hover:-translate-y-0.5 transition-transform"
          >
            Start Transfer Now
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-background-card border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-[24px] p-8 flex flex-col items-center gap-5 w-full max-w-[400px] relative"
          >
            <button
              onClick={() => setShowCompletionPopup(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-background-elevated transition-colors text-text-secondary hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-20 h-20 rounded-full bg-status-success/20 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-10 h-10 text-status-success" />
            </div>
            <div className="text-center">
              <h3 className="text-[22px] font-bold text-text-primary">Transfer Completed!</h3>
              <p className="text-[14px] text-text-secondary mt-2">
                Your data has been successfully sent. The peer-to-peer connection is now closed.
              </p>
            </div>
            
            <div className="flex gap-3 w-full mt-4">
              <button
                onClick={() => window.location.href = "/"}
                className="w-full bg-primary text-background font-bold text-[15px] h-[48px] rounded-xl shadow-glow hover:-translate-y-0.5 transition-transform"
              >
                New Transfer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
