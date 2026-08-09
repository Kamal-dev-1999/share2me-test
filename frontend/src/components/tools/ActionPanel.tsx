"use client";

/**
 * ActionPanel — The post-processing action hub.
 *
 * Renders after a tool completes. Gives the user 4 choices:
 *   1. Download                — classic save to disk
 *   2. Share via P2P           — inject blob into P2P flow (no re-upload)
 *   3. Share via G2P Inbox     — upload to admin inbox
 *   4. Apply Another Tool      — chain tool operations
 *
 * Each action is isolated. Adding a new action = add a new <ActionCard>.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Zap, HardDrive, Wrench, CheckCircle2,
  TrendingDown, ArrowRight, Loader2, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProcessedOutput } from "@/hooks/useToolProcessor";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActionPanelProps {
  output: ProcessedOutput;
  onReset: () => void;
  onChainTool?: () => void;
}

type ActionStatus = "idle" | "loading" | "done" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${["B", "KB", "MB", "GB"][i]}`;
}

function compressionRatio(input: number, output: number): number | null {
  if (!input || !output || output >= input) return null;
  return Math.round(((input - output) / input) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActionCard({
  icon: Icon,
  label,
  description,
  status,
  onClick,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  status: ActionStatus;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  const isLoading = status === "loading";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      whileHover={{ scale: isLoading ? 1 : 1.02 }}
      whileTap={{ scale: isLoading ? 1 : 0.98 }}
      className={`
        w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4
        disabled:opacity-60 disabled:pointer-events-none
        ${variant === "primary"
          ? "border-ink bg-signal-yellow hover:bg-signal-yellow/80"
          : "border-hairline bg-surface hover:border-ink hover:bg-surface-container"
        }
        ${isDone ? "border-green-500 bg-green-50" : ""}
        ${isError ? "border-error bg-error-container" : ""}
      `}
    >
      <span className={`
        w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border-2
        ${variant === "primary" ? "border-ink bg-ink" : "border-hairline bg-surface-container-high"}
        ${isDone ? "border-green-500 bg-green-500" : ""}
      `}>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" strokeWidth={2} />
        ) : isDone ? (
          <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2} />
        ) : (
          <Icon
            className={`w-5 h-5 ${variant === "primary" ? "text-signal-yellow" : "text-on-surface"}`}
            strokeWidth={1.75}
          />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-on-surface leading-tight">{label}</p>
        <p className="text-[12px] text-on-surface-variant mt-0.5 leading-tight">
          {isError ? "Failed — try again" : isDone ? "Done!" : description}
        </p>
      </div>

      {!isLoading && !isDone && (
        <ArrowRight className="w-4 h-4 text-on-surface-variant shrink-0" strokeWidth={1.75} />
      )}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ActionPanel({ output, onReset, onChainTool }: ActionPanelProps) {
  const router = useRouter();
  const [downloadStatus, setDownloadStatus] = useState<ActionStatus>("idle");
  const [p2pStatus, setP2pStatus] = useState<ActionStatus>("idle");
  const [g2pStatus, setG2pStatus] = useState<ActionStatus>("idle");

  const ratio = compressionRatio(output.inputBytes, output.outputBytes);

  // ── Action: Download ─────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    setDownloadStatus("loading");
    try {
      const url = URL.createObjectURL(output.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = output.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a brief delay to allow the download to start
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDownloadStatus("done");
    } catch {
      setDownloadStatus("error");
    }
  }, [output]);

  // ── Action: P2P Share ────────────────────────────────────────────────────
  // Stores the blob in sessionStorage as a base64 URL, then navigates to /p2p.
  // SendFlow reads the `tool_output` sessionStorage key on mount.
  const handleP2PShare = useCallback(async () => {
    setP2pStatus("loading");
    try {
      // Convert blob to base64 data URL for sessionStorage (works for <50MB)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(output.blob);
      });

      // Store in sessionStorage — SendFlow will pick it up
      sessionStorage.setItem("share2me_tool_output", JSON.stringify({
        dataUrl,
        filename: output.filename,
        mimeType: output.mimeType,
        timestamp: Date.now(),
      }));

      setP2pStatus("done");
      // Short delay so user sees confirmation before navigation
      setTimeout(() => router.push("/p2p?source=tool"), 600);
    } catch {
      setP2pStatus("error");
    }
  }, [output, router]);

  // ── Action: G2P Share ────────────────────────────────────────────────────
  const handleG2PShare = useCallback(async () => {
    setG2pStatus("loading");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(output.blob);
      });

      sessionStorage.setItem("share2me_tool_output", JSON.stringify({
        dataUrl,
        filename: output.filename,
        mimeType: output.mimeType,
        timestamp: Date.now(),
      }));

      setG2pStatus("done");
      setTimeout(() => router.push("/g2p?source=tool"), 600);
    } catch {
      setG2pStatus("error");
    }
  }, [output, router]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 space-y-3"
      >
        {/* Result summary */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" strokeWidth={2} />
              <h3 className="text-[15px] font-semibold text-on-surface truncate max-w-[280px]">
                {output.filename}
              </h3>
            </div>
            <div className="flex items-center gap-3 mt-1 ml-7">
              <span className="text-[12px] text-on-surface-variant">
                {formatSize(output.outputBytes)}
              </span>
              {ratio !== null && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                  <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
                  −{ratio}%
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-[12px] font-medium text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            Start over
          </button>
        </div>

        {/* Divider */}
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest pt-1">
          What do you want to do?
        </p>

        {/* Action Cards */}
        <ActionCard
          icon={Download}
          label="Download file"
          description={`Save ${output.filename} to your device`}
          status={downloadStatus}
          onClick={handleDownload}
          variant="primary"
        />

        <ActionCard
          icon={Zap}
          label="Share via P2P"
          description="Instantly send to anyone — no account needed"
          status={p2pStatus}
          onClick={handleP2PShare}
        />

        <ActionCard
          icon={HardDrive}
          label="Send to G2P Inbox"
          description="Route to an admin inbox for printing or review"
          status={g2pStatus}
          onClick={handleG2PShare}
        />

        {onChainTool && (
          <ActionCard
            icon={Wrench}
            label="Apply another tool"
            description="Compress, watermark, protect — keep going"
            status="idle"
            onClick={onChainTool}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
