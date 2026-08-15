"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, RefreshCw, Download, ArrowLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { PdfTool, categoryLabel } from "@/lib/pdfTools";

export function ScanToPdfUI({ tool }: { tool: PdfTool }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      setError("Camera access denied or unavailable.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setImages(prev => [...prev, dataUrl]);
      }
    }
  };

  const removePhoto = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const generatePDF = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    try {
      const pdfDoc = await PDFDocument.create();
      
      for (const imgData of images) {
        const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
        const image = await pdfDoc.embedJpg(imgBytes);
        
        // A4 size
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        
        const imgDims = image.scaleToFit(width, height);
        page.drawImage(image, {
          x: width / 2 - imgDims.width / 2,
          y: height / 2 - imgDims.height / 2,
          width: imgDims.width,
          height: imgDims.height,
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = "scanned-document.pdf";
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to generate PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <main className="w-full max-w-[1200px] mx-auto px-5 pt-8 pb-24 flex-1">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-[13px] text-on-surface-variant">
          <button onClick={() => router.back()} className="inline-flex items-center p-1 -ml-1 hover:bg-surface-container rounded transition-colors text-on-surface" aria-label="Go back">
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <Link href="/tools" className="font-medium hover:text-on-surface ml-1">All Tools</Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <Link href={`/tools?category=${tool.category}`} className="hover:text-on-surface">
            {categoryLabel(tool.category)}
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
          <span className="text-on-surface font-medium">{tool.title}</span>
        </nav>

        {/* Tool header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="icon-tile-lg shrink-0">
              <tool.icon className="w-6 h-6" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-[26px] font-semibold text-on-surface leading-tight tracking-tight">{tool.title}</h1>
              <p className="text-[13px] text-on-surface-variant mt-0.5 max-w-[600px]">{tool.description}</p>
            </div>
          </div>
        </div>

        <div className="card-brutalist p-5 sm:p-8">
          <div className="grid lg:grid-cols-[1fr_300px] gap-8">
            <div className="flex flex-col gap-4">
              {error && (
                <div className="p-3 border-2 border-error bg-error-container text-on-error-container text-sm font-semibold rounded-md">
                  {error}
                </div>
              )}
              
              <div className="relative w-full aspect-[4/3] bg-black border-2 border-ink rounded-xl overflow-hidden flex items-center justify-center">
                {stream ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-white/70">
                    <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Camera is off</p>
                  </div>
                )}
                
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex items-center gap-3 justify-center mt-2">
                {!stream ? (
                  <button onClick={startCamera} className="btn-brutalist w-full sm:w-auto">
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button onClick={capturePhoto} className="btn-brutalist bg-signal-yellow text-ink border-ink hover:bg-signal-yellow/80 w-full sm:w-auto">
                      <Camera className="w-4 h-4 mr-2" /> Capture Page
                    </button>
                    <button onClick={stopCamera} className="btn-brutalist bg-surface text-ink hover:bg-surface-container w-full sm:w-auto">
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>

            <aside className="lg:border-l-2 lg:border-ink lg:pl-8 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="label-caps text-on-surface-variant">// Captured Pages</span>
                <span className="text-xs font-bold bg-signal-yellow text-ink px-2 py-0.5 rounded border border-ink">
                  {images.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-[200px] border-2 border-dashed border-ink/30 rounded-xl p-3 bg-surface-container mb-4 flex flex-col gap-3">
                {images.length === 0 ? (
                  <div className="m-auto text-sm text-on-surface-variant text-center px-4">
                    Snap a photo of your document to see it here.
                  </div>
                ) : (
                  images.map((img, i) => (
                    <div key={i} className="relative group rounded-md overflow-hidden border-2 border-ink aspect-[3/4] bg-white">
                      <img src={img} alt={`Page ${i+1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 bg-ink text-surface text-[10px] font-bold px-1.5 rounded">
                        {i + 1}
                      </div>
                      <button 
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-error text-surface p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-ink"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={generatePDF} 
                disabled={images.length === 0 || isGenerating}
                className="btn-brutalist w-full disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isGenerating ? "Generating..." : "Download PDF"}
              </button>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
