"use client";

/**
 * PdfToolShell — The unified page shell for all 31 tools.
 *
 * Architecture:
 *  - Consumes useToolProcessor (hook → worker microservice)
 *  - Renders DropZone, FileList, ToolConfigPanel (optional), JobProgress, ActionPanel
 *  - Is completely stateless about which tool it runs — slug drives everything
 *
 * Adding a new tool = update TOOL_HANDLERS in the worker + tool registry.
 *   This component doesn't change.
 */

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, Upload, X, FileText,
  Sparkles, ShieldCheck, Loader2, AlertCircle,
} from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { categoryLabel } from "@/lib/pdfTools";
import { useRouter } from "next/navigation";
import { useToolProcessor } from "@/hooks/useToolProcessor";
import { ActionPanel } from "@/components/tools/ActionPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PdfToolShellProps {
  tool: PdfTool;
  /** Optional per-tool config UI rendered in the sidebar */
  configSidebar?: React.ReactNode;
  /**
   * Tool-specific configuration values to pass to the worker.
   * Controlled by the parent page's configSidebar state.
   */
  toolConfig?: Record<string, unknown>;
  /** Allow multiple files (defaults to true for merge-like tools) */
  multiple?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${["B", "KB", "MB", "GB"][i]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PdfToolShell({
  tool,
  configSidebar,
  toolConfig = {},
  multiple = true,
}: PdfToolShellProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showChainPicker, setShowChainPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { status, progress, progressMessage, output, error, process, reset, isWorkerSupported } =
    useToolProcessor(tool.slug);

  const Icon = tool.icon;
  const isReady = tool.phase === "ready";
  const isProcessing = status === "processing" || status === "loading";
  const isDone = status === "complete";

  // ── File management ───────────────────────────────────────────────────────

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);

      // MIME type validation
      const valid = list.filter((f) => {
        if (!tool.accept || tool.accept.length === 0) return true;
        return tool.accept.some((mime) => {
          if (mime.endsWith("/*")) return f.type.startsWith(mime.slice(0, -1));
          return f.type === mime;
        });
      });

      if (valid.length < list.length) {
        // Silently skip invalid files — could show a toast here
        console.warn("[PdfToolShell] Some files were skipped due to invalid type.");
      }

      setFiles((prev) => (multiple ? [...prev, ...valid] : valid.slice(0, 1)));
      reset();
    },
    [multiple, tool.accept, reset]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    reset();
  }, [reset]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  // ── Process ───────────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    await process(files, toolConfig);
  }, [files, process, toolConfig]);

  // ── Reset all ─────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setFiles([]);
    reset();
  }, [reset]);

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <main className="w-full max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 pt-8 pb-24 flex-1">

        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-[13px] text-on-surface-variant">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center p-1 -ml-1 hover:bg-surface-container rounded transition-colors text-on-surface"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <Link
            href="/tools"
            className="font-medium hover:text-on-surface transition-colors ml-1"
          >
            All Tools
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <Link
            href={`/tools?category=${tool.category}`}
            className="hover:text-on-surface transition-colors"
          >
            {categoryLabel(tool.category)}
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <span className="text-on-surface font-medium">{tool.title}</span>
        </nav>

        {/* Tool header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="icon-tile-lg shrink-0">
              <Icon className="w-6 h-6" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] md:text-[26px] font-semibold text-on-surface leading-tight tracking-tight">
                {tool.title}
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-0.5 max-w-[600px]">
                {tool.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="status-pill text-[12px]">
              <span className={`status-dot ${isReady ? "status-dot-success" : "status-dot-warning"}`} />
              {isReady ? "Ready" : "Coming Soon"}
            </span>
            <span className="chip-outline flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" strokeWidth={2} /> In-browser
            </span>
          </div>
        </div>

        {/* No Worker warning */}
        {!isWorkerSupported && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border-2 border-warning bg-warning-container">
            <AlertCircle className="w-5 h-5 text-on-warning-container shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-sm text-on-warning-container">
              Your browser doesn&apos;t support Web Workers. PDF processing may be slow or unavailable. Please upgrade to a modern browser.
            </p>
          </div>
        )}

        {/* Workspace card */}
        <div className="card-brutalist p-5 sm:p-8 md:p-10">
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 lg:gap-10">

            {/* Left: dropzone + file list + progress + action panel */}
            <div className="min-w-0">
              <span className="label-caps text-on-surface-variant block mb-2">// Files</span>

              {/* DropZone — hidden when processing or done */}
              <AnimatePresence>
                {!isDone && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={!isProcessing ? openPicker : undefined}
                      className={`
                        relative border-2 border-dashed rounded-xl p-8 md:p-10 flex flex-col items-center
                        justify-center text-center transition-all
                        ${isProcessing ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                        ${isDragging
                          ? "border-signal-yellow bg-signal-yellow/20"
                          : "border-ink bg-surface-container hover:bg-surface-container-high"
                        }
                      `}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        multiple={multiple}
                        accept={tool.accept?.join(",")}
                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                        className="hidden"
                      />
                      <div className="w-14 h-14 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center mb-4 shadow-hard-sm">
                        <Upload className="w-7 h-7 text-ink" strokeWidth={2.5} />
                      </div>
                      <p className="text-[15px] font-semibold text-on-surface">
                        {isDragging ? "Drop files here" : "Click or drag files"}
                      </p>
                      <p className="label-caps text-on-surface-variant mt-2">
                        {tool.accept ? tool.accept.map((a) => a.split("/")[1]).join(" · ").toUpperCase() : "Any file"}
                        {tool.processingTier === "server" ? " · Cloud Processing" : " · Your files stay in your browser"}
                      </p>
                    </div>

                    {/* File list */}
                    {files.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {files.map((f, i) => (
                          <div
                            key={`${f.name}-${i}`}
                            className="flex items-center justify-between p-3 border-2 border-ink rounded-lg bg-surface"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-md bg-signal-yellow border-2 border-ink flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-ink" strokeWidth={2.5} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-ink truncate">{f.name}</span>
                                <span className="label-caps text-on-surface-variant">{formatSize(f.size)}</span>
                              </div>
                            </div>
                            {!isProcessing && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                className="w-8 h-8 rounded-md border-2 border-ink bg-surface flex items-center justify-center text-ink hover:bg-error hover:text-surface transition-all shrink-0 ml-3"
                                aria-label={`Remove ${f.name}`}
                              >
                                <X className="w-4 h-4" strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress bar */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="label-caps text-ink flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                        {progressMessage || "Processing…"}
                      </span>
                      <span className="label-caps text-ink">{Math.floor(progress)}%</span>
                    </div>
                    <div className="w-full h-3 bg-surface-container border-2 border-ink rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-signal-yellow border-r-2 border-ink rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.15 }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error state */}
              <AnimatePresence>
                {status === "error" && error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 flex items-start gap-3 p-4 border-2 border-error rounded-xl bg-error-container"
                  >
                    <AlertCircle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" strokeWidth={2} />
                    <div>
                      <p className="text-sm font-semibold text-on-error-container">{error.code}</p>
                      <p className="text-sm text-on-error-container mt-0.5">{error.message}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Process button */}
              {!isDone && !isProcessing && (
                <button
                  onClick={handleProcess}
                  disabled={files.length === 0 || !isReady}
                  className="btn-brutalist w-full sm:w-auto mt-4 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={2.5} />
                  {isReady ? `Run ${tool.title}` : "Coming Soon"}
                </button>
              )}

              {/* Action Panel — appears only on complete */}
              {isDone && output && (
                <ActionPanel
                  output={output}
                  onReset={handleReset}
                  onChainTool={() => setShowChainPicker(true)}
                />
              )}
            </div>

            {/* Right: config sidebar or tool info */}
            <aside className="lg:border-l-2 lg:border-ink lg:pl-8">
              {configSidebar ? (
                <>
                  <span className="label-caps text-on-surface-variant block mb-3">// Options</span>
                  {configSidebar}
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <span className="label-caps text-on-surface-variant">// About this tool</span>
                  <div className="border-2 border-ink rounded-md p-4 bg-surface">
                    <p className="text-sm text-on-surface leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="border-2 border-ink rounded-md p-4 bg-surface-container flex flex-col gap-2">
                    <span className="label-caps text-ink flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" strokeWidth={2.5} /> Privacy first
                    </span>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {tool.processingTier === "server" 
                        ? "This tool requires heavy cloud processing. Files are securely uploaded, processed, and immediately deleted from our servers." 
                        : "Files never leave your device — everything runs locally in your browser using WebAssembly."}
                    </p>
                  </div>
                  {!isReady && (
                    <div className="border-2 border-ink rounded-md p-4 bg-signal-yellow">
                      <span className="label-caps text-ink">Coming Soon</span>
                      <p className="text-sm text-ink font-medium leading-relaxed mt-1">
                        The processing engine for this tool is next on our build list.
                        The UI is already wired — the logic ships in the next release.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-hairline bg-surface py-6">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="font-semibold text-on-surface">Share2Me</span>
          <span>© 2026 Share2Me — All rights reserved</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

      {/* Chain Tool Picker — placeholder, will be a modal in Phase 6 */}
      {showChainPicker && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-ink rounded-2xl p-6 max-w-sm w-full">
            <p className="text-[15px] font-semibold text-on-surface">Apply Another Tool</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Tool chaining is coming in Phase 6. For now, download your file and re-upload it to a new tool.
            </p>
            <button
              onClick={() => setShowChainPicker(false)}
              className="btn-brutalist mt-4 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy export for backward compatibility (old code imports PdfToolResult)
// ─────────────────────────────────────────────────────────────────────────────
export type { PdfToolShellProps };
