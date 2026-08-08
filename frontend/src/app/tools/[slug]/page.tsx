"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PdfToolShell } from "@/components/PdfToolShell";
import { getToolBySlug } from "@/lib/pdfTools";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic PDF-tool page. Looks the tool up from the registry and hands off to
 * the shared shell. The processing engine (Phase 2) will slot into `onProcess`
 * on a per-slug basis — the UI is already complete.
 */
export default function ToolPage({ params }: PageProps) {
  const { slug } = use(params);
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  // Single-file tools that can only take one input at a time.
  const singleFileTools = new Set([
    "split-pdf",
    "rotate-pdf",
    "organize-pdf",
    "crop-pdf",
    "page-numbers",
    "pdf-to-jpg",
    "pdf-to-word",
    "pdf-to-excel",
    "pdf-to-powerpoint",
    "pdf-to-markdown",
    "pdf-to-pdfa",
    "watermark-pdf",
    "protect-pdf",
    "unlock-pdf",
    "sign-pdf",
    "repair-pdf",
    "ocr-pdf",
    "ai-summarizer",
    "translate-pdf",
    "html-to-pdf",
    "edit-pdf",
    "pdf-forms",
    "redact-pdf",
  ]);

  return (
    <PdfToolShell
      tool={tool}
      multiple={!singleFileTools.has(tool.slug)}
      // onProcess intentionally omitted — Phase 1 is frontend-only.
      // Phase 2 will import per-tool engines and pass them in here.
    />
  );
}
