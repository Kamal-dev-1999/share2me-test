import type { LucideIcon } from "lucide-react";
import {
  Combine, Scissors, RotateCw, LayoutGrid, Crop, Hash,
  Image as ImageIcon, FileImage, FileText, FileType2, FileSpreadsheet,
  Presentation, Code2, FileCode2, Droplet, FormInput, Eraser, GitCompare,
  Lock, Unlock, PenLine, Minimize2, Wrench, Sparkles, Languages,
  ScanText, ScanLine, FileCheck2,
} from "lucide-react";

export type ToolCategory =
  | "organize"
  | "convert-to-pdf"
  | "convert-from-pdf"
  | "edit"
  | "security"
  | "optimize"
  | "ai";

export type ToolPhase = "ready" | "soon";

export type ToolProcessingTier =
  | "client"   // Runs in the browser Web Worker (pdf-processor.js)
  | "server"   // Runs in the backend BullMQ queue (LibreOffice, Puppeteer, AI)
  | "hybrid";  // Tries client first; falls back to server if >50MB or WASM fails

export interface PdfTool {
  /** URL slug — matches `/tools/{slug}`. */
  slug: string;
  /** Display title. */
  title: string;
  /** One-line description shown on the card and the tool page. */
  description: string;
  /** Lucide icon rendered inside the icon tile on cards. */
  icon: LucideIcon;
  /** Grouping used by the landing-page filter tabs. */
  category: ToolCategory;
  /** `ready` = built in Phase 1. `soon` = card visible but disabled. */
  phase: ToolPhase;
  /**
   * Where processing runs.
   * `client` = browser Web Worker only (zero server cost).
   * `server` = backend BullMQ job required.
   * `hybrid` = client first, server fallback.
   */
  processingTier: ToolProcessingTier;
  /** File-type suffix shown as a small chip on the card (optional). */
  tag?: string;
  /** MIME types the tool accepts (used by DropZone for validation). */
  accept?: string[];
}

export const TOOL_CATEGORIES: { key: ToolCategory; label: string }[] = [
  { key: "organize",          label: "Organize" },
  { key: "convert-to-pdf",    label: "Convert to PDF" },
  { key: "convert-from-pdf",  label: "Convert from PDF" },
  { key: "edit",              label: "Edit" },
  { key: "security",          label: "Security" },
  { key: "optimize",          label: "Optimize" },
  { key: "ai",                label: "AI" },
];

export const PDF_TOOLS: PdfTool[] = [
  // ---- ORGANIZE — all client-side ----
  { slug: "merge-pdf",    title: "Merge PDF",    description: "Combine multiple PDFs into a single file in the order you want.", icon: Combine,    category: "organize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "split-pdf",    title: "Split PDF",    description: "Split a PDF into separate files by page range or extract pages.",  icon: Scissors,   category: "organize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "rotate-pdf",   title: "Rotate PDF",   description: "Rotate all pages or specific pages by 90°, 180°, or 270°.",       icon: RotateCw,   category: "organize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "organize-pdf", title: "Organize PDF", description: "Reorder, delete, or duplicate pages inside a PDF visually.",       icon: LayoutGrid, category: "organize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "crop-pdf",     title: "Crop PDF",     description: "Trim the margins of every page to a chosen rectangle.",            icon: Crop,       category: "organize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "page-numbers", title: "Page Numbers", description: "Add page numbers to your PDF with custom position and typography.", icon: Hash,       category: "organize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },

  // ---- CONVERT TO PDF ----
  { slug: "jpg-to-pdf",        title: "JPG to PDF",        description: "Turn JPG or PNG images into a single PDF, one image per page.",    icon: ImageIcon,       category: "convert-to-pdf", phase: "ready", processingTier: "client", tag: "JPG/PNG", accept: ["image/jpeg", "image/png"] },
  { slug: "word-to-pdf",       title: "Word to PDF",       description: "Convert DOC and DOCX files into ready-to-share PDFs.",              icon: FileType2,       category: "convert-to-pdf", phase: "ready",  processingTier: "server", tag: "DOCX", accept: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"] },
  { slug: "excel-to-pdf",      title: "Excel to PDF",      description: "Export XLSX / XLS spreadsheets into a clean PDF layout.",           icon: FileSpreadsheet, category: "convert-to-pdf", phase: "ready",  processingTier: "server", tag: "XLSX", accept: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"] },
  { slug: "powerpoint-to-pdf", title: "PowerPoint to PDF", description: "Turn PPTX slide decks into a printable PDF.",                        icon: Presentation,    category: "convert-to-pdf", phase: "ready",  processingTier: "server", tag: "PPTX", accept: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"] },
  { slug: "html-to-pdf",       title: "HTML to PDF",       description: "Paste a URL or upload an .html file — get a print-ready PDF.",     icon: Code2,           category: "convert-to-pdf", phase: "ready",  processingTier: "server", tag: "HTML", accept: ["text/html"] },

  // ---- CONVERT FROM PDF ----
  { slug: "pdf-to-jpg",        title: "PDF to JPG",        description: "Extract every page of a PDF as a JPG image.",                        icon: FileImage,       category: "convert-from-pdf", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "pdf-to-word",       title: "PDF to Word",       description: "Convert a PDF into an editable DOCX file.",                          icon: FileType2,       category: "convert-from-pdf", phase: "soon",  processingTier: "server", tag: "DOCX" },
  { slug: "pdf-to-excel",      title: "PDF to Excel",      description: "Pull tables from a PDF into an editable XLSX sheet.",                icon: FileSpreadsheet, category: "convert-from-pdf", phase: "soon",  processingTier: "server", tag: "XLSX" },
  { slug: "pdf-to-powerpoint", title: "PDF to PowerPoint", description: "Turn each PDF page into a PowerPoint slide.",                        icon: Presentation,    category: "convert-from-pdf", phase: "soon",  processingTier: "server", tag: "PPTX" },
  { slug: "pdf-to-markdown",   title: "PDF to Markdown",   description: "Extract clean Markdown from a PDF — headings, lists, tables preserved.", icon: FileCode2,   category: "convert-from-pdf", phase: "ready", processingTier: "server", tag: "MD", accept: ["application/pdf"] },
  { slug: "pdf-to-pdfa",       title: "PDF to PDF/A",      description: "Convert your PDF to the ISO archival PDF/A format.",                 icon: FileCheck2,      category: "convert-from-pdf", phase: "ready", processingTier: "server", tag: "PDF/A", accept: ["application/pdf"] },

  // ---- EDIT ----
  { slug: "edit-pdf",      title: "Edit PDF",      description: "Add text, images, shapes, and freehand annotations to a PDF.",    icon: PenLine,  category: "edit", phase: "soon",  processingTier: "client" },
  { slug: "watermark-pdf", title: "Watermark PDF", description: "Stamp text or an image watermark on every page of a PDF.",        icon: Droplet,  category: "edit", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "pdf-forms",     title: "PDF Forms",     description: "Detect and fill text fields, checkboxes, and radios inside PDFs.", icon: FormInput,category: "edit", phase: "soon",  processingTier: "hybrid" },
  { slug: "redact-pdf",    title: "Redact PDF",    description: "Permanently remove text or graphics from a PDF for privacy.",     icon: Eraser,   category: "edit", phase: "soon",  processingTier: "client" },
  { slug: "compare-pdf",   title: "Compare PDF",   description: "Side-by-side visual diff between two PDF versions.",               icon: GitCompare,category: "edit", phase: "soon", processingTier: "client" },

  // ---- SECURITY ----
  { slug: "protect-pdf", title: "Protect PDF", description: "Encrypt a PDF with a password so only holders can open it.",         icon: Lock,     category: "security", phase: "ready", processingTier: "server", accept: ["application/pdf"] },
  { slug: "unlock-pdf",  title: "Unlock PDF",  description: "Remove password protection from a PDF you have permission to use.",  icon: Unlock,   category: "security", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "sign-pdf",    title: "Sign PDF",    description: "Sign a PDF yourself or send it to others for signature.",            icon: FileText, category: "security", phase: "soon",  processingTier: "server" },

  // ---- OPTIMIZE ----
  { slug: "compress-pdf", title: "Compress PDF", description: "Reduce PDF file size while preserving maximum readable quality.", icon: Minimize2, category: "optimize", phase: "ready", processingTier: "client", accept: ["application/pdf"] },
  { slug: "repair-pdf",   title: "Repair PDF",   description: "Repair a corrupt PDF and recover recoverable pages.",              icon: Wrench,    category: "optimize", phase: "ready", processingTier: "server", accept: ["application/pdf"] },

  // ---- AI (all server-side — require API keys) ----
  { slug: "ai-summarizer", title: "AI Summarizer", description: "Get an instant AI-generated summary of any PDF document.",      icon: Sparkles, category: "ai", phase: "ready", processingTier: "server", tag: "AI", accept: ["application/pdf"] },
  { slug: "translate-pdf", title: "Translate PDF", description: "Translate a PDF into another language, preserving the layout.", icon: Languages,category: "ai", phase: "ready", processingTier: "server", tag: "AI", accept: ["application/pdf"] },
  { slug: "ocr-pdf",       title: "OCR PDF",       description: "Turn a scanned PDF into searchable, selectable text via OCR.",  icon: ScanText, category: "ai", phase: "ready", processingTier: "server", accept: ["image/png", "image/jpeg", "application/pdf"] },
  { slug: "scan-to-pdf",   title: "Scan to PDF",   description: "Capture pages with your camera and save them as a clean PDF.",  icon: ScanLine, category: "ai", phase: "ready", processingTier: "client" },
];

export function getToolBySlug(slug: string): PdfTool | undefined {
  return PDF_TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: ToolCategory): PdfTool[] {
  return PDF_TOOLS.filter((t) => t.category === category);
}

export function categoryLabel(category: ToolCategory): string {
  return TOOL_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}
