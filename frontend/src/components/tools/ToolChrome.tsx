"use client";

/**
 * Shared page chrome (breadcrumb + header) and shared drop zone for interactive tools.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Upload } from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";

const CATEGORY_LABELS: Record<string, string> = {
  organize: "Organize",
  "convert-to-pdf": "Convert to PDF",
  "convert-from-pdf": "Convert from PDF",
  edit: "Edit",
  security: "Security",
  optimize: "Optimize",
  ai: "AI & Capture",
};

const TOOL_3D_STYLES: Record<string, { bg: string; shadow: string }> = {
  "bg-remover": { bg: "bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600", shadow: "shadow-[0_8px_20px_-4px_rgba(20,184,166,0.45)]" },
  "sign-pdf": { bg: "bg-gradient-to-br from-rose-500 via-pink-600 to-purple-600", shadow: "shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)]" },
  "scan-to-pdf": { bg: "bg-gradient-to-br from-rose-400 via-pink-500 to-purple-600", shadow: "shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)]" },
  "redact-pdf": { bg: "bg-gradient-to-br from-slate-700 via-zinc-800 to-black", shadow: "shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]" },
  "compare-pdf": { bg: "bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-600", shadow: "shadow-[0_8px_20px_-4px_rgba(59,130,246,0.45)]" },
  "pdf-forms": { bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-red-500", shadow: "shadow-[0_8px_20px_-4px_rgba(249,115,22,0.45)]" },
};

const DEFAULT_3D_STYLE = {
  bg: "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500",
  shadow: "shadow-[0_8px_20px_-4px_rgba(99,102,241,0.45)]",
};

export function ToolChrome({ tool, children }: { tool: PdfTool; children: React.ReactNode }) {
  const router = useRouter();
  const style3D = TOOL_3D_STYLES[tool.slug] || DEFAULT_3D_STYLE;

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-5 pt-8 pb-24 flex-1">
        <nav className="mb-4 flex items-center gap-2 text-[13px] text-on-surface-variant flex-wrap">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center p-1 -ml-1 hover:bg-surface-container rounded transition-colors text-on-surface"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <Link href="/tools" className="font-medium hover:text-on-surface ml-1">All Tools</Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <Link href={`/tools?category=${tool.category}`} className="hover:text-on-surface">
            {CATEGORY_LABELS[tool.category] ?? tool.category}
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <span className="text-on-surface font-medium">{tool.title}</span>
        </nav>

        <div className="mb-6 flex items-center gap-4">
          <div className={`relative w-14 h-14 rounded-2xl ${style3D.bg} ${style3D.shadow} text-white border border-white/40 flex items-center justify-center shrink-0 shadow-md`}>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/30 via-transparent to-transparent pointer-events-none" />
            <tool.icon className="w-7 h-7 drop-shadow-sm relative z-10" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-on-surface leading-tight tracking-tight">{tool.title}</h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5 max-w-[600px]">{tool.description}</p>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

export function ToolDropZone({
  onFile,
  onFilesSelected,
  label,
  sublabel,
  title,
  subtitle,
  accept,
  multiple = false,
}: {
  onFile?: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
  label?: string;
  sublabel?: string;
  title?: string;
  subtitle?: string;
  accept?: string;
  multiple?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const displayTitle = label || title || "Drop your file here";
  const displaySubtitle = sublabel || subtitle || "or click to browse from your device";

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;
    if (onFilesSelected) {
      onFilesSelected(files);
    }
    if (onFile) {
      onFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`card-brutalist p-10 text-center flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed cursor-pointer transition-all ${
        isDragOver
          ? "border-black bg-surface-container shadow-md scale-[1.01]"
          : "border-hairline-strong bg-surface hover:border-black hover:bg-surface-container/50"
      }`}
    >
      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 shadow-[0_8px_20px_-4px_rgba(99,102,241,0.4)] border border-white/40 flex items-center justify-center mb-4 text-white">
          <Upload className="w-8 h-8 drop-shadow-sm" strokeWidth={2} />
        </div>
        <h3 className="text-lg font-bold text-on-surface mb-1">{displayTitle}</h3>
        <p className="text-sm text-on-surface-variant max-w-sm">{displaySubtitle}</p>
        <span className="mt-5 btn-brutalist text-xs font-bold px-6 py-2.5">
          Select File{multiple ? "s" : ""}
        </span>
      </label>
    </div>
  );
}
