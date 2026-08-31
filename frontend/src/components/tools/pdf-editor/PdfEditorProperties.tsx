"use client";

import type { PdfObject, TextPdfObject, ShapePdfObject, DrawingPdfObject } from "./types";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2, ArrowUp, ArrowDown, Copy, RotateCw } from "lucide-react";

const STANDARD_FONTS = [
  '"Helvetica Neue", Helvetica, Arial, sans-serif',
  '"Times New Roman", Times, serif',
  '"Courier New", Courier, monospace',
  'Georgia, serif',
  'Calibri, "Liberation Sans", Arial, sans-serif',
  '"Trebuchet MS", sans-serif',
  'Verdana, Geneva, sans-serif',
];

export function PdfEditorProperties({
  selectedObject,
  onUpdateObject,
  onDeleteObject,
  onDuplicateObject,
  onBringForward,
  onSendBackward,
}: {
  selectedObject: PdfObject | null;
  onUpdateObject: (updated: PdfObject) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
}) {
  if (!selectedObject) {
    return (
      <div className="w-72 flex-shrink-0 h-full overflow-y-auto border-l border-white/60 bg-white/70 backdrop-blur-xl p-6 text-slate-500 text-xs flex flex-col justify-center items-center text-center gap-3 relative z-20 shadow-sm shadow-slate-900/5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm">
          <RotateCw className="w-5 h-5 animate-pulse" />
        </div>
        <p className="font-bold text-slate-800 text-sm">No Element Selected</p>
        <p className="text-slate-500 text-xs leading-relaxed">Click on any text, shape, image, or annotation on the PDF canvas to customize its properties.</p>
      </div>
    );
  }

  const isText = selectedObject.type === "text";
  const isShape = selectedObject.type === "shape";
  const isDrawing = selectedObject.type === "drawing";
  const textObj = isText ? (selectedObject as TextPdfObject) : null;
  const shapeObj = isShape ? (selectedObject as ShapePdfObject) : null;
  const drawObj = isDrawing ? (selectedObject as DrawingPdfObject) : null;

  return (
    <div className="w-72 flex-shrink-0 h-full overflow-y-auto border-l border-white/60 bg-white/70 backdrop-blur-xl p-5 text-slate-800 text-xs space-y-5 z-20 shadow-sm shadow-slate-900/5 relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] bg-slate-900/5 px-2 py-0.5 rounded-lg border border-slate-200/80">
          {selectedObject.type} Properties
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onDuplicateObject(selectedObject.id)}
            title="Duplicate Object"
            className="p-1.5 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 border border-slate-200/80 text-slate-700 hover:text-slate-950 transition-all hover:scale-105 shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteObject(selectedObject.id)}
            title="Delete Object"
            className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 hover:text-red-700 transition-all hover:scale-105 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TEXT PROPERTIES */}
      {textObj && (
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Text Content</label>
            <textarea
              value={textObj.text}
              onChange={(e) => onUpdateObject({ ...textObj, text: e.target.value })}
              className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500/80 font-sans text-xs shadow-sm"
              rows={3}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Font Family</label>
            <select
              value={textObj.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'}
              onChange={(e) => onUpdateObject({ ...textObj, fontFamily: e.target.value })}
              className="w-full px-3 py-1.5 bg-white/90 border border-slate-200/80 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-emerald-500/80 shadow-sm"
            >
              {!STANDARD_FONTS.includes(textObj.fontFamily) && textObj.fontFamily && (
                <option value={textObj.fontFamily}>{textObj.fontFamily}</option>
              )}
              <option value='"Helvetica Neue", Helvetica, Arial, sans-serif'>Helvetica / Arial</option>
              <option value='"Times New Roman", Times, serif'>Times New Roman</option>
              <option value='"Courier New", Courier, monospace'>Courier New</option>
              <option value="Georgia, serif">Georgia</option>
              <option value='Calibri, "Liberation Sans", Arial, sans-serif'>Calibri</option>
              <option value='"Trebuchet MS", sans-serif'>Trebuchet MS</option>
              <option value="Verdana, Geneva, sans-serif">Verdana</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Font Size (pt)</label>
              <input
                type="number"
                step="0.1"
                min={4}
                max={144}
                value={Number((textObj.fontSize || 12).toFixed(1))}
                onChange={(e) => onUpdateObject({ ...textObj, fontSize: parseFloat(e.target.value) || 12 })}
                className="w-full px-3 py-1.5 bg-white/90 border border-slate-200/80 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500/80 shadow-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Color</label>
              <input
                type="color"
                value={textObj.color || "#000000"}
                onChange={(e) => onUpdateObject({ ...textObj, color: e.target.value })}
                className="w-full h-8 bg-white/90 border border-slate-200/80 rounded-xl cursor-pointer p-1 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => onUpdateObject({ ...textObj, bold: !textObj.bold })}
              className={`p-2 rounded-xl border transition-all ${
                textObj.bold ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold shadow-sm" : "border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-950"
              }`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, italic: !textObj.italic })}
              className={`p-2 rounded-xl border transition-all ${
                textObj.italic ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold shadow-sm" : "border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-950"
              }`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, underline: !textObj.underline })}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                textObj.underline ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold shadow-sm" : "border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-950"
              }`}
              title="Underline"
            >
              U
            </button>
            <div className="w-px h-4 bg-slate-300/60 my-auto mx-1" />
            <button
              onClick={() => onUpdateObject({ ...textObj, align: "left" })}
              className={`p-2 rounded-xl border transition-all ${
                textObj.align === "left" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold shadow-sm" : "border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-950"
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, align: "center" })}
              className={`p-2 rounded-xl border transition-all ${
                textObj.align === "center" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold shadow-sm" : "border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-950"
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, align: "right" })}
              className={`p-2 rounded-xl border transition-all ${
                textObj.align === "right" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 font-bold shadow-sm" : "border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-950"
              }`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SHAPE PROPERTIES */}
      {shapeObj && (
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Fill Color</label>
            <input
              type="color"
              value={shapeObj.fillColor === "transparent" ? "#ffffff" : shapeObj.fillColor}
              onChange={(e) => onUpdateObject({ ...shapeObj, fillColor: e.target.value })}
              className="w-full h-8 bg-white/90 border border-slate-200/80 rounded-xl cursor-pointer p-1 shadow-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Border Color</label>
            <input
              type="color"
              value={shapeObj.strokeColor}
              onChange={(e) => onUpdateObject({ ...shapeObj, strokeColor: e.target.value })}
              className="w-full h-8 bg-white/90 border border-slate-200/80 rounded-xl cursor-pointer p-1 shadow-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Border Width</label>
            <input
              type="number"
              min={1}
              max={20}
              value={shapeObj.strokeWidth}
              onChange={(e) => onUpdateObject({ ...shapeObj, strokeWidth: Number(e.target.value) || 1 })}
              className="w-full px-3 py-1.5 bg-white/90 border border-slate-200/80 rounded-xl text-slate-900 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* DRAWING PROPERTIES */}
      {drawObj && (
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Stroke Color</label>
            <input
              type="color"
              value={drawObj.strokeColor}
              onChange={(e) => onUpdateObject({ ...drawObj, strokeColor: e.target.value })}
              className="w-full h-8 bg-white/90 border border-slate-200/80 rounded-xl cursor-pointer p-1 shadow-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Stroke Width</label>
            <input
              type="number"
              min={1}
              max={30}
              value={drawObj.strokeWidth}
              onChange={(e) => onUpdateObject({ ...drawObj, strokeWidth: Number(e.target.value) || 2 })}
              className="w-full px-3 py-1.5 bg-white/90 border border-slate-200/80 rounded-xl text-slate-900 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* COMMON PROPERTIES (OPACITY & ROTATION & STACKING) */}
      <div className="border-t border-slate-200/80 pt-4 space-y-4">
        <div>
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
            <span>Opacity</span>
            <span>{Math.round((selectedObject.opacity ?? 1.0) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={selectedObject.opacity ?? 1.0}
            onChange={(e) => onUpdateObject({ ...selectedObject, opacity: Number(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
            <span className="flex items-center gap-1"><RotateCw className="w-3 h-3 text-emerald-600" /> Rotation</span>
            <span>{Math.round(selectedObject.rotation || 0)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={selectedObject.rotation || 0}
            onChange={(e) => onUpdateObject({ ...selectedObject, rotation: Number(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Stacking Z-Order */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Z-Order (Stacking)</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBringForward(selectedObject.id)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 border border-slate-200/80 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-700 transition-all hover:scale-105 shadow-sm"
            >
              <ArrowUp className="w-3 h-3 text-emerald-600" /> Forward
            </button>
            <button
              onClick={() => onSendBackward(selectedObject.id)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 border border-slate-200/80 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-700 transition-all hover:scale-105 shadow-sm"
            >
              <ArrowDown className="w-3 h-3 text-emerald-600" /> Backward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
