"use client";
import { useState } from "react";
import { Download, Key, Loader2, CheckCircle2, Copy, Check } from "lucide-react";
import { TransferPhase } from "@/hooks/useTransfer";

interface Props {
  phase: TransferPhase;
  status: string;
  keyStatus: "pending" | "generated" | "ready";
  progress: number;
  receivedText: string | null;
  onJoin: (otc: string) => Promise<void>;
}

const KEY_STATUS_STYLES = {
  pending: "text-muted",
  generated: "text-primary",
  ready: "text-trading-up",
};

const KEY_STATUS_LABELS = {
  pending: "Key: pending",
  generated: "Key: generated",
  ready: "Key: ready ✓",
};

export function ReceiveFlow({ phase, status, keyStatus, progress, receivedText, onJoin }: Props) {
  const [otc, setOtc]     = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied]   = useState(false);

  const handleJoin = async () => {
    if (!otc.trim()) return;
    setJoining(true);
    try { await onJoin(otc.trim()); } finally { setJoining(false); }
  };

  const isIdle = phase === "idle";
  const isReady = phase === "ready";      // joined, waiting for sender metadata
  const isExchange = phase === "key_exchange";
  const isTransfer = phase === "transferring";
  const isDone = phase === "done";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* OTC input */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          One-Time Code
        </label>
        {/* OTC input — stacks on very narrow screens */}
        <div className="flex flex-col xs:flex-row gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={otc}
            onChange={(e) => setOtc(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="flex-1 bg-surface-cardDark border border-hairline-dark rounded-lg
                       px-4 py-3 text-white font-mono text-xl tracking-[0.25em] placeholder:text-muted
                       focus:outline-none focus:border-primary transition-colors"
          />
          <button
            disabled={otc.length !== 6 || joining || !isIdle}
            onClick={handleJoin}
            className="w-full xs:w-auto bg-primary text-ink font-semibold text-sm px-6 py-3 rounded-md
                       hover:bg-primary-active transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Join Room
          </button>
        </div>
      </div>

      {/* Key status badge */}
      {phase !== "idle" && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Key className={`w-4 h-4 ${KEY_STATUS_STYLES[keyStatus]}`} />
          <span className={`text-sm font-semibold ${KEY_STATUS_STYLES[keyStatus]}`}>
            {KEY_STATUS_LABELS[keyStatus]}
          </span>
          {isExchange && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin ml-1" />}
        </div>
      )}

      {/* After joining — waiting for sender metadata to auto-arrive via socket */}
      {isReady && (
        <div className="bg-surface-cardDark border border-primary/20 rounded-xl p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            <span className="text-white font-semibold text-sm">Waiting for sender…</span>
          </div>
          <p className="text-muted text-xs leading-relaxed">
            Connected to room. Encryption keys will sync automatically once the sender is ready.
            No manual steps needed.
          </p>
        </div>
      )}

      {/* Progress */}
      {(isTransfer || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span className="text-white text-sm font-semibold">
                {receivedText !== null ? "Receiving Text" : "Receiving File"}
              </span>
            </div>
            <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div
              className="h-full bg-trading-up rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isDone && !receivedText && (
            <div className="flex items-center gap-2 mt-3">
              <CheckCircle2 className="w-4 h-4 text-trading-up" />
              <span className="text-trading-up text-sm font-semibold">File received — download started</span>
            </div>
          )}
        </div>
      )}

      {/* Received text result */}
      {receivedText !== null && isDone && (
        <div className="bg-surface-cardDark rounded-xl border border-trading-up/30 p-5 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-trading-up" />
              <span className="text-trading-up text-sm font-semibold">Text received</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted text-xs">
                {receivedText.length.toLocaleString()} chars
              </span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(receivedText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                            border transition-all duration-200
                            ${copied
                    ? "text-trading-up border-trading-up/40 bg-trading-up/10"
                    : "text-primary border-primary/30 bg-primary/10 hover:bg-primary/20"
                  }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy All"}
              </button>
            </div>
          </div>

          {/* Scrollable text display */}
          <div className="relative">
            <textarea
              readOnly
              value={receivedText}
              rows={10}
              className="w-full bg-surface-elevatedDark border border-hairline-dark rounded-xl
                         px-4 py-3 text-white text-sm font-mono resize-y leading-relaxed
                         focus:outline-none focus:border-primary/30 transition-colors
                         scrollbar-hide"
            />
          </div>

          <p className="text-muted text-xs mt-2">
            Text decoded from UTF-8 · formatting preserved · AES-GCM-256 decrypted
          </p>
        </div>
      )}

      {/* Status */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
