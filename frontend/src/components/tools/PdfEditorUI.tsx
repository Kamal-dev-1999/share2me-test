"use client";

import { useState, useEffect, useRef } from "react";
import type { PdfTool } from "@/lib/pdfTools";
import { ToolChrome, ToolDropZone } from "./ToolChrome";
import { renderPdfToCanvases, fileToArrayBuffer, downloadBytes, type RenderedPage } from "@/lib/pdfRender";
import { extractTextItemsFromPdf } from "./pdf-editor/utils/textExtractor";
import { exportEditedPdf } from "./pdf-editor/utils/pdfExport";
import type { PdfObject, TextPdfObject, ToolMode, PageState, ExtractedTextItem } from "./pdf-editor/types";
import { PdfEditorToolbar } from "./pdf-editor/PdfEditorToolbar";
import { PdfEditorSidebar } from "./pdf-editor/PdfEditorSidebar";
import { PdfEditorThumbnails } from "./pdf-editor/PdfEditorThumbnails";
import { PdfEditorProperties } from "./pdf-editor/PdfEditorProperties";
import { PdfEditorCanvas } from "./pdf-editor/PdfEditorCanvas";
import { SignatureModal } from "./pdf-editor/SignatureModal";
import { Loader2 } from "lucide-react";

export function PdfEditorUI({ tool }: { tool: PdfTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [extractedTextItems, setExtractedTextItems] = useState<ExtractedTextItem[]>([]);

  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor Zoom & Viewport State
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<"fit-page" | "fit-width" | "manual">("fit-page");
  const [zoomScale, setZoomScale] = useState(0.85);
  const [activeMode, setActiveMode] = useState<ToolMode>("select");
  const [objects, setObjects] = useState<PdfObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [pagesState, setPagesState] = useState<PageState[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const viewportRef = useRef<HTMLDivElement>(null);

  const ZOOM_PRESETS = [0.25, 0.33, 0.40, 0.50, 0.60, 0.67, 0.75, 0.80, 0.90, 1.0, 1.10, 1.25, 1.50, 1.75, 2.0, 2.50, 3.0, 4.0];

  // Dynamic Fit Zoom Calculation
  const calculateFitZoom = (mode: "fit-page" | "fit-width") => {
    if (!viewportRef.current) return;
    const activePageState = pagesState[currentPageIndex];
    const pageRender = renderedPages[activePageState?.pageIndex];
    if (!pageRender) return;

    // Viewport dimensions minus comfortable padding (64px)
    const viewportW = Math.max(200, viewportRef.current.clientWidth - 64);
    const viewportH = Math.max(200, viewportRef.current.clientHeight - 64);

    const pageW = pageRender.canvas?.width || pageRender.widthPts * 1.5;
    const pageH = pageRender.canvas?.height || pageRender.heightPts * 1.5;

    if (!pageW || !pageH) return;

    if (mode === "fit-page") {
      const scaleX = viewportW / pageW;
      const scaleY = viewportH / pageH;
      const fitScale = Math.min(scaleX, scaleY) * 0.94; // Comfort safety margin
      setZoomScale(Math.max(0.20, Math.min(4.0, fitScale)));
    } else if (mode === "fit-width") {
      const fitScale = (viewportW / pageW) * 0.95;
      setZoomScale(Math.max(0.20, Math.min(4.0, fitScale)));
    }
  };

  // Responsive ResizeObserver for Auto-Fit modes
  useEffect(() => {
    if (zoomMode === "manual" || !viewportRef.current) return;

    const observer = new ResizeObserver(() => {
      calculateFitZoom(zoomMode);
    });

    observer.observe(viewportRef.current);
    calculateFitZoom(zoomMode);

    return () => observer.disconnect();
  }, [zoomMode, currentPageIndex, renderedPages, pagesState]);

  // Handle Manual Zoom Change
  const handleManualZoomChange = (newScale: number) => {
    setZoomMode("manual");
    setZoomScale(Math.max(0.20, Math.min(4.0, newScale)));
  };

  const handleFitPageClick = () => {
    setZoomMode("fit-page");
    calculateFitZoom("fit-page");
  };

  const handleFitWidthClick = () => {
    setZoomMode("fit-width");
    calculateFitZoom("fit-width");
  };

  // Keyboard Shortcuts (Ctrl++, Ctrl+-, Ctrl+0) and Wheel Zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        const next = ZOOM_PRESETS.find((s) => s > zoomScale + 0.02) ?? ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
        handleManualZoomChange(next);
      } else if (e.key === "-") {
        e.preventDefault();
        const prev = [...ZOOM_PRESETS].reverse().find((s) => s < zoomScale - 0.02) ?? ZOOM_PRESETS[0];
        handleManualZoomChange(prev);
      } else if (e.key === "0") {
        e.preventDefault();
        handleFitPageClick();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      handleManualZoomChange(zoomScale + delta);
    };

    window.addEventListener("keydown", handleKeyDown);
    const viewportEl = viewportRef.current;
    if (viewportEl) {
      viewportEl.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (viewportEl) {
        viewportEl.removeEventListener("wheel", handleWheel);
      }
    };
  }, [zoomScale]);

  // Modals & Hidden Pickers
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<PdfObject[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  const pushHistory = (newObjects: PdfObject[]) => {
    const nextHistory = history.slice(0, historyStep + 1);
    nextHistory.push(newObjects);
    setHistory(nextHistory);
    setHistoryStep(nextHistory.length - 1);
    setObjects(newObjects);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setObjects(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setObjects(history[nextStep]);
    }
  };

  // Upload PDF Handler
  const handleFileSelect = async (f: File) => {
    setError(null);
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a valid PDF document.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("PDF file size exceeds 50MB limit.");
      return;
    }

    setFile(f);
    setIsLoadingPdf(true);

    try {
      const buffer = await fileToArrayBuffer(f);
      setPdfBuffer(buffer);

      // Render pages to canvases
      const { pages } = await renderPdfToCanvases(buffer, 1.5, undefined, 100);
      setRenderedPages(pages);

      // Initialize page states
      const initialPagesState: PageState[] = pages.map((_, idx) => ({
        pageIndex: idx,
        rotation: 0,
        isDeleted: false,
      }));
      setPagesState(initialPagesState);

      // Extract existing text items from PDF.js for text selection layer and search indexing
      try {
        const textItems = await extractTextItemsFromPdf(buffer, 100);
        setExtractedTextItems(textItems);
      } catch (e) {
        console.warn("[PDF_EDITOR] Text extraction failed:", e);
      }

      setCurrentPageIndex(0);
      setObjects([]);
      setHistory([[]]);
      setHistoryStep(0);
    } catch (err: any) {
      console.error("[PDF_EDITOR] Failed to load PDF:", err);
      setError("Unable to open this PDF file. It may be password protected or corrupted.");
      setFile(null);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Keyboard Shortcuts Listener (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Delete, Escape)
  const clipboardObjRef = useRef<PdfObject | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (ctrlKey && e.key.toLowerCase() === "c" && selectedObjectId) {
        e.preventDefault();
        const obj = objects.find((o) => o.id === selectedObjectId);
        if (obj) clipboardObjRef.current = obj;
      } else if (ctrlKey && e.key.toLowerCase() === "v" && clipboardObjRef.current) {
        e.preventDefault();
        const orig = clipboardObjRef.current;
        const copy: PdfObject = {
          ...orig,
          id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          xFrac: Math.max(0, Math.min(Math.max(0, 1 - orig.wFrac), orig.xFrac + 0.03)),
          yFrac: Math.max(0, Math.min(Math.max(0, 1 - orig.hFrac), orig.yFrac + 0.03)),
          zIndex: objects.length + 1,
        };
        pushHistory([...objects, copy]);
        setSelectedObjectId(copy.id);
      } else if (ctrlKey && e.key.toLowerCase() === "d" && selectedObjectId) {
        e.preventDefault();
        handleDuplicateObject(selectedObjectId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectId) {
        e.preventDefault();
        handleDeleteObject(selectedObjectId);
      } else if (e.key === "Escape") {
        setSelectedObjectId(null);
        setActiveMode("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectId, objects, historyStep, history]);

  // Object Operations
  const handleAddObject = (newObj: PdfObject) => {
    pushHistory([...objects, newObj]);
    setSelectedObjectId(newObj.id);
    if (activeMode !== "draw") setActiveMode("select");
  };

  const handleUpdateObject = (updated: PdfObject) => {
    const next = objects.map((o) => (o.id === updated.id ? updated : o));
    pushHistory(next);
  };

  const handleDeleteObject = (id: string) => {
    const target = objects.find((o) => o.id === id);
    if (!target) return;

    let next: PdfObject[];
    if ((target as TextPdfObject).isExistingText) {
      // Mark existing PDF text as deleted so pdfExport.ts can whiteout/mask it cleanly on export
      next = objects.map((o) => (o.id === id ? { ...(o as TextPdfObject), isDeleted: true } : o));
    } else {
      next = objects.filter((o) => o.id !== id);
    }

    pushHistory(next);
    if (selectedObjectId === id) setSelectedObjectId(null);
  };

  const handleDuplicateObject = (id: string) => {
    const orig = objects.find((o) => o.id === id);
    if (!orig) return;
    const copy: PdfObject = {
      ...orig,
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      xFrac: Math.max(0, Math.min(Math.max(0, 1 - orig.wFrac), orig.xFrac + 0.03)),
      yFrac: Math.max(0, Math.min(Math.max(0, 1 - orig.hFrac), orig.yFrac + 0.03)),
      zIndex: objects.length + 1,
    };
    pushHistory([...objects, copy]);
    setSelectedObjectId(copy.id);
  };

  const handleBringForward = (id: string) => {
    const next = objects.map((o) => (o.id === id ? { ...o, zIndex: o.zIndex + 1 } : o));
    pushHistory(next);
  };

  const handleSendBackward = (id: string) => {
    const next = objects.map((o) => (o.id === id ? { ...o, zIndex: Math.max(1, o.zIndex - 1) } : o));
    pushHistory(next);
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        handleAddObject({
          id: `img-${Date.now()}`,
          type: "image",
          pageIndex: currentPageIndex,
          xFrac: 0.3,
          yFrac: 0.3,
          wFrac: 0.3,
          hFrac: 0.3 / aspect,
          rotation: 0,
          opacity: 1.0,
          zIndex: objects.length + 1,
          dataUrl,
          aspectRatio: aspect,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  };

  // Page Operations
  const handleRotatePage = (index: number) => {
    setPagesState((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleDeletePage = (index: number) => {
    setPagesState((prev) => prev.map((p, idx) => (idx === index ? { ...p, isDeleted: true } : p)));
    const activeVisible = pagesState.filter((p) => !p.isDeleted);
    if (activeVisible.length > 1) {
      setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
    }
  };

  const handleDuplicatePage = (index: number) => {
    const sourceState = pagesState[index];
    const newPage: PageState = {
      pageIndex: sourceState.pageIndex,
      rotation: sourceState.rotation,
      isDeleted: false,
    };
    const next = [...pagesState];
    next.splice(index + 1, 0, newPage);
    setPagesState(next);
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    const next = [...pagesState];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPagesState(next);
  };

  const handleAddBlankPage = (afterIndex: number) => {
    const blankPage: PageState = {
      pageIndex: renderedPages.length, // Dummy index
      rotation: 0,
      isDeleted: false,
      isCustomBlank: true,
    };
    const next = [...pagesState];
    next.splice(afterIndex + 1, 0, blankPage);
    setPagesState(next);
  };

  // Export PDF Execution Handler
  const handleExport = async () => {
    if (!pdfBuffer || isExporting) return;
    setIsExporting(true);
    setError(null);

    try {
      const exportedBytes = await exportEditedPdf(pdfBuffer, objects, pagesState);
      const baseName = file?.name.replace(/\.[^/.]+$/, "") || "document";
      downloadBytes(exportedBytes, `${baseName}-edited.pdf`);
    } catch (err: any) {
      console.error("[PDF_EDITOR] Export failed:", err);
      setError("Failed to export PDF: " + (err.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  // Reset to Upload Screen
  const handleReset = () => {
    setFile(null);
    setPdfBuffer(null);
    setRenderedPages([]);
    setObjects([]);
    setError(null);
  };

  const selectedObj = objects.find((o) => o.id === selectedObjectId) || null;
  const activePages = pagesState.filter((p) => !p.isDeleted);
  const activePageState = pagesState[currentPageIndex];

  return (
    <ToolChrome tool={tool}>
      {!file ? (
        /* UPLOAD SCREEN */
        <div className="max-w-2xl mx-auto space-y-6">
          <ToolDropZone
            onFile={handleFileSelect}
            accept="application/pdf"
            label="Upload your PDF file to edit"
            sublabel="Supports all standard PDF documents up to 50MB"
          />

          {isLoadingPdf && (
            <div className="flex items-center justify-center gap-2 p-4 text-emerald-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading PDF pages and parsing text layer...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* FULL EDITOR WORKSPACE */
        <div className="flex flex-col h-[85vh] -mx-4 -my-6 bg-slate-100/90 backdrop-blur-2xl rounded-3xl border border-white/80 overflow-hidden shadow-2xl shadow-slate-900/10 relative">

          {/* Header Toolbar */}
          <PdfEditorToolbar
            currentPage={currentPageIndex + 1}
            totalPages={activePages.length}
            zoomScale={zoomScale}
            zoomMode={zoomMode}
            canUndo={historyStep > 0}
            canRedo={historyStep < history.length - 1}
            isExporting={isExporting}
            searchQuery={searchQuery}
            onSetSearchQuery={setSearchQuery}
            onPageChange={(p) => setCurrentPageIndex(p - 1)}
            onZoomChange={handleManualZoomChange}
            onFitWidth={handleFitWidthClick}
            onFitPage={handleFitPageClick}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onExport={handleExport}
            onBack={handleReset}
          />

          {/* Main Workspace Grid */}
          <div className="flex flex-1 relative z-10">
            {/* Left Tool Sidebar */}
            <PdfEditorSidebar activeMode={activeMode} onSelectMode={setActiveMode} />

            {/* Left Page Thumbnail Drawer */}
            <PdfEditorThumbnails
              renderedPages={renderedPages}
              pagesState={pagesState}
              currentPageIndex={currentPageIndex}
              onSelectPage={setCurrentPageIndex}
              onRotatePage={handleRotatePage}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              onMovePage={handleMovePage}
              onAddBlankPage={handleAddBlankPage}
            />

            {/* Central Canvas Viewport */}
            <div ref={viewportRef} className="flex-1 bg-slate-200/50 backdrop-blur-sm overflow-auto relative flex items-center justify-center p-6">
              <PdfEditorCanvas
                pageRender={renderedPages[activePageState?.pageIndex]}
                pageIndex={currentPageIndex}
                pageRotation={activePageState?.rotation || 0}
                zoomScale={zoomScale}
                activeMode={activeMode}
                objects={objects}
                selectedObjectId={selectedObjectId}
                extractedTextItems={extractedTextItems}
                onSelectObject={setSelectedObjectId}
                onAddObject={handleAddObject}
                onUpdateObject={handleUpdateObject}
                onDeleteObject={handleDeleteObject}
                onOpenSignatureModal={() => setShowSignatureModal(true)}
                onOpenImagePicker={() => imageInputRef.current?.click()}
              />
            </div>

            {/* Right Property Formatting Panel */}
            <PdfEditorProperties
              selectedObject={selectedObj}
              onUpdateObject={handleUpdateObject}
              onDeleteObject={handleDeleteObject}
              onDuplicateObject={handleDuplicateObject}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
            />
          </div>

          {/* Hidden Image Input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Signature Modal */}
          {showSignatureModal && (
            <SignatureModal
              onClose={() => setShowSignatureModal(false)}
              onDone={(dataUrl, aspect) => {
                setShowSignatureModal(false);
                handleAddObject({
                  id: `sig-${Date.now()}`,
                  type: "signature",
                  pageIndex: currentPageIndex,
                  xFrac: 0.35,
                  yFrac: 0.6,
                  wFrac: 0.3,
                  hFrac: 0.3 / aspect,
                  rotation: 0,
                  opacity: 1.0,
                  zIndex: objects.length + 1,
                  dataUrl,
                  aspectRatio: aspect,
                });
              }}
            />
          )}
        </div>
      )}
    </ToolChrome>
  );
}
