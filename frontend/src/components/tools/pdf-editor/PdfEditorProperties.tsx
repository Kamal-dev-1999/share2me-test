"use client";

import type { PdfObject, TextPdfObject, ShapePdfObject, DrawingPdfObject } from "./types";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2, ArrowUp, ArrowDown, Copy, RotateCw } from "lucide-react";

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
      <div className="w-64 border-l border-slate-800/80 bg-slate-900/60 p-4 text-slate-400 text-xs flex flex-col justify-center items-center text-center gap-2">
        <p className="font-semibold text-slate-300">No Element Selected</p>
        <p>Click on any text, shape, image, or annotation on the PDF canvas to edit its properties.</p>
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
    <div className="w-64 border-l border-slate-800/80 bg-slate-900 p-4 text-slate-200 text-xs space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-bold text-slate-100 uppercase tracking-wider text-[10px]">
          {selectedObject.type} Properties
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateObject(selectedObject.id)}
            title="Duplicate Object"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteObject(selectedObject.id)}
            title="Delete Object"
            className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TEXT PROPERTIES */}
      {textObj && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-slate-400 block mb-1">Text Content</label>
            <textarea
              value={textObj.text}
              onChange={(e) => onUpdateObject({ ...textObj, text: e.target.value })}
              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-1">Font Size</label>
              <input
                type="number"
                min={8}
                max={120}
                value={textObj.fontSize}
                onChange={(e) => onUpdateObject({ ...textObj, fontSize: Number(e.target.value) || 12 })}
                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-1">Color</label>
              <input
                type="color"
                value={textObj.color}
                onChange={(e) => onUpdateObject({ ...textObj, color: e.target.value })}
                className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 pt-1">
            <button
              onClick={() => onUpdateObject({ ...textObj, bold: !textObj.bold })}
              className={`p-1.5 rounded border ${
                textObj.bold ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-slate-800 text-slate-400"
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, italic: !textObj.italic })}
              className={`p-1.5 rounded border ${
                textObj.italic ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-slate-800 text-slate-400"
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-800 my-auto mx-1" />
            <button
              onClick={() => onUpdateObject({ ...textObj, align: "left" })}
              className={`p-1.5 rounded border ${
                textObj.align === "left" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-slate-800 text-slate-400"
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, align: "center" })}
              className={`p-1.5 rounded border ${
                textObj.align === "center" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-slate-800 text-slate-400"
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateObject({ ...textObj, align: "right" })}
              className={`p-1.5 rounded border ${
                textObj.align === "right" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-slate-800 text-slate-400"
              }`}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SHAPE PROPERTIES */}
      {shapeObj && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-slate-400 block mb-1">Fill Color</label>
            <input
              type="color"
              value={shapeObj.fillColor === "transparent" ? "#ffffff" : shapeObj.fillColor}
              onChange={(e) => onUpdateObject({ ...shapeObj, fillColor: e.target.value })}
              className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-400 block mb-1">Border Color</label>
            <input
              type="color"
              value={shapeObj.strokeColor}
              onChange={(e) => onUpdateObject({ ...shapeObj, strokeColor: e.target.value })}
              className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-400 block mb-1">Border Width</label>
            <input
              type="number"
              min={1}
              max={20}
              value={shapeObj.strokeWidth}
              onChange={(e) => onUpdateObject({ ...shapeObj, strokeWidth: Number(e.target.value) || 1 })}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-100"
            />
          </div>
        </div>
      )}

      {/* DRAWING PROPERTIES */}
      {drawObj && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-slate-400 block mb-1">Stroke Color</label>
            <input
              type="color"
              value={drawObj.strokeColor}
              onChange={(e) => onUpdateObject({ ...drawObj, strokeColor: e.target.value })}
              className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-400 block mb-1">Stroke Width</label>
            <input
              type="number"
              min={1}
              max={30}
              value={drawObj.strokeWidth}
              onChange={(e) => onUpdateObject({ ...drawObj, strokeWidth: Number(e.target.value) || 2 })}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-100"
            />
          </div>
        </div>
      )}

      {/* COMMON PROPERTIES (OPACITY & ROTATION & STACKING) */}
      <div className="border-t border-slate-800 pt-3 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
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
            className="w-full accent-emerald-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span className="flex items-center gap-1"><RotateCw className="w-3 h-3" /> Rotation</span>
            <span>{Math.round(selectedObject.rotation || 0)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={selectedObject.rotation || 0}
            onChange={(e) => onUpdateObject({ ...selectedObject, rotation: Number(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Stacking Z-Order */}
        <div>
          <label className="text-[10px] font-medium text-slate-400 block mb-1">Z-Order (Stacking)</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBringForward(selectedObject.id)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 text-[11px]"
            >
              <ArrowUp className="w-3 h-3" /> Forward
            </button>
            <button
              onClick={() => onSendBackward(selectedObject.id)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 text-[11px]"
            >
              <ArrowDown className="w-3 h-3" /> Backward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
