"use client";

import { useRef, useEffect, useState } from "react";
import {
  Eye, RefreshCw, ExternalLink, ShieldCheck, Monitor, Smartphone, Tablet, Lock
} from "lucide-react";

interface SandboxedPreviewProps {
  htmlContent: string;
  title?: string;
  slug?: string;
  height?: string;
}

export function SandboxedPreview({
  htmlContent,
  title = "Blog Preview",
  slug = "my-blog-post",
  height = "750px"
}: SandboxedPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [targetSite, setTargetSite] = useState<"share2.me" | "share2me.in">("share2.me");

  const renderIframeContent = () => {
    if (!iframeRef.current) return;
    const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!iframeDoc) return;

    const fullHtml = htmlContent.trim().startsWith("<!DOCTYPE") || htmlContent.trim().startsWith("<html")
      ? htmlContent
      : `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            /* Custom Light Scrollbar */
            ::-webkit-scrollbar {
              width: 10px;
              height: 10px;
            }
            ::-webkit-scrollbar-track {
              background: #f1f5f9;
            }
            ::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 6px;
              border: 2px solid #f1f5f9;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }

            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #0f1015;
              font-family: BinanceNova, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              scroll-behavior: smooth;
            }

            body {
              padding: 40px 24px;
              max-width: 960px;
              margin: 0 auto;
            }

            h1, h2, h3, h4, h5, h6 {
              color: #0f1015;
              font-weight: 800;
              line-height: 1.2;
              letter-spacing: -0.02em;
            }
            h1 { font-size: 2.5rem; margin-bottom: 1.5rem; color: #0f1015; }
            h2 { font-size: 1.85rem; margin-top: 2.25rem; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; color: #0f1015; }
            h3 { font-size: 1.45rem; margin-top: 1.75rem; margin-bottom: 0.85rem; color: #7c3aed; }

            p { margin-bottom: 1.35rem; color: #334155; font-size: 1.08rem; line-height: 1.75; }
            a { color: #7c3aed; text-decoration: none; font-weight: 600; border-bottom: 1px dashed rgba(124, 58, 237, 0.5); }
            a:hover { border-bottom-style: solid; }

            img {
              max-width: 100%;
              height: auto;
              border-radius: 20px;
              margin: 2rem 0;
              border: 1px solid #e2e8f0;
              box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            }
            
            pre {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 20px;
              overflow-x: auto;
              font-family: 'JetBrains Mono', 'Fira Code', monospace;
              font-size: 0.92rem;
              color: #0f1015;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
            }
            code {
              background: #f1f5f9;
              padding: 4px 10px;
              border-radius: 8px;
              font-family: 'JetBrains Mono', monospace;
              color: #7c3aed;
              font-size: 0.88em;
              border: 1px solid #e2e8f0;
            }

            blockquote {
              border-left: 4px solid #7c3aed;
              margin: 2rem 0;
              padding: 16px 24px;
              background: #f8fafc;
              border-radius: 0 16px 16px 0;
              color: #475569;
              font-style: italic;
            }

            ul, ol { padding-left: 28px; margin-bottom: 1.5rem; color: #334155; }
            li { margin-bottom: 8px; }

            hr { border: 0; height: 1px; background: #e2e8f0; margin: 2.5rem 0; }
          </style>
        </head>
        <body>
          ${htmlContent || `
            <div style="text-align:center; padding: 100px 20px; color:#64748b;">
              <h2 style="color:#0f1015; border:none;">Live Website Preview Window</h2>
              <p style="font-size: 1rem; max-width:500px; margin:10px auto; color:#64748b;">
                Paste or write your HTML code in the top editor section to render live website preview here.
              </p>
            </div>
          `}
        </body>
        </html>
      `;

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();
  };

  useEffect(() => {
    renderIframeContent();
  }, [htmlContent, key, viewportMode]);

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // Viewport width styling
  const getViewportWidth = () => {
    if (viewportMode === "mobile") return "max-w-[400px]";
    if (viewportMode === "tablet") return "max-w-[800px]";
    return "w-full";
  };

  return (
    <div className="w-full flex flex-col border border-white/90 rounded-[32px] overflow-hidden bg-white/80 backdrop-blur-3xl shadow-[0_20px_60px_rgba(31,18,60,0.08)] transition-all">
      
      {/* ── Preview Toolbar ──────────────────────────────────────────────── */}
      <div className="h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between text-xs text-[#64748b]">
        
        {/* Header Title */}
        <div className="flex items-center gap-3 font-mono font-bold text-[#0f1015]">
          <div className="w-8 h-8 rounded-2xl bg-[#0f1015] text-[#0ecb81] flex items-center justify-center shadow-md">
            <Eye className="w-4 h-4" />
          </div>
          <span className="text-sm font-extrabold text-[#0f1015] tracking-tight font-sans">Live Website Viewport</span>
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full font-sans font-bold">
            <ShieldCheck className="w-3 h-3" />
            Sandboxed
          </span>
        </div>

        {/* Viewport Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-full border border-slate-200/80">
          <button
            onClick={() => setViewportMode("desktop")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              viewportMode === "desktop"
                ? "bg-[#0f1015] text-white shadow-md"
                : "text-[#64748b] hover:text-[#0f1015]"
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-[#fcd535]" />
            <span>Desktop</span>
          </button>

          <button
            onClick={() => setViewportMode("tablet")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              viewportMode === "tablet"
                ? "bg-[#0f1015] text-white shadow-md"
                : "text-[#64748b] hover:text-[#0f1015]"
            }`}
          >
            <Tablet className="w-3.5 h-3.5 text-[#fcd535]" />
            <span>Tablet</span>
          </button>

          <button
            onClick={() => setViewportMode("mobile")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              viewportMode === "mobile"
                ? "bg-[#0f1015] text-white shadow-md"
                : "text-[#64748b] hover:text-[#0f1015]"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-[#fcd535]" />
            <span>Mobile</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200/80 hover:bg-slate-100 text-[#0f1015] font-extrabold transition-colors text-xs shadow-xs"
            title="Refresh Preview"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200/80 hover:bg-slate-100 text-[#0f1015] font-extrabold transition-colors text-xs shadow-xs"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </button>
        </div>

      </div>

      {/* ── Mock Browser URL Bar ────────────────────────────────────────── */}
      <div className="h-14 bg-slate-100/90 border-b border-slate-200/80 px-6 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-3 h-3 rounded-full bg-rose-400 shadow-xs" />
          <span className="w-3 h-3 rounded-full bg-amber-400 shadow-xs" />
          <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-xs" />
        </div>

        <div className="flex-1 max-w-3xl mx-auto bg-white border border-slate-200/90 rounded-full px-6 py-2 flex items-center justify-between text-xs text-[#64748b] font-mono shadow-xs gap-6">
          <div className="flex items-center gap-2 truncate min-w-0">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mr-1" />
            <span className="text-emerald-600 font-bold tracking-tight">https://</span>
            <span className="text-[#0f1015] font-extrabold tracking-tight">{targetSite}</span>
            <span className="text-[#64748b] truncate font-medium ml-1">/blog/{slug || "article"}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-sans shrink-0 pl-2 border-l border-slate-200">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#64748b] mr-1 hidden md:inline">Preview On:</span>
            <button
              onClick={() => setTargetSite("share2.me")}
              className={`px-3 py-1 rounded-full font-extrabold transition-all ${
                targetSite === "share2.me" ? "bg-[#0f1015] text-white shadow-xs" : "text-[#64748b] hover:text-[#0f1015] hover:bg-slate-100"
              }`}
            >
              share2.me
            </button>
            <button
              onClick={() => setTargetSite("share2me.in")}
              className={`px-3 py-1 rounded-full font-extrabold transition-all ${
                targetSite === "share2me.in" ? "bg-[#0f1015] text-white shadow-xs" : "text-[#64748b] hover:text-[#0f1015] hover:bg-slate-100"
              }`}
            >
              share2me.in
            </button>
          </div>
        </div>
      </div>

      {/* ── Sandboxed Viewport Frame ───────────────────────────────────────── */}
      <div className="w-full bg-slate-100/70 p-3 flex items-center justify-center relative overflow-hidden" style={{ height }}>
        
        <div className={`w-full h-full transition-all duration-300 mx-auto ${getViewportWidth()} ${
          viewportMode !== "desktop" ? "border-4 border-slate-300/80 rounded-[32px] shadow-2xl overflow-hidden" : ""
        }`}>
          <iframe
            key={key}
            ref={iframeRef}
            title="Sandboxed Blog Preview"
            sandbox="allow-same-origin allow-scripts"
            className="w-full h-full border-0 bg-white"
          />
        </div>

      </div>
    </div>
  );
}
