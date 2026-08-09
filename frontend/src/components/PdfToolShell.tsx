"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, Upload, X, FileText, Sparkles, Download, Loader2,
  ShieldCheck, CheckCircle2, AlertCircle,
} from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { categoryLabel } from "@/lib/pdfTools";

/**
 * Result returned by a tool's process function.
 * `blob` = the output file to offer for download.
 * `filename` = suggested filename for the download.
 */
export interface PdfToolResult {
  blob: Blob;
  filename: string;
}

interface PdfToolShellProps {
  tool: PdfTool;
  /** Optional per-tool config UI rendered in a sidebar next to the dropzone. */
  configSidebar?: React.ReactNode;
  /**
   * Process handler. Return a downloadable Blob + filename.
   * If omitted (Phase 1 stub), the shell shows a "engine coming soon" state.
   */
  onProcess?: (files: File[]) => Promise<PdfToolResult>;
  /** Allow multiple files? Defaults to whatever makes sense for a merge/split tool. */
  multiple?: boolean;
}

type Phase = "idle" | "processing" | "done" | "error";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${["B","KB","MB","GB"][i]}`;
}

export function PdfToolShell({
  tool,
  configSidebar,
  onProcess,
  multiple = true,
}: PdfToolShellProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PdfToolResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = tool.icon;
  const isReady = tool.phase === "ready";

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    setFiles((prev) => (multiple ? [...prev, ...list] : list.slice(0, 1)));
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
  }, [multiple]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openPicker = () => inputRef.current?.click();

  const handleProcess = async () => {
    setErrorMsg("");
    if (files.length === 0) {
      setErrorMsg("Please add at least one file before processing.");
      return;
    }
    setPhase("processing");
    setProgress(0);

    // Simple fake-progress ticker so the UI feels alive while onProcess runs.
    const ticker = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 3 : p));
    }, 120);

    try {
      if (!onProcess) {
        // Frontend-only stub — pretend for a moment, then show a helpful message.
        await new Promise((r) => setTimeout(r, 1200));
        window.clearInterval(ticker);
        setProgress(100);
        setPhase("error");
        setErrorMsg("The processing engine for this tool isn't wired up yet — the UI is ready and the logic ships next.");
        return;
      }

      const output = await onProcess(files);
      window.clearInterval(ticker);
      setProgress(100);
      setResult(output);
      setPhase("done");
    } catch (err: unknown) {
      window.clearInterval(ticker);
      const message = err instanceof Error ? err.message : "Something went wrong while processing your file.";
      setErrorMsg(message);
      setPhase("error");
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setFiles([]);
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">

      <main className="w-full max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 pt-8 pb-24 flex-1">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 font-medium hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            All Tools
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <span>{categoryLabel(tool.category)}</span>
        </nav>

        {/* Tool header — compact */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="icon-tile-lg shrink-0">
              <Icon className="w-6 h-6" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] md:text-[26px] font-semibold text-on-surface leading-tight tracking-tight">
                {tool.title}
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-0.5 max-w-[600px] line-clamp-2">
                {tool.description}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="status-pill text-[12px]">
              <span className={`status-dot ${isReady ? "status-dot-success" : "status-dot-warning"}`} />
              {isReady ? "Ready" : "Coming Soon"}
            </span>
            {tool.tag && <span className="chip-outline">{tool.tag}</span>}
            <span className="chip-outline flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" strokeWidth={2} /> In-browser
            </span>
          </div>
        </div>

        {/* Workspace */}
        <div className="card-brutalist p-5 sm:p-8 md:p-10 relative">
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
            {/* Left: dropzone + file list */}
            <div className="min-w-0">
              <label className="label-caps text-on-surface-variant block mb-2">// Files</label>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                }}
                onClick={openPicker}
                className={`relative border-2 border-dashed rounded-xl p-8 md:p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-signal-yellow bg-signal-yellow/20"
                    : "border-ink bg-surface-container hover:bg-surface-container-high"
                }`}
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
                  {" · Files stay on your device"}
                </p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between p-3 border-2 border-ink rounded-md bg-surface"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-signal-yellow border-2 border-ink flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-ink" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-ink truncate">{f.name}</span>
                          <span className="label-caps text-on-surface-variant mt-0.5">
                            {formatSize(f.size)}
                          </span>
                        </div>
                      </div>
                      {phase !== "processing" && (
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

              {/* Action + status bar */}
              <div className="mt-6">
                <AnimatePresence mode="wait">
                  {phase === "processing" && (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-caps text-ink flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                          Processing…
                        </span>
                        <span className="label-caps text-ink">{Math.floor(progress)}%</span>
                      </div>
                      <div className="w-full h-3 bg-surface-container border-2 border-ink rounded-full overflow-hidden">
                        <div
                          className="h-full bg-signal-yellow transition-all duration-100 rounded-full border-r-2 border-ink"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {phase === "done" && result && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="border-2 border-ink rounded-md p-4 bg-signal-yellow flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-ink shrink-0" strokeWidth={2.5} />
                        <div>
                          <p className="text-[15px] font-semibold text-on-surface">Ready to download</p>
                          <p className="label-caps text-ink/70">{result.filename} · {formatSize(result.blob.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={downloadResult} className="btn-brutalist bg-ink text-signal-yellow">
                          <Download className="w-4 h-4" strokeWidth={2.5} />
                          Download
                        </button>
                        <button onClick={resetAll} className="btn-brutalist-ghost">Start over</button>
                      </div>
                    </motion.div>
                  )}

                  {phase === "error" && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="border-2 border-error rounded-md p-4 bg-error-container flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" strokeWidth={2.5} />
                      <p className="text-sm text-on-error-container font-medium">{errorMsg}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {phase !== "processing" && phase !== "done" && (
                  <button
                    onClick={handleProcess}
                    disabled={files.length === 0}
                    className="btn-brutalist w-full sm:w-auto mt-3 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Sparkles className="w-4 h-4" strokeWidth={2.5} />
                    {isReady ? `Run ${tool.title}` : `Preview ${tool.title}`}
                  </button>
                )}
              </div>
            </div>

            {/* Right: config sidebar (per-tool) or "why this tool" */}
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
                      Your files never leave your device — everything runs locally in the browser.
                    </p>
                  </div>
                  {!isReady && (
                    <div className="border-2 border-ink rounded-md p-4 bg-signal-yellow flex flex-col gap-2">
                      <span className="label-caps text-ink">Coming Soon</span>
                      <p className="text-sm text-ink font-medium leading-relaxed">
                        This tool&apos;s engine is next up. The UI is already wired — swap in the logic to go live.
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
    </div>
  );
}
