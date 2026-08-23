"use client";

/**
 * Redact PDF — fully client-side, and genuinely safe:
 * pages with redactions are re-built as flat images (rendered page + black
 * boxes baked into the pixels), so the hidden text is REMOVED from the file,
 * not just covered. Untouched pages are rasterized too, keeping the output
 * uniform. Draw boxes with mouse or finger; tap a box to remove it.
 */

import { useRef, useState } from "react";
import { Download, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { ToolChrome, ToolDropZone } from "./ToolChrome";
import { renderPdfToCanvases, downloadBytes, type RenderedPage } from "@/lib/pdfRender";

interface Box {
  id: string;
  pageIndex: number;
  /** Fractions of the page (0–1), normalized so x<x2, y<y2. */
  x: number; y: number; w: number; h: number;
}

export function RedactPdfUI({ tool }: { tool: PdfTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useRef<{ pageIndex: number; startX: number; startY: number } | null>(null);
  // The live rect also lives in a ref so pointerup never misses the final
  // size (state updates can lag one frame behind fast drags).
  const draftRect = useRef<Box | null>(null);
  const [draftBox, setDraftBox] = useState<Box | null>(null);

  const loadFile = async (f: File) => {
    setError(null);
    setLoading(true);
    setProgress("Reading file…");
    try {
      const buf = await f.arrayBuffer();
      // Scale 2 keeps text crisp in the rasterized output.
      const { pages: rendered, totalPages } = await renderPdfToCanvases(buf, 2, (d, t) => setProgress(`Rendering page ${d}/${t}…`), 60);
      if (totalPages > rendered.length) {
        // The output is rebuilt from rendered pages — never silently drop any.
        setError(`This PDF has ${totalPages} pages — Redact currently supports up to ${rendered.length}. Split it first with the Split PDF tool.`);
        return;
      }
      setFile(f);
      setPages(rendered);
      setPageUrls(rendered.map((p) => p.canvas.toDataURL("image/jpeg", 0.85)));
      setBoxes([]);
    } catch {
      setError("Couldn't open this PDF. It may be corrupted or password-protected — unlock it first with the Unlock PDF tool.");
    } finally {
      setLoading(false);
    }
  };

  const frac = (el: HTMLElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  };

  const onDown = (pageIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    // Starting on an existing box deletes it instead (tap-to-remove).
    if ((e.target as HTMLElement).dataset.boxId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = frac(e.currentTarget, e.clientX, e.clientY);
    draft.current = { pageIndex, startX: p.x, startY: p.y };
    draftRect.current = { id: "draft", pageIndex, x: p.x, y: p.y, w: 0, h: 0 };
    setDraftBox(draftRect.current);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draft.current;
    if (!d) return;
    const p = frac(e.currentTarget, e.clientX, e.clientY);
    draftRect.current = {
      id: "draft",
      pageIndex: d.pageIndex,
      x: Math.min(d.startX, p.x),
      y: Math.min(d.startY, p.y),
      w: Math.abs(p.x - d.startX),
      h: Math.abs(p.y - d.startY),
    };
    setDraftBox(draftRect.current);
  };

  const onUp = () => {
    const rect = draftRect.current;
    if (draft.current && rect && rect.w > 0.01 && rect.h > 0.005) {
      setBoxes((prev) => [...prev, { ...rect, id: `box_${Date.now().toString(36)}_${prev.length}` }]);
    }
    draft.current = null;
    draftRect.current = null;
    setDraftBox(null);
  };

  const applyAndDownload = async () => {
    if (!file || pages.length === 0 || boxes.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();

      for (let i = 0; i < pages.length; i++) {
        const { canvas, widthPts, heightPts } = pages[i];
        // Bake the black boxes into the page pixels.
        const flat = document.createElement("canvas");
        flat.width = canvas.width;
        flat.height = canvas.height;
        const ctx = flat.getContext("2d")!;
        ctx.drawImage(canvas, 0, 0);
        ctx.fillStyle = "#000000";
        for (const b of boxes.filter((x) => x.pageIndex === i)) {
          ctx.fillRect(b.x * flat.width, b.y * flat.height, b.w * flat.width, b.h * flat.height);
        }
        const jpgBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
          flat.toBlob((blob) => (blob ? blob.arrayBuffer().then(resolve) : reject(new Error("encode"))), "image/jpeg", 0.9);
        });
        const img = await doc.embedJpg(jpgBytes);
        const page = doc.addPage([widthPts, heightPts]);
        page.drawImage(img, { x: 0, y: 0, width: widthPts, height: heightPts });
      }

      const out = await doc.save();
      downloadBytes(out, file.name.replace(/\.pdf$/i, "") + "-redacted.pdf");
    } catch {
      setError("Redaction failed while rebuilding the PDF. Try a smaller file.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <ToolChrome tool={tool}>
      <div className="card-brutalist p-4 sm:p-8">
        {error && (
          <div className="mb-4 p-3 border-2 border-error bg-error-container text-on-error-container text-sm font-semibold rounded-md">{error}</div>
        )}

        {!file && !loading && <ToolDropZone onFile={loadFile} label="Choose the PDF to redact" />}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-on-surface-variant">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[13px] font-medium">{progress}</span>
          </div>
        )}

        {file && !loading && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap sticky top-2 z-20 bg-surface/90 backdrop-blur rounded-xl border-2 border-ink p-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-on-surface">
                <ShieldCheck className="w-4 h-4" /> {boxes.length} area{boxes.length !== 1 ? "s" : ""} marked
              </span>
              <button
                onClick={() => setBoxes([])}
                disabled={boxes.length === 0}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border-2 border-ink text-[12px] font-bold hover:bg-surface-container disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear all
              </button>
              <span className="flex-1" />
              <button
                onClick={applyAndDownload}
                disabled={boxes.length === 0 || applying}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-ink text-white text-[12px] font-bold disabled:opacity-40"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Redact &amp; download
              </button>
            </div>

            <p className="text-[12px] text-on-surface-variant -mt-1">
              Drag on a page to draw a black box over anything sensitive. Tap a box to remove it.
              The download rebuilds pages as flat images, so covered content is <b>permanently removed</b>, not just hidden.
            </p>

            <div className="flex flex-col items-center gap-6">
              {pageUrls.map((url, i) => (
                <div key={i} className="w-full max-w-[820px]">
                  <p className="text-[11px] font-semibold text-on-surface-variant mb-1">Page {i + 1} of {pageUrls.length}</p>
                  <div
                    className="relative w-full border-2 border-ink rounded-lg overflow-hidden bg-white shadow-sm cursor-crosshair select-none"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => onDown(i, e)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Page ${i + 1}`} className="w-full h-auto block pointer-events-none" draggable={false} />
                    {[...boxes.filter((b) => b.pageIndex === i), ...(draftBox?.pageIndex === i ? [draftBox] : [])].map((b) => (
                      <div
                        key={b.id}
                        data-box-id={b.id}
                        onPointerDown={(e) => {
                          if (b.id === "draft") return;
                          e.stopPropagation();
                          setBoxes((prev) => prev.filter((x) => x.id !== b.id));
                        }}
                        className={b.id === "draft" ? "absolute bg-black/60 border-2 border-dashed border-white/70" : "absolute bg-black cursor-pointer hover:opacity-80"}
                        style={{
                          left: `${b.x * 100}%`,
                          top: `${b.y * 100}%`,
                          width: `${b.w * 100}%`,
                          height: `${b.h * 100}%`,
                          touchAction: "none",
                        }}
                        title="Tap to remove this redaction"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolChrome>
  );
}
