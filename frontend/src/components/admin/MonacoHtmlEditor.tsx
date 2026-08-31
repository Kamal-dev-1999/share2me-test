"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Code, Sun, Moon, Trash2, Copy, Check, Sparkles, Clipboard } from "lucide-react";

interface MonacoHtmlEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: string;
}

export function MonacoHtmlEditor({ value, onChange, height = "480px" }: MonacoHtmlEditorProps) {
  const [theme, setTheme] = useState<"vs-dark" | "light">("light");
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    } catch (err) {
      alert("Please press Ctrl+V inside the editor to paste your HTML code.");
    }
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the editor content?")) {
      onChange("");
    }
  };

  const handleFormat = () => {
    const formatted = value
      .replace(/></g, ">\n<")
      .replace(/(<[^\/][^>]*>)/g, "$1")
      .trim();
    onChange(formatted);
  };

  return (
    <div className="w-full flex flex-col border border-white/90 rounded-[32px] overflow-hidden bg-white/80 backdrop-blur-3xl shadow-[0_20px_60px_rgba(31,18,60,0.08)] transition-all">
      
      {/* ── Editor Toolbar ──────────────────────────────────────────────── */}
      <div className="h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between text-xs text-[#64748b]">
        
        <div className="flex items-center gap-3 font-mono font-bold text-[#0f1015]">
          <div className="w-8 h-8 rounded-2xl bg-[#0f1015] text-[#fcd535] flex items-center justify-center shadow-md">
            <Code className="w-4 h-4" />
          </div>
          <span className="text-sm font-extrabold text-[#0f1015] tracking-tight font-sans">HTML Code Editor</span>
          <span className="text-[10px] text-purple-800 bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-full font-mono font-extrabold">
            Monaco Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Paste Button */}
          <button
            onClick={handlePasteFromClipboard}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0f1015] text-white font-extrabold hover:bg-[#1f232c] transition-all shadow-md hover:scale-[1.02]"
            title="Paste HTML code from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-[#fcd535]" />
            <span>{pasted ? "Pasted!" : "Paste Code"}</span>
          </button>

          {/* Format HTML */}
          <button
            onClick={handleFormat}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200/80 hover:bg-slate-100 text-[#0f1015] font-extrabold transition-colors shadow-xs"
            title="Auto Indent / Format HTML"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Format</span>
          </button>

          {/* Copy Code */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200/80 hover:bg-slate-100 text-[#0f1015] font-extrabold transition-colors shadow-xs"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748b]" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Toggle Theme */}
          <button
            onClick={() => setTheme(theme === "vs-dark" ? "light" : "vs-dark")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200/80 hover:bg-slate-100 text-[#0f1015] font-extrabold transition-colors shadow-xs"
            title="Toggle Editor Theme"
          >
            {theme === "vs-dark" ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            <span className="capitalize hidden sm:inline">{theme === "vs-dark" ? "Dark" : "Light"}</span>
          </button>

          {/* Clear Content */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1 p-2 rounded-full bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:text-white text-rose-600 transition-colors shadow-xs"
            title="Clear Editor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Monaco Editor Instance ────────────────────────────────────────── */}
      <div className="flex-1 w-full bg-white">
        <Editor
          height={height}
          language="html"
          theme={theme}
          value={value}
          onChange={(val: string | undefined) => onChange(val || "")}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            minimap: { enabled: false },
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            formatOnPaste: true,
            formatOnType: true,
            padding: { top: 16, bottom: 16 },
          }}
          loading={
            <div className="h-full flex items-center justify-center bg-white text-slate-600 text-sm gap-3 py-20">
              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading Monaco Code Engine...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
