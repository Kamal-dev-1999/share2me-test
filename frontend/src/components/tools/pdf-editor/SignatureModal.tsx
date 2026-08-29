"use client";

import { useRef, useState } from "react";
import { X, Check, RotateCcw, ImageUp, PenTool, Type } from "lucide-react";

const INK_COLORS = [
  { name: "Black", value: "#111827" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Red", value: "#dc2626" },
];

export function SignatureModal({
  onDone,
  onClose,
}: {
  onDone: (pngDataUrl: string, aspect: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [inkColor, setInkColor] = useState(INK_COLORS[0].value);

  // Draw State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<{ color: string; points: { x: number; y: number }[] }[]>([]);
  const [hasInk, setHasInk] = useState(false);

  // Type State
  const [typedText, setTypedText] = useState("");

  const W = 600;
  const H = 220;

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  };

  const clearCanvas = () => {
    strokes.current = [];
    setHasInk(false);
    redraw();
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const p = getCanvasPos(e);
    strokes.current.push({ color: inkColor, points: [p] });
    setHasInk(true);
    redraw();
  };

  const moveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = getCanvasPos(e);
    const curr = strokes.current[strokes.current.length - 1];
    if (curr) {
      curr.points.push(p);
      redraw();
    }
  };

  const stopDraw = () => {
    drawing.current = false;
  };

  const handleConfirmDraw = () => {
    const c = canvasRef.current;
    if (!c || !hasInk) return;
    const dataUrl = c.toDataURL("image/png");
    onDone(dataUrl, W / H);
  };

  const handleConfirmType = () => {
    if (!typedText.trim()) return;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.font = "italic bold 52px cursive, Georgia, serif";
    ctx.fillStyle = inkColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedText, W / 2, H / 2);
    onDone(c.toDataURL("image/png"), W / H);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        onDone(result, img.width / img.height);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <PenTool className="w-5 h-5 text-emerald-400" />
            Add Signature
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-4">
          <button
            onClick={() => setTab("draw")}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              tab === "draw" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PenTool className="w-4 h-4" /> Draw
          </button>
          <button
            onClick={() => setTab("type")}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              tab === "type" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Type className="w-4 h-4" /> Type
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              tab === "upload" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageUp className="w-4 h-4" /> Upload
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {tab === "draw" && (
            <div className="space-y-4">
              <div className="relative border border-slate-700/80 rounded-xl bg-slate-950 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  className="w-full h-44 touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={stopDraw}
                />
                {!hasInk && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-500 text-sm">
                    Draw your signature here...
                  </div>
                )}
              </div>

              {/* Ink color options */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Ink Color:</span>
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setInkColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        inkColor === c.value ? "border-emerald-400 scale-110" : "border-transparent opacity-80"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
                <button
                  onClick={clearCanvas}
                  className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDraw}
                  disabled={!hasInk}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4" /> Add Signature
                </button>
              </div>
            </div>
          )}

          {tab === "type" && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Type your name..."
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-lg font-serif italic text-white focus:outline-none focus:border-emerald-500"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Ink Color:</span>
                {INK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setInkColor(c.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      inkColor === c.value ? "border-emerald-400 scale-110" : "border-transparent opacity-80"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmType}
                  disabled={!typedText.trim()}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4" /> Add Signature
                </button>
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-4 text-center">
              <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/50 transition-colors">
                <ImageUp className="w-8 h-8 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">Click to upload signature image</span>
                <span className="text-xs text-slate-500">PNG, JPG, or WebP</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleUploadImage}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
