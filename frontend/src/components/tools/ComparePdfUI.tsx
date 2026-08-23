"use client";

/**
 * Compare PDF — fully client-side.
 * Two documents rendered with pdfjs:
 *  - "Side by side": two columns with synchronized scrolling
 *  - "Differences": per-page pixel diff — unchanged content dimmed,
 *    changed pixels highlighted in red
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Columns2, Diff, FileUp } from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { ToolChrome } from "./ToolChrome";
import { renderPdfToCanvases } from "@/lib/pdfRender";

type ViewMode = "side" | "diff";
const MAX_PAGES = 40;

function PickCard({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex-1 min-w-[220px] flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
        file ? "border-ink bg-surface-container" : "border-ink/25 bg-surface hover:bg-surface-container"
      }`}
    >
      <input type="file" accept="application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <FileUp className="w-6 h-6 text-on-surface-variant" />
      <span className="text-[14px] font-bold text-on-surface">{label}</span>
      <span className="text-[12px] text-on-surface-variant break-all">{file ? file.name : "Drop a PDF or tap to browse"}</span>
    </label>
  );
}

function buildDiff(a: HTMLCanvasElement | undefined, b: HTMLCanvasElement | undefined): string {
  const w = Math.max(a?.width ?? 0, b?.width ?? 0);
  const h = Math.max(a?.height ?? 0, b?.height ?? 0);
  const norm = (src?: HTMLCanvasElement) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    if (src) ctx.drawImage(src, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  };
  const da = norm(a), db = norm(b);
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d")!;
  const img = octx.createImageData(w, h);
  const T = 40; // per-channel tolerance — ignores anti-aliasing noise

  for (let i = 0; i < da.data.length; i += 4) {
    const changed =
      Math.abs(da.data[i] - db.data[i]) > T ||
      Math.abs(da.data[i + 1] - db.data[i + 1]) > T ||
      Math.abs(da.data[i + 2] - db.data[i + 2]) > T;
    if (changed) {
      img.data[i] = 220; img.data[i + 1] = 38; img.data[i + 2] = 38; img.data[i + 3] = 255;
    } else {
      // Dimmed grayscale of document A as context
      const g = Math.round(255 - (255 - (da.data[i] * 0.299 + da.data[i + 1] * 0.587 + da.data[i + 2] * 0.114)) * 0.35);
      img.data[i] = g; img.data[i + 1] = g; img.data[i + 2] = g; img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out.toDataURL("image/jpeg", 0.85);
}

export function ComparePdfUI({ tool }: { tool: PdfTool }) {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [pagesA, setPagesA] = useState<string[]>([]);
  const [pagesB, setPagesB] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [truncatedNote, setTruncatedNote] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("side");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const compare = async () => {
    if (!fileA || !fileB) return;
    setError(null);
    setLoading(true);
    setPagesA([]); setPagesB([]); setDiffs([]);
    try {
      setProgress("Rendering first document…");
      const { pages: ra, totalPages: ta } = await renderPdfToCanvases(await fileA.arrayBuffer(), 1.4, (d, t) => setProgress(`Document A — page ${d}/${t}`), MAX_PAGES);
      setProgress("Rendering second document…");
      const { pages: rb, totalPages: tb } = await renderPdfToCanvases(await fileB.arrayBuffer(), 1.4, (d, t) => setProgress(`Document B — page ${d}/${t}`), MAX_PAGES);

      setTruncatedNote(
        ta > ra.length || tb > rb.length
          ? `Comparing the first ${MAX_PAGES} pages (A has ${ta}, B has ${tb}).`
          : null
      );
      setPagesA(ra.map((p) => p.canvas.toDataURL("image/jpeg", 0.82)));
      setPagesB(rb.map((p) => p.canvas.toDataURL("image/jpeg", 0.82)));

      setProgress("Computing differences…");
      const n = Math.max(ra.length, rb.length);
      const d: string[] = [];
      for (let i = 0; i < n; i++) {
        // Yield to the UI thread between heavy pixel passes.
        await new Promise((r) => setTimeout(r, 0));
        setProgress(`Comparing page ${i + 1}/${n}…`);
        d.push(buildDiff(ra[i]?.canvas, rb[i]?.canvas));
      }
      setDiffs(d);
    } catch {
      setError("Couldn't compare these files. Make sure both are valid, non-encrypted PDFs.");
    } finally {
      setLoading(false);
    }
  };

  // Synchronized scrolling (proportional, so different page counts still track)
  useEffect(() => {
    const l = leftRef.current, r = rightRef.current;
    if (!l || !r || mode !== "side") return;
    const link = (src: HTMLDivElement, dst: HTMLDivElement) => () => {
      if (syncing.current) return;
      syncing.current = true;
      const ratio = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
      requestAnimationFrame(() => { syncing.current = false; });
    };
    const onL = link(l, r), onR = link(r, l);
    l.addEventListener("scroll", onL, { passive: true });
    r.addEventListener("scroll", onR, { passive: true });
    return () => { l.removeEventListener("scroll", onL); r.removeEventListener("scroll", onR); };
  }, [mode, pagesA.length, pagesB.length]);

  const ready = pagesA.length > 0 && pagesB.length > 0;

  return (
    <ToolChrome tool={tool}>
      <div className="card-brutalist p-4 sm:p-8">
        {error && (
          <div className="mb-4 p-3 border-2 border-error bg-error-container text-on-error-container text-sm font-semibold rounded-md">{error}</div>
        )}

        {/* Pickers */}
        <div className="flex flex-col sm:flex-row gap-3">
          <PickCard label="Original (A)" file={fileA} onFile={setFileA} />
          <PickCard label="Revised (B)" file={fileB} onFile={setFileB} />
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={compare}
            disabled={!fileA || !fileB || loading}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Diff className="w-4 h-4" />}
            {loading ? progress : "Compare"}
          </button>

          {ready && (
            <div className="inline-flex rounded-lg border-2 border-ink overflow-hidden">
              {([
                { m: "side" as ViewMode, icon: Columns2, label: "Side by side" },
                { m: "diff" as ViewMode, icon: Diff, label: "Differences" },
              ]).map(({ m, icon: Icon, label }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`inline-flex items-center gap-1.5 h-10 px-3.5 text-[12px] font-bold transition-colors ${mode === m ? "bg-ink text-white" : "bg-surface text-on-surface hover:bg-surface-container"}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
          {ready && pagesA.length !== pagesB.length && (
            <span className="text-[12px] font-semibold text-error">
              Page counts differ: A has {pagesA.length}, B has {pagesB.length}
            </span>
          )}
          {truncatedNote && <span className="text-[12px] font-semibold text-on-surface-variant">{truncatedNote}</span>}
        </div>

        {/* Side-by-side */}
        {ready && mode === "side" && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-4">
            {[{ ref: leftRef, urls: pagesA, label: "A — " + (fileA?.name ?? "") }, { ref: rightRef, urls: pagesB, label: "B — " + (fileB?.name ?? "") }].map((col, ci) => (
              <div key={ci} className="min-w-0">
                <p className="text-[11px] font-bold text-on-surface-variant mb-1.5 truncate">{col.label}</p>
                <div ref={col.ref} className="h-[65vh] overflow-y-auto rounded-lg border-2 border-ink bg-surface-container p-1.5 sm:p-3 flex flex-col gap-3">
                  {col.urls.map((u, i) => (
                    <div key={i}>
                      <p className="text-[10px] font-semibold text-on-surface-variant mb-0.5">Page {i + 1}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`Page ${i + 1}`} className="w-full h-auto border border-ink/15 rounded bg-white" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Diff overlay */}
        {ready && mode === "diff" && (
          <div className="mt-5 flex flex-col items-center gap-6">
            <p className="text-[12px] text-on-surface-variant self-start">
              <span className="inline-block w-3 h-3 bg-[#dc2626] rounded-[3px] align-middle mr-1.5" />
              Red = content that differs between A and B. Gray = identical content.
            </p>
            {diffs.map((u, i) => (
              <div key={i} className="w-full max-w-[820px]">
                <p className="text-[11px] font-semibold text-on-surface-variant mb-1">Page {i + 1} of {diffs.length}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Diff page ${i + 1}`} className="w-full h-auto border-2 border-ink rounded-lg bg-white" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolChrome>
  );
}
