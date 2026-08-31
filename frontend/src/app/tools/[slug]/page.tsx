"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { PdfToolShell } from "@/components/PdfToolShell";
import { ScanToPdfUI } from "@/components/tools/ScanToPdfUI";
import { SignPdfUI } from "@/components/tools/SignPdfUI";
import { PdfFormsUI } from "@/components/tools/PdfFormsUI";
import { RedactPdfUI } from "@/components/tools/RedactPdfUI";
import { ComparePdfUI } from "@/components/tools/ComparePdfUI";
import { BgRemoverUI } from "@/components/tools/BgRemoverUI";
import { PdfEditorUI } from "@/components/tools/PdfEditorUI";
import { getToolBySlug } from "@/lib/pdfTools";
import * as Configs from "@/components/tools/configs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const ConfigMap: Record<string, React.ComponentType<Configs.ConfigProps>> = {
  "rotate-pdf": Configs.RotateConfig,
  "split-pdf": Configs.SplitConfig,
  "page-numbers": Configs.PageNumbersConfig,
  "watermark-pdf": Configs.WatermarkConfig,
  "protect-pdf": Configs.ProtectConfig,
  "unlock-pdf": Configs.UnlockConfig,
  "compress-pdf": Configs.CompressConfig,
  "crop-pdf": Configs.CropConfig,
  "organize-pdf": Configs.OrganizeConfig,
  "jpg-to-pdf": Configs.JpgToPdfConfig,
  "pdf-to-jpg": Configs.PdfToJpgConfig,
  "translate-pdf": Configs.TranslateConfig,
};

/**
 * Dynamic PDF-tool page. Looks the tool up from the registry and hands off to
 * the shared shell. The processing engine (Phase 2) will slot into `onProcess`
 * on a per-slug basis — the UI is already complete.
 */
export default function ToolPage({ params }: PageProps) {
  const { slug } = use(params);
  const tool = getToolBySlug(slug);

  const [config, setConfig] = useState<Record<string, unknown>>({});

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

  const ConfigComponent = ConfigMap[tool.slug];

  if (tool.slug === "edit-pdf") {
    return <PdfEditorUI tool={tool} />;
  }
  if (tool.slug === "scan-to-pdf") {
    return <ScanToPdfUI tool={tool} />;
  }
  if (tool.slug === "sign-pdf") {
    return <SignPdfUI tool={tool} />;
  }
  if (tool.slug === "pdf-forms") {
    return <PdfFormsUI tool={tool} />;
  }
  if (tool.slug === "redact-pdf") {
    return <RedactPdfUI tool={tool} />;
  }
  if (tool.slug === "compare-pdf") {
    return <ComparePdfUI tool={tool} />;
  }
  if (tool.slug === "bg-remover") {
    return <BgRemoverUI tool={tool} />;
  }

  return (
    <PdfToolShell
      tool={tool}
      multiple={!singleFileTools.has(tool.slug)}
      toolConfig={config}
      configSidebar={
        ConfigComponent ? <ConfigComponent config={config} onChange={setConfig} /> : undefined
      }
    />
  );
}

