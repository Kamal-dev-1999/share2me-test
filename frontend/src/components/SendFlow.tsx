"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, CheckCircle2, Loader2, Wifi,
  ClipboardPaste, Type, FileUp,
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import { TransferPhase, SenderMeta } from "@/hooks/useTransfer";

interface Props {
  phase: TransferPhase;
  status: string;
  otc: string | null;
  meta: SenderMeta | null;
  progress: number;
  onCreateRoom:     (file: File)   => void;
  onCreateTextRoom: (text: string) => void;
  onStartSend:      () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type TransferType = "file" | "text";

export function SendFlow({
  phase, status, otc, meta, progress,
  onCreateRoom, onCreateTextRoom, onStartSend,
}: Props) {
  const [transferType, setTransferType] = useState<TransferType>("file");

  // ── File state ────────────────────────────────────────────────────────────
  const [file,     setFile]     = useState<File | null>(null);
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

  const handleFile = useCallback((f: File) => setFile(f), []);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const isIdle        = phase === "idle";
  const isPreparing   = phase === "preparing";
  const isReady       = phase === "ready" || phase === "key_exchange";
  const isTransferring= phase === "transferring";
  const isDone        = phase === "done";

  // ── Derived ───────────────────────────────────────────────────────────────
  const canPrepare = isIdle && (transferType === "file" ? !!file : textInput.trim().length > 0);
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
            ref={fileInputRef} type="file" className="hidden"
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
          onClick={() => {
            if (transferType === "file" && file) onCreateRoom(file);
            else if (transferType === "text" && textInput.trim()) onCreateTextRoom(textInput);
          }}
          className="flex-1 bg-primary text-ink font-semibold text-sm px-6 py-3 rounded-md
                     hover:bg-primary-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isPreparing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isPreparing
            ? (transferType === "text" ? "Encrypting text…" : "Encrypting…")
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

      {/* ── QR + Metadata ── */}
      {meta && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          {/* QR — shows as soon as OTC is known, encodes only 6-digit OTC */}
          <div className="sm:order-2 bg-surface-cardDark rounded-xl border border-hairline-dark p-4
                          flex flex-col items-center justify-center gap-3">
            {qrDataUrl
              ? <Image src={qrDataUrl} alt="Transfer QR" width={192} height={192} className="sm:w-[160px] sm:h-[160px] rounded-lg" />
              : <div className="w-48 h-48 sm:w-[160px] sm:h-[160px] bg-surface-elevatedDark rounded-lg animate-pulse" />
            }
            <p className="text-muted text-xs text-center">
              Scan to connect · OTC only · auto-syncs keys
            </p>
          </div>
          <div className="sm:order-1 bg-surface-cardDark rounded-xl border border-hairline-dark p-4">
            <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-3">
              {meta.textMode ? "Text Metadata (QR-safe)" : "File Metadata (QR-safe)"}
            </p>
            <textarea
              readOnly
              value={JSON.stringify(meta, null, 2)}
              className="w-full bg-transparent text-xs text-body font-mono resize-none h-32 scrollbar-hide outline-none"
            />
            <p className="text-muted text-xs mt-2">✓ Raw AES key not included</p>
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {(isTransferring || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex justify-between mb-2">
            <span className="text-white text-sm font-semibold">Transfer Progress</span>
            <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          {isDone && <p className="text-trading-up text-xs mt-3 font-semibold">✓ Transfer complete</p>}
        </div>
      )}

      {/* ── Status ── */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
