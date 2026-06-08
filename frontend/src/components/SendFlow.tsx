"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, CheckCircle2, Loader2, Wifi,
  ClipboardPaste, Type, FileUp,
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import * as fflate from "fflate";
import { TransferPhase } from "@/hooks/useTransfer";

/** Rolling 3-second window speed calculator */
function useTransferSpeed(bytesTransferred: number) {
  const history = useRef<{ bytes: number; ts: number }[]>([]);
  const [speedBps, setSpeedBps] = useState(0);
  useEffect(() => {
    const now = Date.now();
    history.current.push({ bytes: bytesTransferred, ts: now });
    // keep only last 3 seconds
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

function formatBytes(bytes: number) {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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

  // ── File state ────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Text state ────────────────────────────────────────────────────────────
  const [textInput, setTextInput] = useState("");

  // ── QR ────────────────────────────────────────────────────────────────────
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!otc) { setQrDataUrl(null); return; }
    // Encode ONLY the 6-digit OTC — keeps the QR tiny (version 1) and scannable
    // by any phone camera. Metadata is relayed automatically via the signaling server.
    QRCode.toDataURL(otc, {
      width: 220, margin: 2,
      errorCorrectionLevel: "H",   // highest redundancy — scannable even if partially obscured
      color: { dark: "#0b0e11", light: "#fcd535" },
    }).then(setQrDataUrl).catch(() => {});
  }, [otc]);  // regenerate only when OTC changes, not on every metadata update

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
            if (err) {
              alert("Failed to zip files");
              return;
            }
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

  const isIdle        = phase === "idle";
  const isPreparing   = phase === "preparing";
  const isReady       = phase === "ready" || phase === "key_exchange";
  const isTransferring= phase === "transferring";
  const isDone        = phase === "done";

  // ── Derived ───────────────────────────────────────────────────────────────
  const canPrepare = isIdle && !isZipping && (transferType === "file" ? files.length > 0 : textInput.trim().length > 0);
  const textBytes  = new TextEncoder().encode(textInput).length;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Transfer type tabs ── */}
      <div className="flex items-center bg-surface-elevatedDark border border-hairline-dark rounded-xl p-1">
        <button
          onClick={() => setTransferType("file")}
          disabled={!isIdle}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-lg transition-all
            ${transferType === "file"
              ? "bg-primary text-ink shadow-sm"
              : "text-muted hover:text-white disabled:opacity-40"}`}
        >
          <FileUp className="w-4 h-4" />
          File
        </button>
        <button
          onClick={() => setTransferType("text")}
          disabled={!isIdle}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-lg transition-all
            ${transferType === "text"
              ? "bg-primary text-ink shadow-sm"
              : "text-muted hover:text-white disabled:opacity-40"}`}
        >
          <Type className="w-4 h-4" />
          Text
        </button>
      </div>

      {/* ── FILE MODE: drop zone ── */}
      {transferType === "file" && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => isIdle && fileInputRef.current?.click()}
            className={`
              relative bg-surface-cardDark rounded-xl border-2 border-dashed p-8 text-center
              transition-all duration-200 select-none
              ${!isIdle ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              ${dragging ? "border-primary bg-primary/5" : "border-hairline-dark hover:border-primary/50"}
              ${files.length > 0 ? "border-primary/30" : ""}
            `}
          >
            <input
              ref={fileInputRef} type="file" className="hidden" multiple
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
              disabled={!isIdle}
            />
            {files.length > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {files.length === 1 ? files[0].name : `${files.length} files selected`}
                  </p>
                  <p className="text-muted text-xs mt-0.5">
                    {formatBytes(files.reduce((acc, f) => acc + f.size, 0))} total
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-surface-elevatedDark flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Drop files here or click to browse</p>
                  <p className="text-muted text-xs mt-1">Up to 10 files · Max 1.5 GB total</p>
                </div>
              </div>
            )}
          </div>
          
          {/* File List */}
          {files.length > 0 && isIdle && (
            <div className="bg-surface-elevatedDark rounded-xl p-3 max-h-40 overflow-y-auto border border-hairline-dark space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-surface-cardDark px-3 py-2 rounded-lg border border-hairline-light">
                  <span className="text-xs text-white truncate max-w-[70%]">{f.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">{formatBytes(f.size)}</span>
                    <button
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="text-muted hover:text-trading-down transition-colors text-lg leading-none"
                      title="Remove file"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEXT MODE: textarea ── */}
      {transferType === "text" && (
        <div className="relative">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={!isIdle}
            placeholder="Paste or type any text here — any length, any language, any formatting…"
            rows={7}
            className="w-full bg-surface-cardDark border border-hairline-dark rounded-xl
                       px-4 py-3 text-white text-sm font-mono resize-y leading-relaxed
                       focus:outline-none focus:border-primary transition-colors
                       placeholder:text-muted placeholder:font-sans
                       disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-xs text-muted">
              {textInput.length.toLocaleString()} chars · {formatBytes(textBytes)}
            </span>
            {textInput.length > 0 && isIdle && (
              <button
                onClick={() => setTextInput("")}
                className="text-xs text-muted hover:text-trading-down transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {/* Paste from clipboard button */}
          {isIdle && textInput.length === 0 && (
            <button
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  setTextInput(t);
                } catch { /* permission denied, let user type */ }
              }}
              className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-muted
                         bg-surface-elevatedDark hover:bg-primary/10 hover:text-primary
                         px-2.5 py-1.5 rounded-lg border border-hairline-dark transition-colors"
            >
              <ClipboardPaste className="w-3 h-3" />
              Paste
            </button>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          disabled={!canPrepare}
          onClick={handleCreateRoom}
          className="flex-1 bg-primary text-ink font-semibold text-sm px-6 py-3 rounded-md
                     hover:bg-primary-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isPreparing || isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isPreparing || isZipping
            ? (isZipping ? "Packaging files…" : transferType === "text" ? "Encrypting text…" : "Encrypting…")
            : (transferType === "text" ? "Create OTC & Encrypt Text" : "Create OTC & Prepare")}
        </button>
        <button
          disabled={!isReady && !isTransferring}
          onClick={onStartSend}
          className="flex-1 bg-surface-cardDark text-white font-semibold text-sm px-6 py-3 rounded-md
                     border border-hairline-dark hover:border-primary/50 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          <Wifi className="w-4 h-4" />
          Start WebRTC Send
        </button>
      </div>

      {/* ── OTC display ── */}
      {otc && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider">One-Time Code</span>
            <CheckCircle2 className="w-4 h-4 text-trading-up" />
          </div>
          <div className="font-mono text-4xl font-bold text-primary tracking-[0.15em]">{otc}</div>
          <p className="text-muted text-xs mt-2">Share this code with the receiver</p>
        </div>
      )}

      {/* ── QR ── */}
      {otc && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-6 animate-fade-in
                        flex flex-col items-center justify-center gap-4">
          {qrDataUrl
            ? <Image src={qrDataUrl} alt="Transfer QR" width={220} height={220} className="rounded-xl" />
            : <div className="w-[220px] h-[220px] bg-surface-elevatedDark rounded-xl animate-pulse" />
          }
          <div className="text-center">
            <p className="text-white font-mono text-3xl font-bold tracking-[0.2em] mb-1">{otc}</p>
            <p className="text-muted text-xs">Scan QR or share the code · keys sync automatically</p>
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {(isTransferring || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white text-sm font-semibold">Transfer Progress</span>
            <div className="flex items-center gap-3">
              {isTransferring && speedBps > 0 && (
                <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  ↑ {formatSpeed(speedBps)}
                </span>
              )}
              <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-muted text-xs">{formatBytes(bytesTransferred)} sent</span>
            {isDone && <span className="text-trading-up text-xs font-semibold">✓ Transfer complete</span>}
          </div>
        </div>
      )}

      {/* ── Status ── */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
