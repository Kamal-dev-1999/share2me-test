"use client";

import type { ToolMode } from "./types";
import {
  MousePointer,
  Type,
  FileText,
  Image as ImageIcon,
  Square,
  PenTool,
  Eraser,
  Highlighter,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  MessageSquare,
  PenLine,
  CheckSquare,
  SquareSlash,
} from "lucide-react";

const TOOLS: { mode: ToolMode; label: string; icon: any }[] = [
  { mode: "select", label: "Select (V)", icon: MousePointer },
  { mode: "text", label: "Add Text (T)", icon: Type },
  { mode: "edit-text", label: "Edit Existing Text", icon: FileText },
  { mode: "image", label: "Add Image", icon: ImageIcon },
  { mode: "shape", label: "Add Shape", icon: Square },
  { mode: "draw", label: "Freehand Draw (P)", icon: PenTool },
  { mode: "eraser", label: "Eraser (E)", icon: Eraser },
  { mode: "highlight", label: "Highlight (H)", icon: Highlighter },
  { mode: "underline", label: "Underline (U)", icon: UnderlineIcon },
  { mode: "strikethrough", label: "Strikethrough", icon: StrikethroughIcon },
  { mode: "comment", label: "Sticky Comment", icon: MessageSquare },
  { mode: "signature", label: "Add Signature", icon: PenLine },
  { mode: "checkbox", label: "Checkbox", icon: CheckSquare },
  { mode: "whiteout", label: "Whiteout / Cover", icon: SquareSlash },
];

export function PdfEditorSidebar({
  activeMode,
  onSelectMode,
}: {
  activeMode: ToolMode;
  onSelectMode: (mode: ToolMode) => void;
}) {
  return (
    <div className="w-16 border-r border-white/60 bg-white/70 backdrop-blur-xl flex flex-col items-center py-4 gap-2 z-30 shadow-sm shadow-slate-900/5 relative">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = activeMode === t.mode;
        return (
          <button
            key={t.mode}
            onClick={() => onSelectMode(t.mode)}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative group z-10 ${
              isActive
                ? "bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 font-bold scale-105 border border-emerald-400/40"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-900/5 hover:border hover:border-slate-200/80"
            }`}
          >
            <Icon className="w-5 h-5" />
            {/* High-Contrast Floating Tooltip Popup (Popping out to the Right inside workspace area) */}
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-2xl border border-slate-700 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-all z-50 flex items-center gap-1">
              <span className="w-2 h-2 bg-slate-900 rotate-45 absolute -left-1 top-1/2 -translate-y-1/2 border-l border-b border-slate-700" />
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
