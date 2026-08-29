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
    <div className="w-48 border-r border-slate-800/80 bg-slate-900 flex flex-col h-full overflow-y-auto p-3 gap-4 text-slate-200 z-20">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pages ({visiblePages.length})</span>
        <button
          onClick={() => onAddBlankPage(currentPageIndex)}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs flex items-center gap-1"
          title="Add Blank Page"
        >
          <Plus className="w-3.5 h-3.5" /> Blank
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {visiblePages.map(({ state, originalIdx }, displayIdx) => {
          const isSelected = originalIdx === currentPageIndex;
          const pageRender = renderedPages[state.pageIndex];

          return (
            <div
              key={`thumb-${originalIdx}`}
              onClick={() => onSelectPage(originalIdx)}
              className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-all cursor-pointer group ${
                isSelected
                  ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
              }`}
            >
              {/* Page Number & Controls Bar */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Page {displayIdx + 1}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {displayIdx > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMovePage(originalIdx, visiblePages[displayIdx - 1].originalIdx); }}
                      title="Move Up"
                      className="p-0.5 hover:text-white"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                  )}
                  {displayIdx < visiblePages.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMovePage(originalIdx, visiblePages[displayIdx + 1].originalIdx); }}
                      title="Move Down"
                      className="p-0.5 hover:text-white"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRotatePage(originalIdx); }}
                    title="Rotate 90°"
                    className="p-0.5 hover:text-white"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicatePage(originalIdx); }}
                    title="Duplicate Page"
                    className="p-0.5 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {visiblePages.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeletePage(originalIdx); }}
                      title="Delete Page"
                      className="p-0.5 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnail Render Box */}
              <div className="w-full aspect-[1/1.3] bg-white rounded overflow-hidden flex items-center justify-center shadow-inner relative">
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
