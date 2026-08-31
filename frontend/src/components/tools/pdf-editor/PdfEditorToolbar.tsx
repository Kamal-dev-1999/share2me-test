"use client";

import { Undo2, Redo2, ZoomIn, ZoomOut, Download, Loader2, ChevronLeft, ChevronRight, Search, ArrowLeft } from "lucide-react";

export function PdfEditorToolbar({
  currentPage,
  totalPages,
  zoomScale,
  zoomMode,
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
  zoomMode: "fit-page" | "fit-width" | "manual";
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
  const ZOOM_PRESETS = [0.25, 0.33, 0.40, 0.50, 0.60, 0.67, 0.75, 0.80, 0.90, 1.0, 1.10, 1.25, 1.50, 1.75, 2.0, 2.50, 3.0, 4.0];

  const handleZoomIn = () => {
    const next = ZOOM_PRESETS.find((s) => s > zoomScale + 0.02) ?? ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
    onZoomChange(next);
  };

  const handleZoomOut = () => {
    const prev = [...ZOOM_PRESETS].reverse().find((s) => s < zoomScale - 0.02) ?? ZOOM_PRESETS[0];
    onZoomChange(prev);
  };

  return (
    <div className="h-16 border-b border-white/60 bg-white/70 backdrop-blur-xl px-6 flex items-center justify-between text-slate-800 z-30 shadow-sm shadow-slate-900/5 relative">
      {/* Left section: Back & Undo / Redo */}
      <div className="flex items-center gap-3 relative z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl text-slate-700 hover:text-slate-950 bg-slate-900/5 hover:bg-slate-900/10 border border-slate-200/80 transition-all hover:scale-105 shadow-sm"
          title="Back to Tools"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="h-5 w-px bg-slate-300/60" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-slate-900/5 p-1 rounded-2xl border border-slate-200/80 shadow-inner">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-white/80 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-white/80 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle section: Page Navigation & Zoom & Search */}
      <div className="flex items-center gap-4 relative z-10">
        {/* Page Nav */}
        <div className="flex items-center gap-1.5 bg-slate-900/5 backdrop-blur-md border border-slate-200/80 px-3 py-1.5 rounded-2xl text-xs shadow-inner">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 text-slate-600 hover:text-slate-950 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-slate-500 font-medium">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1 && val <= totalPages) onPageChange(val);
            }}
            className="w-9 text-center bg-white/90 border border-slate-200/80 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500/80 shadow-sm"
          />
          <span className="text-slate-500 font-medium">/ {totalPages}</span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 text-slate-600 hover:text-slate-950 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Enhanced Intuitive Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/5 backdrop-blur-md border border-slate-200/80 px-3 py-1.5 rounded-2xl text-xs shadow-inner">
          <button
            onClick={handleZoomOut}
            title="Zoom Out (Ctrl + -)"
            className="p-1 text-slate-600 hover:text-slate-950 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Percentage Preset Dropdown */}
          <select
            value={zoomScale}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="bg-white/90 border border-slate-200/80 rounded-lg font-bold text-slate-900 text-xs px-2 py-0.5 focus:outline-none focus:border-emerald-500/80 shadow-sm cursor-pointer"
          >
            {ZOOM_PRESETS.map((scale) => (
              <option key={scale} value={scale}>
                {Math.round(scale * 100)}%
              </option>
            ))}
            {!ZOOM_PRESETS.includes(zoomScale) && (
              <option value={zoomScale}>{Math.round(zoomScale * 100)}%</option>
            )}
          </select>

          <button
            onClick={handleZoomIn}
            title="Zoom In (Ctrl + +)"
            className="p-1 text-slate-600 hover:text-slate-950 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-slate-300/60 mx-1" />

          {/* Fit Page & Width Mode Buttons */}
          <button
            onClick={onFitPage}
            title="Fit Page to Viewport (Ctrl + 0)"
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
              zoomMode === "fit-page"
                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/40 shadow-sm"
                : "text-slate-600 hover:text-slate-950 hover:bg-white/60"
            }`}
          >
            Fit Page
          </button>
          <button
            onClick={onFitWidth}
            title="Fit Page Width to Viewport"
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
              zoomMode === "fit-width"
                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/40 shadow-sm"
                : "text-slate-600 hover:text-slate-950 hover:bg-white/60"
            }`}
          >
            Width
          </button>
        </div>

        {/* Text Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search PDF text..."
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            className="w-44 pl-9 pr-3 py-1.5 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/80 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Right section: Export / Download */}
      <div className="flex items-center gap-3 relative z-10">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-5 py-2 text-xs font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? "Compiling PDF..." : "Export PDF"}
        </button>
      </div>
    </div>
  );
}
