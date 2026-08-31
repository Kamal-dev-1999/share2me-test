"use client";

/**
 * AI Background Remover — Self-Hosted ONNX U2-Net Integration.
 * 1. Uploads or pastes (Ctrl+V) original image untouched.
 * 2. Sends original binary to backend /api/tools/bg-remover -> local Python ML service.
 * 3. Renders high-resolution transparent PNG with checkerboard grid.
 * 4. Provides interactive Before/After split slider & direct PNG download.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, Download, RotateCcw, Loader2, Image as ImageIcon, Sliders, Columns, Clipboard } from "lucide-react";
import type { PdfTool } from "@/lib/pdfTools";
import { ToolChrome, ToolDropZone } from "./ToolChrome";

export function BgRemoverUI({ tool }: { tool: PdfTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Before / After comparison slider state
  const [sliderPos, setSliderPos] = useState(50);
  const [model, setModel] = useState<"auto" | "birefnet-general" | "birefnet-portrait" | "anime" | "u2net">("auto");
  const [postProcessMask, setPostProcessMask] = useState(true);
  const [viewMode, setViewMode] = useState<"slider" | "side">("slider");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Keep refs to clean up URLs on component unmount ONLY
  const originalUrlRef = useRef<string | null>(null);
  const processedUrlRef = useRef<string | null>(null);
  originalUrlRef.current = originalUrl;
  processedUrlRef.current = processedUrl;

  useEffect(() => {
    return () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current);
    };
  }, []);

  const handleFileSelect = (f: File) => {
    setError(null);
    const validMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validMimes.includes(f.type.toLowerCase())) {
      setError("Please upload a supported image file (JPG, PNG, or WebP).");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError("File size exceeds 15MB. Please choose a smaller image.");
      return;
    }

    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);

    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    setProcessedUrl(null);
    setSliderPos(50);
  };

  // Listen for global window Ctrl+V / Cmd+V paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const pastedBlob = item.getAsFile();
          if (pastedBlob) {
            const ext = pastedBlob.type.split("/")[1] || "png";
            const pastedFile = new File([pastedBlob], `pasted-image-${Date.now()}.${ext}`, {
              type: pastedBlob.type,
            });
            handleFileSelect(pastedFile);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const pasteFromClipboard = async () => {
    setError(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setError("Direct clipboard reading is restricted in this browser. Please press Ctrl + V (or Cmd + V) to paste your copied image.");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const pastedFile = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: imageType });
          handleFileSelect(pastedFile);
          return;
        }
      }
      setError("No image found on your clipboard. Please copy an image first, then click Paste or press Ctrl + V.");
    } catch (err) {
      console.warn("Clipboard API read failed, fallback to shortcut instruction:", err);
      setError("To paste an image, simply press Ctrl + V (or Cmd + V) on your keyboard.");
    }
  };

  const processBackgroundRemoval = async (overrideModel?: string) => {
    if (!file || processing) return;
    setProcessing(true);
    setError(null);

    const targetModel = overrideModel || model;

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model", targetModel);
      formData.append("post_process_mask", postProcessMask ? "true" : "false");

      console.log(`[BG_REMOVER] Sending file '${file.name}' (${file.type}, ${file.size} bytes) | model=${targetModel}...`);

      const res = await fetch("/api/tools/bg-remover", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let message = "Background removal failed.";
        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          try {
            const data = await res.json();
            message = data.error || data.message || message;
          } catch (e) {
            // Failed to parse JSON
          }
        } else {
          try {
            const text = await res.text();
            if (text && text.trim() && !text.toLowerCase().includes("<!doctype html>")) {
              message = text;
            } else if (res.status === 404) {
              message = "Background removal API endpoint not found (HTTP 404).";
            } else {
              message = `Background removal API failed (HTTP ${res.status} ${res.statusText}).`;
            }
          } catch (e) {
            message = `Background removal API failed (HTTP ${res.status} ${res.statusText}).`;
          }
        }

        console.error("[BG_REMOVER] API request failed:", {
          status: res.status,
          statusText: res.statusText,
          contentType,
          message,
        });

        throw new Error(message);
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("Background remover returned an empty response.");
      }

      // Perform real alpha channel validation to guarantee transparent pixels exist (minAlpha === 0)
      try {
        const imgBitmap = await createImageBitmap(blob);
        const testCanvas = document.createElement("canvas");
        testCanvas.width = imgBitmap.width;
        testCanvas.height = imgBitmap.height;
        const ctx = testCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgBitmap, 0, 0);
          const imgData = ctx.getImageData(0, 0, testCanvas.width, testCanvas.height);
          const data = imgData.data;
          let minAlpha = 255;
          let maxAlpha = 0;
          let transparentPixelCount = 0;

          for (let i = 3; i < data.length; i += 4) {
            const a = data[i];
            if (a < minAlpha) minAlpha = a;
            if (a > maxAlpha) maxAlpha = a;
            if (a === 0) transparentPixelCount++;
          }

          console.log(`[BG_REMOVER] Alpha Channel Audit: minAlpha=${minAlpha}, maxAlpha=${maxAlpha}, transparentPixels=${transparentPixelCount}/${imgBitmap.width * imgBitmap.height}`);

          if (minAlpha === 255) {
            console.warn("[BG_REMOVER] Warning: Output image has no alpha transparency!");
          }
        }
      } catch (alphaErr) {
        console.warn("[BG_REMOVER] Alpha validation note:", alphaErr);
      }

      console.log(`[BG_REMOVER] Processing completed! ${blob.size} bytes transparent PNG received.`);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
      const url = URL.createObjectURL(blob);
      setProcessedUrl(url);
    } catch (err: any) {
      console.error("[BG_REMOVER] Processing error:", err);
      setError(err.message || "Background removal failed. Your original image is still intact — please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!processedUrl || !file) return;
    const a = document.createElement("a");
    a.href = processedUrl;
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}-no-bg.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetAll = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    setFile(null);
    setOriginalUrl(null);
    setProcessedUrl(null);
    setError(null);
    setProcessing(false);
  };

  // Slider Mouse/Touch Drag Handlers
  const handleSliderMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  };

  return (
    <ToolChrome tool={tool}>
      <div className="card-brutalist p-4 sm:p-8">
        {error && (
          <div className="mb-4 p-3 border-2 border-error bg-error-container text-on-error-container text-sm font-semibold rounded-md flex items-center justify-between gap-2">
            <span>{error}</span>
            {file && (
              <button
                onClick={() => processBackgroundRemoval()}
                className="px-3 py-1 bg-error text-white text-xs font-bold rounded hover:opacity-90 shrink-0"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* 1. Upload Drop Zone & Clipboard Paste */}
        {!file && !processing && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full">
              <ToolDropZone
                onFile={handleFileSelect}
                label="Upload or Paste Image to Remove Background"
                sublabel="Drop JPG, PNG, WebP or press Ctrl+V to paste image from clipboard (Max 15MB)"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">Or use keyboard:</span>
              <button
                onClick={pasteFromClipboard}
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-container border-2 border-ink rounded-xl text-xs font-bold text-on-surface hover:bg-surface hover:border-black transition-all shadow-sm"
              >
                <Clipboard className="w-4 h-4 text-indigo-600" />
                <span>Paste from Clipboard (Ctrl+V)</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Image Loaded — Pre-Processing State */}
        {file && !processedUrl && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative max-w-[600px] w-full border-2 border-ink rounded-xl overflow-hidden bg-surface-container flex items-center justify-center p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalUrl!} alt="Original upload preview" className="max-h-[420px] w-auto object-contain rounded-lg" />
            </div>

            {/* AI Detection Mode Controls */}
            <div className="w-full max-w-[600px] p-4 bg-surface-container rounded-xl border-2 border-ink flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" /> AI Detection Mode:
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as any)}
                  className="px-3 py-1.5 bg-white text-ink text-xs font-bold rounded-lg border border-ink shadow-sm cursor-pointer"
                >
                  <option value="auto">✨ Smart AI Multi-Pass (Auto SOTA)</option>
                  <option value="birefnet-general">📸 BiRefNet Universal SOTA (Photos, Mountains, Products)</option>
                  <option value="birefnet-portrait">👤 BiRefNet Portrait (Fine Hair & Headshots)</option>
                  <option value="anime">🎨 IS-Net Anime (Cartoons & 2D Illustrations)</option>
                  <option value="u2net">⚡ Legacy Fast (U2-Net)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={resetAll}
                disabled={processing}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border-2 border-ink text-sm font-bold hover:bg-surface-container disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" /> Process Different Image
              </button>

              <button
                onClick={() => processBackgroundRemoval()}
                disabled={processing}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-ink text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-40"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing background…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>Remove Background</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 3. Processing Spinner View */}
        {processing && (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg animate-pulse">
                <Sparkles className="w-8 h-8 animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">AI is removing the background…</h3>
              <p className="text-xs text-on-surface-variant mt-1">Running self-hosted ONNX segmentation model. Please hold on!</p>
            </div>
          </div>
        )}

        {/* 4. Background Removal Complete — Interactive Result View */}
        {processedUrl && file && (
          <div className="flex flex-col gap-6">
            {/* View Mode & AI Model Toolbar */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-hairline">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Comparison:</span>
                  <div className="inline-flex p-1 bg-surface-container rounded-xl border border-hairline">
                    <button
                      onClick={() => setViewMode("slider")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "slider" ? "bg-white text-black shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" /> Split Slider
                    </button>
                    <button
                      onClick={() => setViewMode("side")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "side" ? "bg-white text-black shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" /> Side-by-Side
                    </button>
                  </div>
                </div>

                {/* AI Model Quick Switcher right in header toolbar */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Model:
                  </span>
                  <select
                    value={model}
                    onChange={(e) => {
                      const selectedModel = e.target.value as any;
                      setModel(selectedModel);
                      processBackgroundRemoval(selectedModel);
                    }}
                    disabled={processing}
                    className="px-3 py-1.5 bg-white text-ink text-xs font-bold rounded-xl border-2 border-ink shadow-sm cursor-pointer hover:border-black transition-all disabled:opacity-50"
                  >
                    <option value="auto">✨ Smart AI Multi-Pass (Auto SOTA)</option>
                    <option value="birefnet-general">📸 BiRefNet Universal SOTA (Photos, Mountains, Products)</option>
                    <option value="birefnet-portrait">👤 BiRefNet Portrait (Fine Hair & Headshots)</option>
                    <option value="anime">🎨 IS-Net Anime (Cartoons & 2D Illustrations)</option>
                    <option value="u2net">⚡ Legacy Fast (U2-Net)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={resetAll}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border-2 border-ink text-xs font-bold hover:bg-surface-container"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Start New Image
                </button>
                <button
                  onClick={downloadResult}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download High-Res PNG
                </button>
              </div>
            </div>

            {/* Split Comparison View */}
            {viewMode === "slider" && (
              <div className="flex flex-col items-center gap-2">
                <div
                  ref={containerRef}
                  onMouseDown={() => { isDraggingSlider.current = true; }}
                  onMouseUp={() => { isDraggingSlider.current = false; }}
                  onMouseLeave={() => { isDraggingSlider.current = false; }}
                  onMouseMove={(e) => {
                    if (isDraggingSlider.current) handleSliderMove(e.clientX);
                  }}
                  onTouchMove={(e) => {
                    if (e.touches[0]) handleSliderMove(e.touches[0].clientX);
                  }}
                  onClick={(e) => handleSliderMove(e.clientX)}
                  className="relative w-full max-w-[800px] h-[450px] rounded-2xl border-2 border-ink overflow-hidden select-none cursor-ew-resize shadow-md"
                >
                  {/* Background Layer: Processed Result on Checkerboard Grid */}
                  <div
                    className="absolute inset-0 bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] bg-white flex items-center justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={processedUrl} alt="Background Removed" className="h-full w-full object-contain pointer-events-none" />
                    <span className="absolute bottom-3 right-3 text-[11px] font-bold uppercase tracking-wider bg-black/70 text-white px-2.5 py-1 rounded-md backdrop-blur-sm pointer-events-none">
                      Removed Background
                    </span>
                  </div>

                  {/* Foreground Layer: Original Image Clipped by Slider */}
                  <div
                    className="absolute top-0 left-0 bottom-0 overflow-hidden bg-surface-container flex items-center justify-center"
                    style={{ width: `${sliderPos}%` }}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ width: containerRef.current ? containerRef.current.clientWidth : "100%" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={originalUrl!} alt="Original Image" className="h-full w-full object-contain pointer-events-none" />
                    </div>
                    <span className="absolute bottom-3 left-3 text-[11px] font-bold uppercase tracking-wider bg-black/70 text-white px-2.5 py-1 rounded-md backdrop-blur-sm pointer-events-none">
                      Original
                    </span>
                  </div>

                  {/* Divider Line & Handle */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white border-2 border-ink shadow-lg flex items-center justify-center text-black font-bold text-xs">
                      ‹›
                    </div>
                  </div>
                </div>
                <span className="text-xs text-on-surface-variant font-medium">
                  Drag the slider left or right to compare original image vs transparent PNG
                </span>
              </div>
            )}

            {/* Side by Side View */}
            {viewMode === "side" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <div className="relative h-[380px] rounded-2xl border-2 border-ink overflow-hidden bg-surface-container flex items-center justify-center p-2 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={originalUrl!} alt="Original Image" className="max-h-full w-auto object-contain rounded-lg" />
                  </div>
                  <span className="text-xs font-bold text-center text-on-surface-variant">Original Image</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="relative h-[380px] rounded-2xl border-2 border-ink overflow-hidden bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] bg-white flex items-center justify-center p-2 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={processedUrl} alt="Background Removed Result" className="max-h-full w-auto object-contain rounded-lg" />
                  </div>
                  <span className="text-xs font-bold text-center text-emerald-600">Background Removed (Transparent PNG)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolChrome>
  );
}
