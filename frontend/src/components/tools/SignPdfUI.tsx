"use client";

/**
 * Sign PDF — fully client-side.
 * 1. Upload a PDF (rendered with pdfjs).
 * 2. Draw or upload a signature.
 * 3. Tap a page to place it; drag to move, slider/buttons/handles to resize, rotate, Delete/Backspace/Remove to delete.
 * 4. Undo/Redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) with single-step history per drag/resize/move.
 * 5. Apply — pdf-lib embeds the signature PNG at the exact spot(s).
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, Trash2, Undo2, Download, Loader2, X, RotateCcw, Check, ImageUp, RotateCw, Plus, Minus } from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { ToolChrome, ToolDropZone } from "./ToolChrome";
import { renderPdfToCanvases, downloadBytes } from "@/lib/pdfRender";

interface Placement {
  id: string;
  pageIndex: number;
  /** Center X of the signature as a fraction of the page width (0–1). */
  cx: number;
  /** Center Y of the signature as a fraction of the page height (0–1). */
  cy: number;
  /** Signature width as a fraction of the page width (0–1). */
  wFrac: number;
  /** Rotation in degrees, clockwise on screen (-180 to 180). */
  rot: number;
  /** PNG data URL for signature image. */
  png: string;
  /** Aspect ratio (width / height) of signature image. */
  aspect: number;
}

/**
 * Prepares an uploaded signature image: draws it to a canvas, makes
 * near-white pixels transparent (so it overlays like real ink), trims to
 * the visible bounding box, and returns a PNG data-URL + aspect ratio.
 */
async function prepareUploadedSignature(file: File): Promise<{ png: string; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = url; });
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // Near-white → transparent (photographed/scanned signature paper)
        if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) {
          px[i + 3] = 0;
        } else if (px[i + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
    ctx.putImageData(data, 0, 0);

    const pad = 6;
    const bx = Math.max(0, minX - pad), by = Math.max(0, minY - pad);
    const bw = Math.min(w, maxX + pad) - bx, bh = Math.min(h, maxY + pad) - by;
    const out = document.createElement("canvas");
    out.width = bw; out.height = bh;
    out.getContext("2d")!.drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
    return { png: out.toDataURL("image/png"), aspect: bw / bh };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const INK_COLORS = [
  { name: "Black", value: "#111827" },
  { name: "Blue", value: "#1d4ed8" },
];

// ── Signature drawing pad ─────────────────────────────────────────
function SignaturePad({ onDone, onCancel }: { onDone: (png: string, aspect: number) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ color: string; points: { x: number; y: number }[] }[]>([]);
  const drawing = useRef(false);
  const [color, setColor] = useState(INK_COLORS[0].value);
  const [hasInk, setHasInk] = useState(false);

  const W = 600, H = 240;

  const redraw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (const s of strokes.current) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    setHasInk(strokes.current.some((s) => s.points.length > 1));
  };

  const toCanvasPoint = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const finish = () => {
    // Trim to the inked bounding box so placement is tight.
    const pts = strokes.current.flatMap((s) => s.points);
    if (pts.length < 2) return;
    const pad = 8;
    const minX = Math.max(0, Math.min(...pts.map((p) => p.x)) - pad);
    const maxX = Math.min(W, Math.max(...pts.map((p) => p.x)) + pad);
    const minY = Math.max(0, Math.min(...pts.map((p) => p.y)) - pad);
    const maxY = Math.min(H, Math.max(...pts.map((p) => p.y)) + pad);
    const w = Math.max(24, maxX - minX);
    const h = Math.max(16, maxY - minY);

    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d")!.drawImage(canvasRef.current!, minX, minY, w, h, 0, 0, w, h);
    onDone(out.toDataURL("image/png"), w / h);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-[#111827]/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-[640px] bg-surface border-2 border-ink rounded-2xl p-4 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-semibold text-on-surface">Draw your signature</h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-container" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ touchAction: "none" }}
          className="w-full rounded-xl border-2 border-dashed border-ink/25 bg-white cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            strokes.current.push({ color, points: [toCanvasPoint(e)] });
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            strokes.current[strokes.current.length - 1].points.push(toCanvasPoint(e));
            redraw();
          }}
          onPointerUp={() => { drawing.current = false; redraw(); }}
        />

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {INK_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              aria-label={c.name}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c.value ? "scale-110 border-ink" : "border-transparent"}`}
              style={{ background: c.value }}
            />
          ))}
          <span className="flex-1" />
          <button
            onClick={() => { strokes.current.pop(); redraw(); }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border-2 border-ink text-[12px] font-semibold hover:bg-surface-container"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
          <button
            onClick={() => { strokes.current = []; redraw(); }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border-2 border-ink text-[12px] font-semibold hover:bg-surface-container"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
          <button
            onClick={finish}
            disabled={!hasInk}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-ink text-white text-[12px] font-bold disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Use signature
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

type DragState =
  | { type: "move"; id: string; startX: number; startY: number; cx: number; cy: number; initialPlacements: Placement[] }
  | { type: "resize"; id: string; startX: number; startY: number; initialWFrac: number; initialDist: number; centerPx: { x: number; y: number }; initialPlacements: Placement[] }
  | null;

// ── Main tool ─────────────────────────────────────────────────────
export function SignPdfUI({ tool }: { tool: PdfTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [padOpen, setPadOpen] = useState(false);
  const [sigPng, setSigPng] = useState<string | null>(null);
  const [sigAspect, setSigAspect] = useState(3);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<Placement[][]>([]);
  const [redoStack, setRedoStack] = useState<Placement[][]>([]);

  const dragRef = useRef<DragState>(null);
  const sliderHistoryRecorded = useRef(false);

  const selected = placements.find((p) => p.id === selectedId) ?? null;

  // History helper
  const recordHistory = (prevPlacements: Placement[]) => {
    setHistory((h) => [...h, prevPlacements]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setRedoStack((r) => [placements, ...r]);
      setPlacements(previous);
      if (selectedId && !previous.some((p) => p.id === selectedId)) {
        setSelectedId(null);
      }
      return h.slice(0, h.length - 1);
    });
  };

  const handleRedo = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[0];
      setHistory((h) => [...h, placements]);
      setPlacements(next);
      return r.slice(1);
    });
  };

  // Unified Deletion
  const deleteSelectedSignature = () => {
    if (!selectedId) return;
    recordHistory(placements);
    setPlacements((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
  };

  // Global Keyboard Listener for Backspace, Delete, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("input, textarea, [contenteditable='true']"))
      ) {
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedId) {
          e.preventDefault();
          deleteSelectedSignature();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, placements, history, redoStack]);

  const loadFile = async (f: File) => {
    setError(null);
    setLoading(true);
    setProgress("Reading file…");
    try {
      const buf = await f.arrayBuffer();
      const { pages: rendered, totalPages } = await renderPdfToCanvases(buf, 1.5, (d, t) => setProgress(`Rendering page ${d}/${t}…`), 60);
      if (totalPages > rendered.length) {
        setError(`Showing the first ${rendered.length} of ${totalPages} pages — you can sign on these; the rest are kept unchanged in the download.`);
      }
      setFile(f);
      setBytes(buf);
      setPageUrls(rendered.map((p) => p.canvas.toDataURL("image/jpeg", 0.85)));
      setPlacements([]);
      setHistory([]);
      setRedoStack([]);
      setSigPng(null);
      setPadOpen(true);
    } catch (err) {
      console.error("[SignPdf] load failed:", err);
      setError("Couldn't open this PDF. It may be corrupted or password-protected — unlock it first with the Unlock PDF tool.");
    } finally {
      setLoading(false);
    }
  };

  const placeAt = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) return;
    if (selectedId) {
      setSelectedId(null);
      return;
    }
    if (!sigPng) {
      setPadOpen(true);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const id = `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    
    const newPlacement: Placement = {
      id,
      pageIndex,
      cx,
      cy,
      wFrac: 0.3,
      rot: 0,
      png: sigPng,
      aspect: sigAspect,
    };

    recordHistory(placements);
    setPlacements((prev) => [...prev, newPlacement]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<Placement>) => {
    if (!selectedId) return;
    setPlacements((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  };

  const onSliderStart = () => {
    if (!sliderHistoryRecorded.current) {
      recordHistory(placements);
      sliderHistoryRecorded.current = true;
    }
  };

  const onSliderEnd = () => {
    sliderHistoryRecorded.current = false;
  };

  const rotateBy = (deg: number) => {
    if (!selectedId) return;
    recordHistory(placements);
    setPlacements((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        let newRot = p.rot + deg;
        if (newRot > 180) newRot -= 360;
        if (newRot < -180) newRot += 360;
        return { ...p, rot: newRot };
      })
    );
  };

  const resizeBy = (delta: number) => {
    if (!selectedId) return;
    recordHistory(placements);
    setPlacements((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, wFrac: Math.max(0.04, Math.min(0.9, p.wFrac + delta)) } : p))
    );
  };

  const uploadSignature = async (f: File) => {
    setError(null);
    try {
      const { png, aspect } = await prepareUploadedSignature(f);
      setSigPng(png);
      setSigAspect(aspect);
      setPadOpen(false);
    } catch {
      setError("Couldn't read that image. Use a PNG or JPG photo of your signature.");
    }
  };

  const onSigPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const p = placements.find((x) => x.id === id)!;
    setSelectedId(id);
    dragRef.current = {
      type: "move",
      id,
      startX: e.clientX,
      startY: e.clientY,
      cx: p.cx,
      cy: p.cy,
      initialPlacements: placements,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCornerPointerDown = (p: Placement, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedId(p.id);
    const pageEl = (e.currentTarget.closest(".pdf-page-container") as HTMLElement) || e.currentTarget.parentElement?.parentElement;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const centerPx = {
      x: pageRect.left + p.cx * pageRect.width,
      y: pageRect.top + p.cy * pageRect.height,
    };
    const initialDist = Math.hypot(e.clientX - centerPx.x, e.clientY - centerPx.y);

    dragRef.current = {
      type: "resize",
      id: p.id,
      startX: e.clientX,
      startY: e.clientY,
      initialWFrac: p.wFrac,
      initialDist: Math.max(1, initialDist),
      centerPx,
      initialPlacements: placements,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSigPointerMove = (pageEl: HTMLElement | null, e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !pageEl) return;

    if (drag.type === "move") {
      const rect = pageEl.getBoundingClientRect();
      const cx = Math.min(0.98, Math.max(0.02, drag.cx + (e.clientX - drag.startX) / rect.width));
      const cy = Math.min(0.98, Math.max(0.02, drag.cy + (e.clientY - drag.startY) / rect.height));
      setPlacements((prev) => prev.map((p) => (p.id === drag.id ? { ...p, cx, cy } : p)));
    } else if (drag.type === "resize") {
      const currentDist = Math.hypot(e.clientX - drag.centerPx.x, e.clientY - drag.centerPx.y);
      const scale = currentDist / drag.initialDist;
      const newWFrac = Math.max(0.04, Math.min(0.9, drag.initialWFrac * scale));
      setPlacements((prev) => prev.map((p) => (p.id === drag.id ? { ...p, wFrac: newWFrac } : p)));
    }
  };

  const onSigPointerUp = () => {
    const drag = dragRef.current;
    if (drag) {
      const currentPl = placements.find((p) => p.id === drag.id);
      const initialPl = drag.initialPlacements.find((p) => p.id === drag.id);
      if (
        currentPl &&
        initialPl &&
        (currentPl.cx !== initialPl.cx ||
          currentPl.cy !== initialPl.cy ||
          currentPl.wFrac !== initialPl.wFrac)
      ) {
        recordHistory(drag.initialPlacements);
      }
      dragRef.current = null;
    }
  };

  const applyAndDownload = async () => {
    if (!bytes || placements.length === 0 || !file) return;
    setApplying(true);
    setError(null);
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pdfPages = doc.getPages();

      // Embed each unique PNG image
      const embeddedPngMap = new Map<string, any>();

      for (const pl of placements) {
        const page = pdfPages[pl.pageIndex];
        if (!page) continue;

        let png = embeddedPngMap.get(pl.png);
        if (!png) {
          png = await doc.embedPng(pl.png);
          embeddedPngMap.set(pl.png, png);
        }

        const { width: pw, height: ph } = page.getSize();
        const w = pl.wFrac * pw;
        const h = w / pl.aspect;
        const cx = pl.cx * pw;
        const cy = ph - pl.cy * ph; // PDF y-axis points up

        // pdf-lib rotates around the image's bottom-left corner; CSS rotates
        // around center clockwise. Convert: θ(pdf, ccw) = -rot, then offset corner.
        const theta = (-pl.rot * Math.PI) / 180;
        const x = cx - ((w / 2) * Math.cos(theta) - (h / 2) * Math.sin(theta));
        const y = cy - ((w / 2) * Math.sin(theta) + (h / 2) * Math.cos(theta));

        page.drawImage(png, { x, y, width: w, height: h, rotate: degrees(-pl.rot) });
      }

      const out = await doc.save();
      downloadBytes(out, file.name.replace(/\.pdf$/i, "") + "-signed.pdf");
    } catch (err) {
      console.error("[SignPdf] Apply failed:", err);
      setError("Signing failed — this PDF may be encrypted or malformed.");
    } finally {
      setApplying(false);
    }
  };

  // Keep object URLs tidy on unmount
  useEffect(() => () => setPageUrls([]), []);

  return (
    <ToolChrome tool={tool}>
      <div className="card-brutalist p-4 sm:p-8">
        {error && (
          <div className="mb-4 p-3 border-2 border-error bg-error-container text-on-error-container text-sm font-semibold rounded-md">{error}</div>
        )}

        {!file && !loading && <ToolDropZone onFile={loadFile} label="Choose the PDF to sign" />}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-on-surface-variant">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[13px] font-medium">{progress}</span>
          </div>
        )}

        {file && !loading && (
          <div className="flex flex-col gap-4">
            {/* Main Action Bar */}
            <div className="flex items-center gap-2 flex-wrap sticky top-2 z-20 bg-surface/90 backdrop-blur rounded-xl border-2 border-ink p-2.5">
              <button
                onClick={() => setPadOpen(true)}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border-2 border-ink text-[12px] font-bold hover:bg-surface-container"
              >
                <PenLine className="w-4 h-4" /> {sigPng ? "Redraw" : "Draw signature"}
              </button>
              <label className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border-2 border-ink text-[12px] font-bold hover:bg-surface-container cursor-pointer">
                <ImageUp className="w-4 h-4" /> Upload
                <input
                  type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSignature(f); e.target.value = ""; }}
                />
              </label>
              {sigPng && (
                <span className="h-10 px-2 rounded-lg bg-white border-2 border-ink/20 flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sigPng} alt="Your signature" className="h-6 w-auto max-w-[110px] object-contain" />
                </span>
              )}

              {/* Undo / Redo controls */}
              <div className="flex items-center gap-1 border-l-2 border-ink/15 pl-2 ml-1">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="p-2 rounded-lg border-2 border-ink text-[12px] font-bold hover:bg-surface-container disabled:opacity-30"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-2 rounded-lg border-2 border-ink text-[12px] font-bold hover:bg-surface-container disabled:opacity-30"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              <span className="flex-1" />
              <button
                onClick={applyAndDownload}
                disabled={placements.length === 0 || applying}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-ink text-white text-[12px] font-bold disabled:opacity-40"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download signed PDF{placements.length > 0 ? ` (${placements.length})` : ""}
              </button>
            </div>

            {/* Selected Signature Toolbar */}
            {selected && (
              <div className="flex items-center gap-2 flex-wrap rounded-xl border-2 border-ink/20 bg-surface-container p-2.5 -mt-1 select-none">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">SELECTED SIGNATURE</span>

                {/* Size Controls */}
                <span className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => resizeBy(-0.03)}
                    className="w-9 h-9 rounded-lg border-2 border-ink flex items-center justify-center hover:bg-surface" aria-label="Smaller"
                  ><Minus className="w-4 h-4" /></button>
                  <input
                    type="range" min={4} max={80} value={Math.round(selected.wFrac * 100)}
                    onMouseDown={onSliderStart}
                    onTouchStart={onSliderStart}
                    onMouseUp={onSliderEnd}
                    onTouchEnd={onSliderEnd}
                    onChange={(e) => updateSelected({ wFrac: parseInt(e.target.value, 10) / 100 })}
                    className="w-20 sm:w-28 accent-[#111827]" aria-label="Signature size"
                  />
                  <button
                    onClick={() => resizeBy(0.03)}
                    className="w-9 h-9 rounded-lg border-2 border-ink flex items-center justify-center hover:bg-surface" aria-label="Bigger"
                  ><Plus className="w-4 h-4" /></button>
                </span>

                <span className="w-px h-6 bg-ink/15" />

                {/* Rotation Controls */}
                <span className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => rotateBy(-15)}
                    className="w-9 h-9 rounded-lg border-2 border-ink flex items-center justify-center hover:bg-surface" aria-label="Rotate left"
                  ><RotateCcw className="w-4 h-4" /></button>
                  <input
                    type="range" min={-180} max={180} step={1} value={selected.rot}
                    onMouseDown={onSliderStart}
                    onTouchStart={onSliderStart}
                    onMouseUp={onSliderEnd}
                    onTouchEnd={onSliderEnd}
                    onChange={(e) => updateSelected({ rot: parseInt(e.target.value, 10) })}
                    className="w-20 sm:w-28 accent-[#111827]" aria-label="Rotation"
                  />
                  <button
                    onClick={() => rotateBy(15)}
                    className="w-9 h-9 rounded-lg border-2 border-ink flex items-center justify-center hover:bg-surface" aria-label="Rotate right"
                  ><RotateCw className="w-4 h-4" /></button>
                  <span className="text-[11px] font-mono text-on-surface-variant w-9 text-center">{selected.rot}°</span>
                </span>

                <span className="flex-1" />
                <button
                  onClick={deleteSelectedSignature}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border-2 border-error text-error text-[12px] font-bold hover:bg-error-container"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            )}

            <p className="text-[12px] text-on-surface-variant -mt-1">
              {sigPng ? "Tap anywhere on a page to place your signature. Select it to drag, resize, rotate, or press Delete/Backspace." : "Draw or upload your signature first, then tap a page to place it."}
            </p>

            {/* PDF Pages */}
            <div className="flex flex-col items-center gap-6">
              {pageUrls.map((url, i) => (
                <div key={i} className="w-full max-w-[820px]">
                  <p className="text-[11px] font-semibold text-on-surface-variant mb-1">Page {i + 1} of {pageUrls.length}</p>
                  <div
                    className="pdf-page-container relative w-full border-2 border-ink rounded-lg overflow-hidden bg-white shadow-sm cursor-copy select-none"
                    onClick={(e) => placeAt(i, e)}
                    onPointerMove={(e) => onSigPointerMove(e.currentTarget, e)}
                    onPointerUp={onSigPointerUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Page ${i + 1}`} className="w-full h-auto block pointer-events-none" draggable={false} />

                    {placements.filter((p) => p.pageIndex === i).map((p) => {
                      const isSel = p.id === selectedId;
                      return (
                        <div
                          key={p.id}
                          onPointerDown={(e) => onSigPointerDown(p.id, e)}
                          onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
                          style={{
                            position: "absolute",
                            left: `${p.cx * 100}%`,
                            top: `${p.cy * 100}%`,
                            width: `${p.wFrac * 100}%`,
                            transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
                            touchAction: "none",
                            cursor: "grab",
                            outline: isSel ? "2px dashed #2563eb" : "none",
                            outlineOffset: 3,
                          }}
                          className="group relative select-none"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.png}
                            alt="Signature placement"
                            draggable={false}
                            className="w-full h-auto block pointer-events-none"
                          />

                          {/* Interactive Corner Resize Handles */}
                          {isSel && (
                            <>
                              <div
                                onPointerDown={(e) => onCornerPointerDown(p, e)}
                                className="absolute -top-2 -left-2 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize z-10 shadow-sm"
                                title="Resize signature"
                              />
                              <div
                                onPointerDown={(e) => onCornerPointerDown(p, e)}
                                className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full cursor-nesw-resize z-10 shadow-sm"
                                title="Resize signature"
                              />
                              <div
                                onPointerDown={(e) => onCornerPointerDown(p, e)}
                                className="absolute -bottom-2 -left-2 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full cursor-nesw-resize z-10 shadow-sm"
                                title="Resize signature"
                              />
                              <div
                                onPointerDown={(e) => onCornerPointerDown(p, e)}
                                className="absolute -bottom-2 -right-2 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize z-10 shadow-sm"
                                title="Resize signature"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {padOpen && (
          <SignaturePad
            onCancel={() => setPadOpen(false)}
            onDone={(png, aspect) => { setSigPng(png); setSigAspect(aspect); setPadOpen(false); }}
          />
        )}
      </AnimatePresence>
    </ToolChrome>
  );
}
