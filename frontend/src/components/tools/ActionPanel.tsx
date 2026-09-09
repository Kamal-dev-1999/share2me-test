"use client";

/**
 * ActionPanel — Post-processing action hub.
 * Appears after any tool completes.
 *
 * v3 fixes:
 *  - Canvas-based PDF preview using pdfjs-dist (eliminates Chrome iframe plugin blocking).
 *  - IndexedDB tool output store (saveToolOutput) for 1GB+ direct P2P and G2P transfers.
 *  - Fixed garbled UTF-8 characters across cards and modals.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Zap, HardDrive, Wrench, CheckCircle2,
  TrendingDown, Loader2, Eye, X, ExternalLink, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProcessedOutput } from "@/hooks/useToolProcessor";
import { renderPdfToCanvases, type RenderedPage } from "@/lib/pdfRender";
import { saveToolOutput } from "@/lib/toolOutputStore";

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
// Preview Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TextPreview({ objectUrl }: { objectUrl: string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    fetch(objectUrl)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("Could not load text."));
  }, [objectUrl]);

  return (
    <div className="h-full overflow-auto p-6">
      <pre
        style={{
          fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
          fontSize: "13px",
          lineHeight: 1.6,
          color: "#1A1A1A",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "#FAFAFA",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #E1E3E5",
        }}
      >
        {text || "Loading…"}
      </pre>
    </div>
  );
}

function PageCanvas({ page, pageNum, totalPages }: { page: RenderedPage; pageNum: number; totalPages: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    el.innerHTML = "";
    page.canvas.style.maxWidth = "100%";
    page.canvas.style.height = "auto";
    page.canvas.style.display = "block";
    page.canvas.style.margin = "0 auto";
    page.canvas.style.borderRadius = "4px";
    el.appendChild(page.canvas);
  }, [page]);

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-[#E1E3E5] overflow-hidden max-w-full flex flex-col items-center">
      <div ref={mountRef} className="max-w-full overflow-x-auto p-3 bg-white" />
      <div className="w-full bg-[#F7F8F8] border-t border-[#E1E3E5] py-1.5 px-3 text-center text-[11px] font-medium text-[#5F6368]">
        Page {pageNum} of {totalPages}
      </div>
    </div>
  );
}

function PdfPreview({ blob, objectUrl, filename }: { blob: Blob; objectUrl: string; filename: string }) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setUseIframeFallback(false);
      try {
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        const res = await renderPdfToCanvases(
          buffer,
          1.5,
          (done, total) => {
            if (!cancelled) setProgress({ done, total });
          },
          50
        );
        if (cancelled) return;
        setPages(res.pages);
        setTotalPages(res.totalPages);
        setLoading(false);
      } catch (err) {
        console.warn("Canvas PDF rendering failed, falling back to iframe:", err);
        if (!cancelled) {
          setUseIframeFallback(true);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (useIframeFallback) {
    return (
      <iframe
        src={`${objectUrl}#toolbar=1&navpanes=0`}
        title={`Preview — ${filename}`}
        className="w-full h-full border-0"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[#5F6368]">
        <Loader2 className="w-7 h-7 animate-spin text-[#111]" strokeWidth={2} />
        <p className="text-[13px] font-medium">
          {progress.total > 0
            ? `Rendering page ${progress.done} of ${progress.total}…`
            : "Rendering document preview…"}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 flex flex-col items-center gap-4">
      {pages.map((p, idx) => (
        <PageCanvas key={idx} page={p} pageNum={idx + 1} totalPages={totalPages} />
      ))}
      {totalPages > pages.length && (
        <p className="text-[12px] text-[#5F6368] py-2">
          Showing first {pages.length} of {totalPages} pages. Download file for complete document.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview Modal
// ─────────────────────────────────────────────────────────────────────────────

function PreviewModal({ output, onClose }: { output: ProcessedOutput; onClose: () => void }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(output.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [output.blob]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isImage = output.mimeType.startsWith("image/");
  const isPdf = output.mimeType === "application/pdf";
  const isText =
    output.mimeType === "text/plain" ||
    output.mimeType === "text/markdown" ||
    output.filename.endsWith(".md");
  const isOffice =
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ].includes(output.mimeType) || Boolean(output.filename.match(/\.(docx|xlsx|pptx)$/i));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden flex flex-col"
        style={{
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          width: "min(880px, 95vw)",
          height: "min(680px, 90vh)",
        }}
      >
        {/* Header */}
        <div
          style={{ borderBottom: "1px solid #E1E3E5", background: "#F7F8F8" }}
          className="flex items-center justify-between px-5 py-3 shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ background: "#111", borderRadius: "10px" }}
              className="w-8 h-8 flex items-center justify-center shrink-0"
            >
              <Eye className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: "#111" }}>
                {output.filename}
              </p>
              <p className="text-[11px] leading-tight" style={{ color: "#5F6368" }}>
                {formatSize(output.outputBytes)} · Read-only preview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {objectUrl && (
              <a
                href={objectUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                aria-label="Open preview in new tab"
                style={{ background: "#fff", border: "1px solid #E1E3E5", borderRadius: "8px" }}
                className="w-8 h-8 flex items-center justify-center transition-colors hover:bg-gray-100"
              >
                <ExternalLink className="w-3.5 h-3.5" style={{ color: "#5F6368" }} strokeWidth={2} />
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close preview"
              style={{ background: "#fff", border: "1px solid #E1E3E5", borderRadius: "8px" }}
              className="w-8 h-8 flex items-center justify-center transition-colors hover:bg-gray-100"
            >
              <X className="w-4 h-4" style={{ color: "#5F6368" }} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden" style={{ background: "#EAEDF0" }}>
          {!objectUrl ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#5F6368" }} strokeWidth={2} />
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full p-6 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={output.filename}
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
              />
            </div>
          ) : isText ? (
            <TextPreview objectUrl={objectUrl} />
          ) : isOffice ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div
                style={{
                  background: "#F0FDF4",
                  borderRadius: "16px",
                  padding: "24px 32px",
                  textAlign: "center",
                  border: "1px solid #BBF7D0",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                  {output.filename.endsWith(".docx") ? "📄" : output.filename.endsWith(".xlsx") ? "📊" : "📊"}
                </div>
                <p style={{ color: "#065F46", fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
                  Office file ready!
                </p>
                <p style={{ color: "#059669", fontSize: "13px" }}>
                  Download the file to open it in Microsoft Office, Google Docs, or LibreOffice.
                </p>
              </div>
            </div>
          ) : isPdf ? (
            <PdfPreview blob={output.blob} objectUrl={objectUrl} filename={output.filename} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No preview available for this file type.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{ borderTop: "1px solid #E1E3E5", background: "#fff" }}
          className="flex items-center justify-between px-5 py-3 shrink-0"
        >
          <p className="text-[11px]" style={{ color: "#8A8F93" }}>
            Preview only — your file is still in your browser
          </p>
          <button
            onClick={onClose}
            style={{ background: "#111", color: "#fff", borderRadius: "8px" }}
            className="px-4 py-1.5 text-[13px] font-medium hover:opacity-80 transition-opacity"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary Action Card
// ─────────────────────────────────────────────────────────────────────────────

function SecondaryCard({
  icon: Icon,
  label,
  description,
  status,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  status: ActionStatus;
  onClick: () => void;
}) {
  const isLoading = status === "loading";
  const isDone = status === "done";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      whileHover={{ scale: isLoading ? 1 : 1.012 }}
      whileTap={{ scale: isLoading ? 1 : 0.987 }}
      className="w-full text-left flex items-center gap-3.5 p-4 rounded-xl transition-all disabled:opacity-60"
      style={{
        background: isDone ? "#ECFDF5" : "#fff",
        border: isDone ? "1px solid #6EE7B7" : "1px solid #E1E3E5",
      }}
      onMouseEnter={(e) => {
        if (!isDone && !isLoading) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#111";
          (e.currentTarget as HTMLButtonElement).style.background = "#F7F8F8";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDone && !isLoading) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#E1E3E5";
          (e.currentTarget as HTMLButtonElement).style.background = "#fff";
        }
      }}
    >
      {/* Icon */}
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
        style={{ background: "#F7F8F8", borderColor: "#E1E3E5" }}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#5F6368" }} strokeWidth={2} />
        ) : isDone ? (
          <CheckCircle2 className="w-5 h-5" style={{ color: "#10B981" }} strokeWidth={2} />
        ) : (
          <Icon className="w-5 h-5" style={{ color: "#111" }} strokeWidth={1.75} />
        )}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-tight" style={{ color: isDone ? "#065F46" : "#111" }}>
          {label}
        </p>
        <p className="text-[12px] mt-0.5 leading-tight" style={{ color: isDone ? "#059669" : "#5F6368" }}>
          {isDone ? "Done!" : description}
        </p>
      </div>

      {/* Arrow */}
      {!isLoading && (
        <svg
          className="w-4 h-4 shrink-0"
          style={{ color: "#8A8F93" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
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
  const [showPreview, setShowPreview] = useState(false);

  const ratio = compressionRatio(output.inputBytes, output.outputBytes);

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
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDownloadStatus("done");
    } catch {
      setDownloadStatus("error");
    }
  }, [output]);

  const handleP2PShare = useCallback(async () => {
    setP2pStatus("loading");
    try {
      await saveToolOutput(output);
      setP2pStatus("done");
      setTimeout(() => router.push("/p2p?source=tool"), 600);
    } catch (err) {
      console.error("Failed to share via P2P:", err);
      setP2pStatus("error");
    }
  }, [output, router]);

  const handleG2PShare = useCallback(async () => {
    setG2pStatus("loading");
    try {
      await saveToolOutput(output);
      setG2pStatus("done");
      setTimeout(() => router.push("/g2p/nearby?source=tool"), 600);
    } catch (err) {
      console.error("Failed to share via G2P:", err);
      setG2pStatus("error");
    }
  }, [output, router]);

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 space-y-2.5"
        >
          {/* Result summary bar */}
          <div className="flex items-center justify-between gap-3 px-0.5 mb-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "#10B981" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-tight truncate" style={{ color: "#111" }}>
                  {output.filename}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px]" style={{ color: "#5F6368" }}>
                    {formatSize(output.outputBytes)}
                  </span>
                  {ratio !== null && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "#065F46", background: "#ECFDF5" }}
                    >
                      <TrendingDown className="w-2.5 h-2.5" strokeWidth={2.5} />
                      −{ratio}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onReset}
              className="text-[12px] font-medium transition-colors shrink-0 whitespace-nowrap"
              style={{ color: "#8A8F93" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8A8F93")}
            >
              Start over
            </button>
          </div>

          {/* Section label */}
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] px-0.5" style={{ color: "#8A8F93" }}>
            What do you want to do?
          </p>

          {/* Primary row: Download + Preview */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Download */}
            <motion.button
              type="button"
              onClick={handleDownload}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col gap-3 p-4 rounded-xl border text-left transition-all"
              style={{
                background: downloadStatus === "done" ? "#ECFDF5" : "#111",
                borderColor: downloadStatus === "done" ? "#6EE7B7" : "#111",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border"
                style={{
                  background: downloadStatus === "done" ? "#10B981" : "rgba(255,255,255,0.12)",
                  borderColor: downloadStatus === "done" ? "#10B981" : "rgba(255,255,255,0.2)",
                }}
              >
                {downloadStatus === "loading" ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin text-white" strokeWidth={2} />
                ) : (
                  <Download className="w-4.5 h-4.5 text-white" strokeWidth={2} />
                )}
              </div>
              <div>
                <p
                  className="text-[13px] font-semibold leading-tight"
                  style={{ color: downloadStatus === "done" ? "#065F46" : "#fff" }}
                >
                  {downloadStatus === "done" ? "Downloaded!" : "Download"}
                </p>
                <p
                  className="text-[11px] mt-0.5 leading-tight"
                  style={{ color: downloadStatus === "done" ? "#059669" : "rgba(255,255,255,0.6)" }}
                >
                  {downloadStatus === "done" ? "Saved to device" : "Save to your device"}
                </p>
              </div>
            </motion.button>

            {/* Preview */}
            <motion.button
              type="button"
              onClick={() => setShowPreview(true)}
              whileHover={{ scale: 1.02, borderColor: "#7C3AED", backgroundColor: "rgba(124,58,237,0.04)" }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col gap-3 p-4 rounded-xl border text-left transition-all"
              style={{ background: "#fff", borderColor: "#E1E3E5" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border"
                style={{ background: "#EDE9FE", borderColor: "#DDD6FE" }}
              >
                <Eye className="w-4.5 h-4.5" style={{ color: "#7C3AED" }} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: "#111" }}>
                  Preview
                </p>
                <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "#5F6368" }}>
                  Inspect before sharing
                </p>
              </div>
            </motion.button>
          </div>

          {/* Secondary actions */}
          <SecondaryCard
            icon={Zap}
            label="Share via P2P"
            description="Instantly send to anyone — no account needed"
            status={p2pStatus}
            onClick={handleP2PShare}
          />

          <SecondaryCard
            icon={HardDrive}
            label="Send to G2P Inbox"
            description="Route to a nearby print shop or admin inbox"
            status={g2pStatus}
            onClick={handleG2PShare}
          />

          {onChainTool && (
            <SecondaryCard
              icon={Wrench}
              label="Apply another tool"
              description="Compress, watermark, protect — keep going"
              status="idle"
              onClick={onChainTool}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Preview Modal */}
      {showPreview && <PreviewModal output={output} onClose={() => setShowPreview(false)} />}
    </>
  );
}

