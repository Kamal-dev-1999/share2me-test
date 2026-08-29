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
    <div className="w-16 border-r border-slate-800/80 bg-slate-900 flex flex-col items-center py-3 gap-1.5 z-20 shadow-md">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = activeMode === t.mode;
        return (
          <button
            key={t.mode}
            onClick={() => onSelectMode(t.mode)}
            title={t.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
              isActive
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold scale-105"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
            }`}
          >
            <Icon className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute left-14 bg-slate-950 text-slate-100 text-[11px] px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-800">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
