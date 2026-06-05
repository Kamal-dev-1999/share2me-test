"use client";
import { useState } from "react";
import { Download, Key, Loader2, CheckCircle2 } from "lucide-react";
import { TransferPhase } from "@/hooks/useTransfer";

interface Props {
  phase: TransferPhase;
  status: string;
  keyStatus: "pending" | "generated" | "ready";
  progress: number;
  onJoin: (otc: string) => Promise<void>;
  onImport: (json: string) => void;
}

const KEY_STATUS_STYLES = {
  pending:   "text-muted",
  generated: "text-primary",
  ready:     "text-trading-up",
};

const KEY_STATUS_LABELS = {
  pending:   "Key: pending",
  generated: "Key: generated",
  ready:     "Key: ready ✓",
};

export function ReceiveFlow({ phase, status, keyStatus, progress, onJoin, onImport }: Props) {
  const [otc, setOtc] = useState("");
  const [metaJson, setMetaJson] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!otc.trim()) return;
    setJoining(true);
    try { await onJoin(otc.trim()); } finally { setJoining(false); }
  };

  const isIdle     = phase === "idle";
  const isReady    = phase === "ready";
  const isExchange = phase === "key_exchange";
  const isTransfer = phase === "transferring";
  const isDone     = phase === "done";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* OTC input */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          One-Time Code
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={otc}
            onChange={(e) => setOtc(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="flex-1 bg-surface-cardDark border border-hairline-dark rounded-lg
                       px-4 py-3 text-white font-mono text-lg tracking-[0.2em] placeholder:text-muted
                       focus:outline-none focus:border-primary transition-colors"
          />
          <button
            disabled={otc.length !== 6 || joining || !isIdle}
            onClick={handleJoin}
            className="bg-primary text-ink font-semibold text-sm px-6 py-3 rounded-md
                       hover:bg-primary-active transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center gap-2 whitespace-nowrap"
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

      {/* Metadata input */}
      {(isReady || isExchange || isTransfer || isDone) && (
        <div className="animate-fade-in">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Sender Metadata JSON
          </label>
          <textarea
            value={metaJson}
            onChange={(e) => setMetaJson(e.target.value)}
            placeholder='Paste the sender metadata JSON here…'
            rows={5}
            className="w-full bg-surface-cardDark border border-hairline-dark rounded-lg
                       px-4 py-3 text-white text-xs font-mono resize-none
                       focus:outline-none focus:border-primary transition-colors
                       placeholder:text-muted"
          />
          <button
            disabled={!metaJson.trim() || isTransfer || isDone}
            onClick={() => onImport(metaJson)}
            className="mt-3 w-full bg-surface-elevatedDark text-white font-semibold text-sm px-6 py-3 rounded-md
                       border border-hairline-dark hover:border-primary/50 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4 text-primary" />
            Import Metadata &amp; Start Key Exchange
          </button>
        </div>
      )}

      {/* Progress */}
      {(isTransfer || isDone) && (
        <div className="bg-surface-cardDark rounded-xl border border-hairline-dark p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span className="text-white text-sm font-semibold">Receiving File</span>
            </div>
            <span className="text-primary font-mono text-sm font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-elevatedDark rounded-full overflow-hidden">
            <div
              className="h-full bg-trading-up rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isDone && (
            <div className="flex items-center gap-2 mt-3">
              <CheckCircle2 className="w-4 h-4 text-trading-up" />
              <span className="text-trading-up text-sm font-semibold">File received — download started</span>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div className="bg-surface-elevatedDark rounded-lg px-4 py-3 text-sm text-muted min-h-[44px] flex items-center">
        <span className={phase === "error" ? "text-trading-down" : ""}>{status}</span>
      </div>
    </div>
  );
}
