"use client";

import type { RenderedPage } from "@/lib/pdfRender";
import type { PageState } from "./types";
import { RotateCw, Trash2, Plus, ArrowUp, ArrowDown, Copy } from "lucide-react";

export function PdfEditorThumbnails({
  renderedPages,
  pagesState,
  currentPageIndex,
  onSelectPage,
  onRotatePage,
  onDeletePage,
  onDuplicatePage,
  onMovePage,
  onAddBlankPage,
}: {
  renderedPages: RenderedPage[];
  pagesState: PageState[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onRotatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onAddBlankPage: (afterIndex: number) => void;
}) {
  const visiblePages = pagesState.map((state, idx) => ({ state, originalIdx: idx })).filter((p) => !p.state.isDeleted);

  return (
    <div className="w-52 border-r border-white/60 bg-white/60 backdrop-blur-xl flex flex-col h-full overflow-y-auto p-4 gap-4 text-slate-800 z-20 shadow-sm shadow-slate-900/5 relative">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pages ({visiblePages.length})</span>
        <button
          onClick={() => onAddBlankPage(currentPageIndex)}
          className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 text-xs font-bold flex items-center gap-1 transition-all hover:scale-105 shadow-sm"
          title="Add Blank Page"
        >
          <Plus className="w-3.5 h-3.5" /> Blank
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        {visiblePages.map(({ state, originalIdx }, displayIdx) => {
          const isSelected = originalIdx === currentPageIndex;
          const pageRender = renderedPages[state.pageIndex];

          return (
            <div
              key={`thumb-${originalIdx}`}
              onClick={() => onSelectPage(originalIdx)}
              className={`flex flex-col gap-2 p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                isSelected
                  ? "border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/30"
                  : "border-slate-200/80 bg-white/60 hover:border-slate-300 hover:bg-white/80"
              }`}
            >
              {/* Page Number & Controls Bar */}
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-bold text-slate-800">Page {displayIdx + 1}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {displayIdx > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMovePage(originalIdx, visiblePages[displayIdx - 1].originalIdx); }}
                      title="Move Up"
                      className="p-1 rounded hover:bg-slate-900/10 hover:text-slate-950 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                  )}
                  {displayIdx < visiblePages.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMovePage(originalIdx, visiblePages[displayIdx + 1].originalIdx); }}
                      title="Move Down"
                      className="p-1 rounded hover:bg-slate-900/10 hover:text-slate-950 transition-colors"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRotatePage(originalIdx); }}
                    title="Rotate 90°"
                    className="p-1 rounded hover:bg-slate-900/10 hover:text-slate-950 transition-colors"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicatePage(originalIdx); }}
                    title="Duplicate Page"
                    className="p-1 rounded hover:bg-slate-900/10 hover:text-slate-950 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {visiblePages.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeletePage(originalIdx); }}
                      title="Delete Page"
                      className="p-1 rounded hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnail Render Box */}
              <div className="w-full aspect-[1/1.3] bg-white rounded-xl overflow-hidden flex items-center justify-center shadow-md relative border border-slate-200">
                {pageRender ? (
                  <img
                    src={pageRender.canvas.toDataURL()}
                    alt={`Page ${displayIdx + 1}`}
                    className="w-full h-full object-contain transition-transform"
                    style={{ transform: `rotate(${state.rotation}deg)` }}
                  />
                ) : (
                  <div className="text-slate-400 text-xs italic">Blank Page</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
