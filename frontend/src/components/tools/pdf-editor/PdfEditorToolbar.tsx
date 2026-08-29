"use client";

import { Undo2, Redo2, ZoomIn, ZoomOut, Download, Loader2, ChevronLeft, ChevronRight, Search, ArrowLeft } from "lucide-react";

export function PdfEditorToolbar({
  currentPage,
  totalPages,
  zoomScale,
  canUndo,
  canRedo,
  isExporting,
  searchQuery,
  onSetSearchQuery,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onUndo,
  onRedo,
  onExport,
  onBack,
}: {
  currentPage: number; // 1-indexed
  totalPages: number;
  zoomScale: number;
  canUndo: boolean;
  canRedo: boolean;
  isExporting: boolean;
  searchQuery: string;
  onSetSearchQuery: (q: string) => void;
  onPageChange: (page: number) => void;
  onZoomChange: (scale: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onBack: () => void;
}) {
  return (
    <div className="h-14 border-b border-slate-800/80 bg-slate-900 px-4 flex items-center justify-between text-slate-200 z-30 shadow-sm">
      {/* Left section: Back & Document Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Back to Tools"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="h-4 w-px bg-slate-800" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle section: Page Navigation & Zoom & Search */}
      <div className="flex items-center gap-4">
        {/* Page Nav */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-xl text-xs">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-slate-400">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1 && val <= totalPages) onPageChange(val);
            }}
            className="w-8 text-center bg-slate-900 border border-slate-800 rounded font-semibold text-white focus:outline-none"
          />
          <span className="text-slate-400">/ {totalPages}</span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-xl text-xs">
          <button
            onClick={() => onZoomChange(Math.max(0.25, zoomScale - 0.25))}
            title="Zoom Out"
            className="p-1 hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center font-semibold text-slate-200">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(4.0, zoomScale + 0.25))}
            title="Zoom In"
            className="p-1 hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-slate-800 mx-1" />
          <button onClick={onFitWidth} className="px-1.5 py-0.5 hover:text-white text-[11px]">
            Width
          </button>
          <button onClick={onFitPage} className="px-1.5 py-0.5 hover:text-white text-[11px]">
            Page
          </button>
        </div>

        {/* Text Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search text..."
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            className="w-36 pl-8 pr-2 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Right section: Export / Download */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? "Preparing PDF..." : "Export PDF"}
        </button>
      </div>
    </div>
  );
}
