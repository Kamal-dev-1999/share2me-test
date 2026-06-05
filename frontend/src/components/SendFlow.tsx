"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, Loader2, Wifi } from "lucide-react";
import QRCode from "qrcode";
import { TransferPhase, SenderMeta } from "@/hooks/useTransfer";

interface Props {
  phase: TransferPhase;
  status: string;
  otc: string | null;
  meta: SenderMeta | null;
  progress: number;
  onCreateRoom: (file: File) => void;
  onStartSend: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function SendFlow({ phase, status, otc, meta, progress, onCreateRoom, onStartSend }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate QR from metadata
  useEffect(() => {
    if (!meta) { setQrDataUrl(null); return; }
    const payload = JSON.stringify(meta);
    QRCode.toDataURL(payload, { width: 220, margin: 1, color: { dark: "#0b0e11", light: "#fcd535" } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [meta]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const isIdle = phase === "idle";
  const isPreparing = phase === "preparing";
  const isReady = phase === "ready" || phase === "key_exchange";
  const isTransferring = phase === "transferring";
  const isDone = phase === "done";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative bg-surface-cardDark rounded-xl border-2 border-dashed p-8 text-center cursor-pointer
          transition-all duration-200 select-none
          ${dragging ? "border-primary bg-primary/5" : "border-hairline-dark hover:border-primary/50"}
          ${file ? "border-primary/30" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{file.name}</p>
              <p className="text-muted text-xs mt-0.5">{formatBytes(file.size)}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-surface-elevatedDark flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-muted text-xs mt-1">Any file type · Any size</p>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          disabled={!file || !isIdle}
          onClick={() => file && onCreateRoom(file)}
          className="flex-1 bg-primary text-ink font-semibold text-sm px-6 py-3 rounded-md
                     hover:bg-primary-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isPreparing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isPreparing ? "Encrypting…" : "Create OTC & Prepare"}
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

      {/* OTC display */}
      {otc && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider">One-Time Code</span>
            <CheckCircle2 className="w-4 h-4 text-trading-up" />
          </div>
          <div className="font-mono text-4xl font-bold text-primary tracking-[0.15em]">
            {otc}
          </div>
          <p className="text-muted text-xs mt-2">Share this code with the receiver</p>
        </div>
      )}

      {/* QR + Metadata */}
      {meta && (
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-4">
            <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-3">Metadata (QR-safe)</p>
            <textarea
              readOnly
              value={JSON.stringify(meta, null, 2)}
              className="w-full bg-transparent text-xs text-body font-mono resize-none h-36 scrollbar-hide outline-none"
            />
            <p className="text-muted text-xs mt-2">✓ Raw AES key not included</p>
          </div>
          <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-4 flex flex-col items-center justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Transfer QR" className="w-[160px] h-[160px] rounded-lg" />
            ) : (
              <div className="w-[160px] h-[160px] bg-surface-elevatedDark rounded-lg animate-pulse" />
            )}
            <p className="text-muted text-xs mt-3">Scan with receiver</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(isTransferring || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex justify-between mb-2">
            <span className="text-white text-sm font-semibold">Transfer Progress</span>
            <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isDone && <p className="text-trading-up text-xs mt-3 font-semibold">✓ Transfer complete</p>}
        </div>
      )}

      {/* Status */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
