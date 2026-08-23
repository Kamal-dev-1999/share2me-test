"use client";

/**
 * Shared page chrome (breadcrumb + header) for the interactive tool UIs —
 * same layout as ScanToPdfUI so all custom tools look identical.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
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

export function ToolChrome({ tool, children }: { tool: PdfTool; children: React.ReactNode }) {
  const router = useRouter();
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

        <div className="mb-6 flex items-center gap-3">
          <span className="icon-tile-lg shrink-0">
            <tool.icon className="w-6 h-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold text-on-surface leading-tight tracking-tight">{tool.title}</h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5 max-w-[600px]">{tool.description}</p>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

/** Shared drop-zone used by the interactive tools' upload step. */
export function ToolDropZone({
  onFile, label, sublabel, accept = "application/pdf",
}: { onFile: (f: File) => void; label: string; sublabel?: string; accept?: string }) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/25 bg-surface p-10 sm:p-14 text-center cursor-pointer hover:bg-surface-container transition-colors"
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <span className="text-[15px] font-semibold text-on-surface">{label}</span>
      <span className="text-[12px] text-on-surface-variant">{sublabel ?? "Drop a PDF here or tap to browse — processed entirely in your browser"}</span>
    </label>
  );
}
