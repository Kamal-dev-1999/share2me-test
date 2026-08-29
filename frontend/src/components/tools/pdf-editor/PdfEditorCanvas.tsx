"use client";

import { useRef, useState, useEffect } from "react";
import type { RenderedPage } from "@/lib/pdfRender";
import type { PdfObject, ToolMode, Point, ExtractedTextItem, TextPdfObject, DrawingPdfObject } from "./types";
import { RotateCw, Move, Trash2 } from "lucide-react";

export function PdfEditorCanvas({
  pageRender,
  pageIndex,
  pageRotation,
  zoomScale,
  activeMode,
  objects,
  selectedObjectId,
  extractedTextItems,
  onSelectObject,
  onAddObject,
  onUpdateObject,
  onDeleteObject,
  onOpenSignatureModal,
  onOpenImagePicker,
}: {
  pageRender: RenderedPage | null;
  pageIndex: number;
  pageRotation: number;
  zoomScale: number;
  activeMode: ToolMode;
  objects: PdfObject[];
  selectedObjectId: string | null;
  extractedTextItems: ExtractedTextItem[];
  onSelectObject: (id: string | null) => void;
  onAddObject: (obj: PdfObject) => void;
  onUpdateObject: (obj: PdfObject) => void;
  onDeleteObject: (id: string) => void;
  onOpenSignatureModal: () => void;
  onOpenImagePicker: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Freehand Pen Drawing state
  const isDrawing = useRef(false);
  const currentPath = useRef<Point[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);

  // Pointer Dragging / Resizing / Rotating object state
  const dragRef = useRef<{
    mode: "move" | "resize" | "rotate";
    handle?: string;
    startPoint: { x: number; y: number };
    startObjectState: PdfObject;
  } | null>(null);

  const baseW = pageRender ? pageRender.canvas.width : 595;
  const baseH = pageRender ? pageRender.canvas.height : 841;

  const displayW = baseW * zoomScale;
  const displayH = baseH * zoomScale;

  // Filter objects belonging to current page
  const pageObjects = objects
    .filter((o) => o.pageIndex === pageIndex)
    .sort((a, b) => a.zIndex - b.zIndex);

  const selectedObj = pageObjects.find((o) => o.id === selectedObjectId);

  // Helper to compute fraction coordinates (0..1) from container click
  const getFractionCoords = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { xFrac: 0, yFrac: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const xPx = clientX - rect.left;
    const yPx = clientY - rect.top;

    return {
      xFrac: Math.max(0, Math.min(1, xPx / displayW)),
      yFrac: Math.max(0, Math.min(1, yPx / displayH)),
    };
  };

  // Handle canvas click to place objects depending on active tool mode
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) return;

    const { xFrac, yFrac } = getFractionCoords(e);
    const id = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const defaultZ = objects.length + 1;

    if (activeMode === "text") {
      onAddObject({
        id,
        type: "text",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.25,
        hFrac: 0.05,
        rotation: 0,
        opacity: 1.0,
        zIndex: defaultZ,
        text: "Click to edit text",
        fontFamily: "Helvetica",
        fontSize: 16,
        color: "#000000",
        bold: false,
        italic: false,
        underline: false,
        align: "left",
      });
    } else if (activeMode === "shape") {
      onAddObject({
        id,
        type: "shape",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.2,
        hFrac: 0.15,
        rotation: 0,
        opacity: 1.0,
        zIndex: defaultZ,
        shapeType: "rectangle",
        fillColor: "transparent",
        strokeColor: "#10b981",
        strokeWidth: 2,
      });
    } else if (activeMode === "highlight") {
      onAddObject({
        id,
        type: "highlight",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.3,
        hFrac: 0.03,
        rotation: 0,
        opacity: 0.45,
        zIndex: defaultZ,
        color: "#ffeb3b",
      });
    } else if (activeMode === "underline") {
      onAddObject({
        id,
        type: "underline",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.25,
        hFrac: 0.01,
        rotation: 0,
        opacity: 1.0,
        zIndex: defaultZ,
        color: "#000000",
        strokeWidth: 2,
      });
    } else if (activeMode === "strikethrough") {
      onAddObject({
        id,
        type: "strikethrough",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.25,
        hFrac: 0.01,
        rotation: 0,
        opacity: 1.0,
        zIndex: defaultZ,
        color: "#ef4444",
        strokeWidth: 2,
      });
    } else if (activeMode === "whiteout") {
      onAddObject({
        id,
        type: "whiteout",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.2,
        hFrac: 0.04,
        rotation: 0,
        opacity: 1.0,
        zIndex: defaultZ,
      });
    } else if (activeMode === "signature") {
      onOpenSignatureModal();
    } else if (activeMode === "image") {
      onOpenImagePicker();
    } else if (activeMode === "checkbox") {
      onAddObject({
        id,
        type: "checkbox",
        pageIndex,
        xFrac,
        yFrac,
        wFrac: 0.03,
        hFrac: 0.03,
        rotation: 0,
        opacity: 1.0,
        zIndex: defaultZ,
        checked: false,
        color: "#10b981",
      });
    } else if (activeMode === "select") {
      onSelectObject(null);
    }
  };

  // Freehand Pen Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (activeMode !== "draw") return;
    isDrawing.current = true;
    const { xFrac, yFrac } = getFractionCoords(e);
    currentPath.current = [{ x: xFrac, y: yFrac }];
    setDrawingPoints([...currentPath.current]);
  };

  const moveDrawing = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawing.current || activeMode !== "draw") return;
    const { xFrac, yFrac } = getFractionCoords(e);
    currentPath.current.push({ x: xFrac, y: yFrac });
    setDrawingPoints([...currentPath.current]);
  };

  const stopDrawing = () => {
    if (!isDrawing.current || activeMode !== "draw") return;
    isDrawing.current = false;
    const pts = [...currentPath.current];
    if (pts.length > 1) {
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));

      const wFrac = Math.max(0.01, maxX - minX);
      const hFrac = Math.max(0.01, maxY - minY);

      const normalizedPts = pts.map((p) => ({
        x: (p.x - minX) / wFrac,
        y: (p.y - minY) / hFrac,
      }));

      onAddObject({
        id: `draw-${Date.now()}`,
        type: "drawing",
        pageIndex,
        xFrac: minX,
        yFrac: minY,
        wFrac,
        hFrac,
        rotation: 0,
        opacity: 1.0,
        zIndex: objects.length + 1,
        points: normalizedPts,
        strokeColor: "#10b981",
        strokeWidth: 3,
      });
    }
    currentPath.current = [];
    setDrawingPoints([]);
  };

  // Pointer drag event handlers for moving/resizing selected object
  const startDragObject = (e: React.MouseEvent, mode: "move" | "resize" | "rotate", handle?: string) => {
    e.stopPropagation();
    if (!selectedObj) return;

    dragRef.current = {
      mode,
      handle,
      startPoint: { x: e.clientX, y: e.clientY },
      startObjectState: { ...selectedObj },
    };
  };

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      if (!dragRef.current || !selectedObj) return;

      const { mode, handle, startPoint, startObjectState } = dragRef.current;
      const dxFrac = (e.clientX - startPoint.x) / displayW;
      const dyFrac = (e.clientY - startPoint.y) / displayH;

      if (mode === "move") {
        onUpdateObject({
          ...selectedObj,
          xFrac: Math.max(0, Math.min(1 - startObjectState.wFrac, startObjectState.xFrac + dxFrac)),
          yFrac: Math.max(0, Math.min(1 - startObjectState.hFrac, startObjectState.yFrac + dyFrac)),
        });
      } else if (mode === "resize") {
        let newW = startObjectState.wFrac;
        let newH = startObjectState.hFrac;

        if (handle?.includes("e")) newW = Math.max(0.02, startObjectState.wFrac + dxFrac);
        if (handle?.includes("s")) newH = Math.max(0.02, startObjectState.hFrac + dyFrac);

        onUpdateObject({
          ...selectedObj,
          wFrac: newW,
          hFrac: newH,
        });
      } else if (mode === "rotate") {
        const centerXPx = (startObjectState.xFrac + startObjectState.wFrac / 2) * displayW;
        const centerYPx = (startObjectState.yFrac + startObjectState.hFrac / 2) * displayH;
        const angleRad = Math.atan2(e.clientY - centerYPx, e.clientX - centerXPx);
        let angleDeg = Math.round((angleRad * 180) / Math.PI);
        if (angleDeg < 0) angleDeg += 360;

        onUpdateObject({
          ...selectedObj,
          rotation: angleDeg,
        });
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [selectedObj, displayW, displayH]);

  return (
    <div className="flex justify-center p-8 overflow-auto min-h-full">
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        onMouseDown={startDrawing}
        onMouseMove={moveDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={moveDrawing}
        onTouchEnd={stopDrawing}
        className="relative bg-white shadow-2xl rounded-sm select-none transition-all border border-slate-200"
        style={{
          width: displayW,
          height: displayH,
          transform: `rotate(${pageRotation}deg)`,
        }}
      >
        {/* BASE PDF.JS RENDERED CANVAS */}
        {pageRender ? (
          <img
            src={pageRender.canvas.toDataURL()}
            alt={`PDF Page ${pageIndex + 1}`}
            className="w-full h-full pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-white flex items-center justify-center text-slate-400">
            Blank Canvas Page
          </div>
        )}

        {/* EXTRACTED TEXT OVERLAY FOR EXISTING TEXT EDITING */}
        {activeMode === "edit-text" &&
          extractedTextItems
            .filter((t) => t.pageIndex === pageIndex)
            .map((item) => (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddObject({
                    id: `edit-${item.id}`,
                    type: "text",
                    pageIndex,
                    xFrac: item.xFrac,
                    yFrac: item.yFrac,
                    wFrac: item.wFrac,
                    hFrac: item.hFrac,
                    rotation: 0,
                    opacity: 1.0,
                    zIndex: objects.length + 1,
                    text: item.text,
                    fontFamily: "Helvetica",
                    fontSize: item.fontSize,
                    color: item.color,
                    bold: false,
                    italic: false,
                    underline: false,
                    align: "left",
                    isExistingText: true,
                  });
                }}
                className="absolute border border-dashed border-emerald-400 bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/30 transition-colors z-10"
                style={{
                  left: `${item.xFrac * 100}%`,
                  top: `${item.yFrac * 100}%`,
                  width: `${item.wFrac * 100}%`,
                  height: `${item.hFrac * 100}%`,
                }}
                title="Click to edit this PDF text"
              />
            ))}

        {/* FREEHAND PEN ACTIVE DRAWING STROKE PREVIEW */}
        {drawingPoints.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-40">
            <polyline
              points={drawingPoints.map((p) => `${p.x * displayW},${p.y * displayH}`).join(" ")}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* PLACED EDITOR OBJECTS OVERLAY LAYER */}
        {pageObjects.map((obj) => {
          const isSelected = obj.id === selectedObjectId;

          return (
            <div
              key={obj.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectObject(obj.id);
              }}
              onMouseDown={(e) => startDragObject(e, "move")}
              className={`absolute cursor-move ${
                isSelected ? "ring-2 ring-emerald-500 ring-offset-1 z-50" : ""
              }`}
              style={{
                left: `${obj.xFrac * 100}%`,
                top: `${obj.yFrac * 100}%`,
                width: `${obj.wFrac * 100}%`,
                height: `${obj.hFrac * 100}%`,
                transform: `rotate(${obj.rotation || 0}deg)`,
                opacity: obj.opacity ?? 1.0,
                zIndex: obj.zIndex,
              }}
            >
              {/* OBJECT CONTENT RENDERING */}
              {obj.type === "whiteout" && <div className="w-full h-full bg-white shadow-sm" />}

              {obj.type === "text" && (
                <div
                  className="w-full h-full font-sans break-words outline-none"
                  style={{
                    fontSize: `${(obj as TextPdfObject).fontSize * zoomScale}px`,
                    color: (obj as TextPdfObject).color,
                    fontWeight: (obj as TextPdfObject).bold ? "bold" : "normal",
                    fontStyle: (obj as TextPdfObject).italic ? "italic" : "normal",
                    textDecoration: (obj as TextPdfObject).underline ? "underline" : "none",
                    textAlign: (obj as TextPdfObject).align,
                  }}
                >
                  {(obj as TextPdfObject).text}
                </div>
              )}

              {(obj.type === "image" || obj.type === "signature") && (
                <img src={(obj as any).dataUrl} alt="Object" className="w-full h-full object-contain pointer-events-none" />
              )}

              {obj.type === "shape" && (
                <div
                  className="w-full h-full"
                  style={{
                    backgroundColor: (obj as any).fillColor,
                    borderColor: (obj as any).strokeColor,
                    borderWidth: `${(obj as any).strokeWidth}px`,
                    borderStyle: "solid",
                    borderRadius: (obj as any).shapeType === "circle" ? "50%" : "2px",
                  }}
                />
              )}

              {obj.type === "drawing" && (
                <svg className="w-full h-full overflow-visible pointer-events-none">
                  <polyline
                    points={(obj as DrawingPdfObject).points
                      .map((p) => `${p.x * obj.wFrac * displayW},${p.y * obj.hFrac * displayH}`)
                      .join(" ")}
                    fill="none"
                    stroke={(obj as DrawingPdfObject).strokeColor}
                    strokeWidth={(obj as DrawingPdfObject).strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              {obj.type === "highlight" && (
                <div className="w-full h-full bg-yellow-300/60 mix-blend-multiply" />
              )}

              {obj.type === "underline" && (
                <div className="w-full h-0.5 bg-black self-end" />
              )}

              {obj.type === "strikethrough" && (
                <div className="w-full h-0.5 bg-red-500 my-auto" />
              )}

              {/* SELECTION BOUNDING BOX & HANDLES */}
              {isSelected && (
                <>
                  {/* Rotation handle top center */}
                  <div
                    onMouseDown={(e) => startDragObject(e, "rotate")}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 w-5 h-5 bg-emerald-500 border border-white rounded-full flex items-center justify-center cursor-grab text-slate-950 shadow-md"
                    title="Rotate object"
                  >
                    <RotateCw className="w-3 h-3" />
                  </div>

                  {/* Corner resize handle bottom right */}
                  <div
                    onMouseDown={(e) => startDragObject(e, "resize", "se")}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-500 border border-white rounded-full cursor-se-resize shadow-md"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
