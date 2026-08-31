"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Sparkles, Zap, ArrowRight, X } from "lucide-react";
import {
  PDF_TOOLS,
  TOOL_CATEGORIES,
  type ToolCategory,
  type PdfTool,
  categoryLabel,
} from "@/lib/pdfTools";

type CategoryFilter = "all" | ToolCategory;

const READY_COUNT = PDF_TOOLS.filter((t) => t.phase === "ready").length;

// Vibrant 3D Icon styling per tool
const TOOL_3D_STYLES: Record<string, { bg: string; shadow: string; text: string }> = {
  // AI Tools
  "bg-remover": {
    bg: "bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(20,184,166,0.45)]",
    text: "text-white",
  },
  "ai-summarizer": {
    bg: "bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(168,85,247,0.45)]",
    text: "text-white",
  },
  "translate-pdf": {
    bg: "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(6,182,212,0.45)]",
    text: "text-white",
  },
  "ocr-pdf": {
    bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-red-500",
    shadow: "shadow-[0_8px_20px_-4px_rgba(249,115,22,0.45)]",
    text: "text-white",
  },
  "scan-to-pdf": {
    bg: "bg-gradient-to-br from-rose-400 via-pink-500 to-purple-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)]",
    text: "text-white",
  },

  // Organize
  "merge-pdf": {
    bg: "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500",
    shadow: "shadow-[0_8px_20px_-4px_rgba(99,102,241,0.45)]",
    text: "text-white",
  },
  "split-pdf": {
    bg: "bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(59,130,246,0.45)]",
    text: "text-white",
  },
  "rotate-pdf": {
    bg: "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(14,165,233,0.45)]",
    text: "text-white",
  },
  "organize-pdf": {
    bg: "bg-gradient-to-br from-teal-400 via-emerald-500 to-green-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(20,184,166,0.45)]",
    text: "text-white",
  },
  "crop-pdf": {
    bg: "bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(249,115,22,0.45)]",
    text: "text-white",
  },
  "page-numbers": {
    bg: "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(16,185,129,0.45)]",
    text: "text-white",
  },

  // Convert to PDF
  "jpg-to-pdf": {
    bg: "bg-gradient-to-br from-pink-500 via-rose-500 to-red-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(236,72,153,0.45)]",
    text: "text-white",
  },
  "word-to-pdf": {
    bg: "bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800",
    shadow: "shadow-[0_8px_20px_-4px_rgba(37,99,235,0.45)]",
    text: "text-white",
  },
  "excel-to-pdf": {
    bg: "bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700",
    shadow: "shadow-[0_8px_20px_-4px_rgba(22,163,74,0.45)]",
    text: "text-white",
  },
  "powerpoint-to-pdf": {
    bg: "bg-gradient-to-br from-orange-500 via-red-500 to-amber-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(234,88,12,0.45)]",
    text: "text-white",
  },
  "html-to-pdf": {
    bg: "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700",
    shadow: "shadow-[0_8px_20px_-4px_rgba(124,58,237,0.45)]",
    text: "text-white",
  },

  // Convert from PDF
  "pdf-to-jpg": {
    bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-red-500",
    shadow: "shadow-[0_8px_20px_-4px_rgba(245,158,11,0.45)]",
    text: "text-white",
  },
  "pdf-to-word": {
    bg: "bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(59,130,246,0.45)]",
    text: "text-white",
  },
  "pdf-to-excel": {
    bg: "bg-gradient-to-br from-teal-500 via-emerald-600 to-green-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(20,184,166,0.45)]",
    text: "text-white",
  },
  "pdf-to-powerpoint": {
    bg: "bg-gradient-to-br from-red-500 via-rose-600 to-pink-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(239,68,68,0.45)]",
    text: "text-white",
  },
  "pdf-to-markdown": {
    bg: "bg-gradient-to-br from-slate-600 via-zinc-700 to-gray-800",
    shadow: "shadow-[0_8px_20px_-4px_rgba(71,85,105,0.45)]",
    text: "text-white",
  },
  "pdf-to-pdfa": {
    bg: "bg-gradient-to-br from-cyan-500 via-teal-600 to-blue-700",
    shadow: "shadow-[0_8px_20px_-4px_rgba(6,182,212,0.45)]",
    text: "text-white",
  },

  // Edit & Security
  "sign-pdf": {
    bg: "bg-gradient-to-br from-rose-500 via-pink-600 to-purple-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)]",
    text: "text-white",
  },
  "protect-pdf": {
    bg: "bg-gradient-to-br from-red-600 via-rose-700 to-pink-700",
    shadow: "shadow-[0_8px_20px_-4px_rgba(220,38,38,0.45)]",
    text: "text-white",
  },
  "unlock-pdf": {
    bg: "bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600",
    shadow: "shadow-[0_8px_20px_-4px_rgba(16,185,129,0.45)]",
    text: "text-white",
  },
  "compress-pdf": {
    bg: "bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700",
    shadow: "shadow-[0_8px_20px_-4px_rgba(147,51,234,0.45)]",
    text: "text-white",
  },
};

const DEFAULT_3D_STYLE = {
  bg: "bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600",
  shadow: "shadow-[0_8px_20px_-4px_rgba(99,102,241,0.45)]",
  text: "text-white",
};

export default function ToolsLanding() {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const visibleTools = useMemo(() => {
    const q = query.trim().toLowerCase();

    return PDF_TOOLS.filter((t) => {
      // If user typed a search query, search globally across all categories
      if (!q && filter !== "all" && t.category !== filter) return false;

      if (q) {
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = t.description.toLowerCase().includes(q);
        const slugMatch = t.slug.toLowerCase().replace(/-/g, " ").includes(q);
        const tagMatch = t.tag ? t.tag.toLowerCase().includes(q) : false;
        const catMatch = categoryLabel(t.category).toLowerCase().includes(q);

        // Extended keyword aliases
        const aliases: Record<string, string[]> = {
          "bg-remover": ["background", "remove", "remover", "bg", "photo", "image", "transparent", "png", "ai", "cutout"],
          "sign-pdf": ["signature", "sign", "draw", "autograph", "stamp"],
          "jpg-to-pdf": ["image", "photo", "picture", "jpeg", "png", "convert"],
          "pdf-to-jpg": ["extract", "image", "photo", "picture", "jpeg", "png"],
          "word-to-pdf": ["doc", "docx", "microsoft word", "office"],
          "pdf-to-word": ["doc", "docx", "microsoft word", "office", "convert"],
          "excel-to-pdf": ["xls", "xlsx", "spreadsheet", "sheet"],
          "pdf-to-excel": ["xls", "xlsx", "spreadsheet", "sheet", "table"],
          "powerpoint-to-pdf": ["ppt", "pptx", "slides", "presentation"],
          "pdf-to-powerpoint": ["ppt", "pptx", "slides", "presentation"],
          "compress-pdf": ["reduce", "shrink", "size", "optimize", "smaller"],
          "merge-pdf": ["combine", "join", "concat", "together"],
          "split-pdf": ["extract", "separate", "cut", "divide"],
          "protect-pdf": ["lock", "password", "encrypt", "secure"],
          "unlock-pdf": ["decrypt", "password", "remove password"],
        };

        const toolAliases = aliases[t.slug] || [];
        const aliasMatch = toolAliases.some((alias) => alias.includes(q) || q.includes(alias));

        if (!titleMatch && !descMatch && !slugMatch && !tagMatch && !catMatch && !aliasMatch) {
          return false;
        }

        // If a category tab is selected but search returns matches elsewhere, fallback to global match
        if (filter !== "all" && t.category !== filter) {
          const matchesCurrentCategory = PDF_TOOLS.some(
            (item) => item.category === filter && (
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.slug.toLowerCase().includes(q) ||
              (aliases[item.slug] && aliases[item.slug].some((a) => a.includes(q)))
            )
          );
          if (matchesCurrentCategory) {
            return false;
          }
        }
      }
      return true;
    });
  }, [filter, query]);

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">

      {/* HERO */}
      <section className="w-full border-b border-hairline bg-surface">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 py-8 md:py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="status-pill text-[12px]">
                  <span className="status-dot status-dot-success" />
                  {READY_COUNT} tools ready
                </span>
                <span className="text-[12px] text-on-surface-variant">·</span>
                <span className="text-[12px] text-on-surface-variant">{PDF_TOOLS.length - READY_COUNT} more incoming</span>
              </div>
              <h1 className="text-[26px] md:text-[32px] font-semibold text-on-surface leading-tight tracking-tight">
                PDF & AI Tools
              </h1>
              <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1 max-w-[560px]">
                Merge, split, compress, sign, remove background with AI — fast, secure, browser-native.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-outline"><ShieldCheck className="w-3 h-3 mr-1" strokeWidth={2} /> In-browser</span>
              <span className="chip-outline"><Zap className="w-3 h-3 mr-1" strokeWidth={2} /> No sign-up</span>
              <span className="chip-yellow">Free</span>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="max-w-2xl">
            <div className="flex items-center bg-surface border-2 border-ink rounded-2xl overflow-hidden shadow-sm focus-within:shadow-md focus-within:border-black transition-all">
              <div className="pl-4 pr-2 py-3 flex items-center">
                <Search className="w-5 h-5 text-on-surface-variant" strokeWidth={2.2} />
              </div>
              <input
                suppressHydrationWarning
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools — bg remover, sign pdf, merge, compress, word…"
                className="flex-1 bg-transparent border-none py-3.5 pr-4 text-base font-medium text-ink placeholder:text-outline focus:outline-none focus:ring-0 w-full min-w-0"
              />
              {query && (
                <button
                  suppressHydrationWarning
                  onClick={() => setQuery("")}
                  className="text-xs font-bold text-on-surface-variant hover:text-on-surface px-4 py-3 flex items-center gap-1 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <section className="w-full bg-background border-b border-hairline sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All Tools <span className="ml-2 text-ink/60">{PDF_TOOLS.length}</span>
            </FilterChip>
            {TOOL_CATEGORIES.map((c) => {
              const count = PDF_TOOLS.filter((t) => t.category === c.key).length;
              return (
                <FilterChip
                  key={c.key}
                  active={filter === c.key}
                  onClick={() => setFilter(c.key)}
                >
                  {c.label} <span className="ml-2 text-ink/60">{count}</span>
                </FilterChip>
              );
            })}
          </div>
        </div>
      </section>

      {/* TOOL GRID */}
      <main className="w-full max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 py-12 md:py-16 flex-1">
        {visibleTools.length === 0 ? (
          <div className="card-brutalist p-10 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 bg-surface-muted rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-ink">
              <Search className="w-6 h-6 text-on-surface-variant" strokeWidth={2} />
            </div>
            <h3 className="text-[18px] font-bold text-on-surface mb-1">No matching tools found</h3>
            <p className="text-[13px] text-on-surface-variant mb-4">
              We couldn&apos;t find any tool matching &quot;{query}&quot;. Try another term like &quot;bg remover&quot;, &quot;merge&quot;, or &quot;sign&quot;.
            </p>
            <button
              onClick={() => { setQuery(""); setFilter("all"); }}
              className="px-4 py-2 bg-ink text-white rounded-xl text-xs font-bold shadow hover:opacity-90"
            >
              Clear Search & Show All Tools
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleTools.map((tool, i) => (
              <ToolCard key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        )}

        {/* Bottom callout */}
        <div className="mt-14 card-mint p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl border-2 border-ink flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-6 h-6 text-on-surface" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-[18px] md:text-[20px] font-semibold text-on-surface leading-tight">
                Need direct transfer instead?
              </h3>
              <p className="text-[13px] text-on-surface-variant mt-1">
                Skip the tools — use P2P or a permanent portal to send files device-to-device.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/p2p" className="btn-brutalist">
              Try P2P
            </Link>
            <Link href="/g2p" className="btn-brutalist-ghost">
              Open portal
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-hairline bg-surface py-6">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="font-semibold text-on-surface">Share2Me</span>
          <span>© 2026 Share2Me — All rights reserved</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      suppressHydrationWarning
      onClick={onClick}
      className={`shrink-0 text-[13px] font-bold rounded-full px-4 py-1.5 transition-all ${
        active
          ? "bg-black text-white shadow-sm"
          : "bg-surface border border-hairline text-on-surface hover:border-black hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}

function ToolCard({ tool, index }: { tool: PdfTool; index: number }) {
  const isReady = tool.phase === "ready";
  const Icon = tool.icon;
  const style3D = TOOL_3D_STYLES[tool.slug] || DEFAULT_3D_STYLE;

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.35), ease: "easeOut" }}
      className={`h-full card-brutalist p-5 flex flex-col gap-4 group relative overflow-hidden transition-all duration-300 ${
        isReady ? "hover:border-black hover:shadow-xl hover:-translate-y-1" : "opacity-80"
      }`}
    >
      {/* Glossy background accent on hover */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-black/5 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3">
        {/* 3D Icon Tile Container */}
        <div
          className={`relative w-12 h-12 rounded-2xl ${style3D.bg} ${style3D.shadow} ${style3D.text} border border-white/40 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-3 transition-all duration-300 shadow-md`}
        >
          {/* Inner specular gloss highlight */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/30 via-transparent to-transparent pointer-events-none" />
          <Icon className="w-6 h-6 drop-shadow-sm relative z-10" strokeWidth={2.2} />
        </div>

        <div className="flex items-center gap-1.5">
          {tool.tag && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-container border border-ink/15 text-on-surface-variant">
              {tool.tag}
            </span>
          )}
          {isReady ? (
            <span className="status-pill text-[11px] font-semibold">
              <span className="status-dot status-dot-success" />
              Ready
            </span>
          ) : (
            <span className="status-pill text-[11px] font-semibold">
              <span className="status-dot status-dot-warning" />
              Soon
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[16px] font-bold text-on-surface leading-tight group-hover:text-black transition-colors flex items-center gap-1.5">
          {tool.title}
          {tool.category === "ai" && <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
        </h3>
        <p className="text-on-surface-variant text-[13px] mt-1.5 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-hairline text-[12px] font-bold">
        <span className="text-on-surface-variant font-medium">
          {categoryLabel(tool.category)}
        </span>
        <span className={`inline-flex items-center gap-1 ${isReady ? "text-ink group-hover:translate-x-1 transition-transform" : "text-on-surface-variant opacity-60"}`}>
          {isReady ? (
            <>
              Open <ArrowRight className="w-3.5 h-3.5" />
            </>
          ) : (
            "Coming soon"
          )}
        </span>
      </div>
    </motion.div>
  );

  if (!isReady) {
    return <div className="cursor-not-allowed h-full">{inner}</div>;
  }
  return (
    <Link href={`/tools/${tool.slug}`} className="block h-full">
      {inner}
    </Link>
  );
}
