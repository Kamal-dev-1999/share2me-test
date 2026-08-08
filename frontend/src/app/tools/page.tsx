"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import {
  PDF_TOOLS,
  TOOL_CATEGORIES,
  type ToolCategory,
  type PdfTool,
  categoryLabel,
} from "@/lib/pdfTools";

type CategoryFilter = "all" | ToolCategory;

const READY_COUNT = PDF_TOOLS.filter((t) => t.phase === "ready").length;

export default function ToolsLanding() {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const visibleTools = useMemo(() => {
    return PDF_TOOLS.filter((t) => {
      if (filter !== "all" && t.category !== filter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [filter, query]);

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <TopNav />

      {/* HERO */}
      <section className="w-full border-b-2 border-ink">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 py-12 md:py-20">
          <div className="flex flex-col gap-6 max-w-4xl">
            <div className="inline-flex items-center gap-2 self-start bg-surface border-2 border-ink rounded-md px-3 py-1.5 shadow-hard-sm">
              <span className="flex h-2.5 w-2.5 rounded-full bg-signal-yellow border border-ink" />
              <span className="label-caps text-ink">{READY_COUNT} tools ready · {PDF_TOOLS.length - READY_COUNT} more incoming</span>
            </div>

            <h1 className="font-display font-bold uppercase leading-[0.95] tracking-tight text-ink text-[48px] sm:text-[64px] md:text-[80px]">
              Every PDF tool <br />
              <span className="inline-block bg-signal-yellow text-ink px-2 -mx-1 border-2 border-ink rounded-md">
                in one place.
              </span>
            </h1>

            <p className="text-on-surface-variant text-lg sm:text-xl max-w-2xl leading-relaxed">
              Merge, split, compress, convert, rotate, protect — all your PDFs, done in the browser.
              Files never leave your device.
            </p>

            {/* Trust chips */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="chip-outline flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" strokeWidth={2.5} /> In-browser
              </span>
              <span className="chip-outline flex items-center gap-1.5">
                <Zap className="w-3 h-3" strokeWidth={2.5} /> No sign-up
              </span>
              <span className="chip-yellow">100% Free</span>
            </div>
          </div>

          {/* Search */}
          <div className="mt-8 max-w-2xl">
            <div className="flex items-center bg-surface border-2 border-ink rounded-lg overflow-hidden shadow-hard focus-within:shadow-[6px_6px_0_0_rgba(30,27,21,1)] transition-shadow">
              <div className="pl-4 pr-2 py-3.5 flex items-center">
                <Search className="w-5 h-5 text-ink" strokeWidth={2.5} />
              </div>
              <input
                suppressHydrationWarning
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools — merge, compress, watermark…"
                className="flex-1 bg-transparent border-none py-3.5 pr-4 text-base text-ink placeholder:text-outline focus:outline-none focus:ring-0 w-full min-w-0"
              />
              {query && (
                <button
                  suppressHydrationWarning
                  onClick={() => setQuery("")}
                  className="bg-ink text-signal-yellow hover:bg-on-surface font-display font-bold uppercase text-sm px-4 py-3.5 tracking-tight transition-colors shrink-0 border-l-2 border-ink"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <section className="w-full bg-surface-container-low border-b-2 border-ink sticky top-[68px] z-40">
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
          <div className="card-brutalist p-10 text-center">
            <div className="w-16 h-16 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center mx-auto mb-6 shadow-hard-sm">
              <Search className="w-8 h-8 text-ink" strokeWidth={2.5} />
            </div>
            <h3 className="font-display font-bold uppercase text-2xl text-ink mb-2">No tools match</h3>
            <p className="text-on-surface-variant">
              Try a different keyword or clear the filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
            {visibleTools.map((tool, i) => (
              <ToolCard key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        )}

        {/* Bottom callout */}
        <div className="mt-16 card-brutalist bg-signal-yellow p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-ink border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm shrink-0">
              <Sparkles className="w-7 h-7 text-signal-yellow" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-display font-bold uppercase text-2xl md:text-3xl text-ink">
                Need direct transfer instead?
              </h3>
              <p className="text-ink/80 mt-1 leading-relaxed">
                Skip the tools — use P2P or a permanent portal to send files device-to-device.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/p2p" className="btn-brutalist bg-ink text-signal-yellow">
              Try P2P
            </Link>
            <Link href="/g2p" className="btn-brutalist-ghost">
              Open Portal
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full bg-ink text-surface py-10">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-display font-bold uppercase tracking-tight text-xl">Share2Me</span>
          <div className="label-caps text-surface/70">© 2026 Share2Me — All Rights Reserved</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">Privacy</Link>
            <Link href="/terms" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">Terms</Link>
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
      className={`shrink-0 label-caps border-2 border-ink rounded-md px-4 py-2 transition-all ${
        active
          ? "bg-signal-yellow text-ink shadow-hard-sm"
          : "bg-surface text-ink hover:bg-signal-yellow"
      }`}
    >
      {children}
    </button>
  );
}

function ToolCard({ tool, index }: { tool: PdfTool; index: number }) {
  const isReady = tool.phase === "ready";
  const Icon = tool.icon;

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.4), ease: "easeOut" }}
      className={`h-full card-brutalist p-6 flex flex-col gap-4 group transition-all ${
        isReady ? "hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[6px_6px_0_0_rgba(30,27,21,1)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-12 h-12 border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm ${isReady ? "bg-signal-yellow" : "bg-surface-container"}`}>
          <Icon className={`w-6 h-6 ${isReady ? "text-ink" : "text-on-surface-variant"}`} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {!isReady && (
            <span className="chip-outline text-[10px]">SOON</span>
          )}
          {tool.tag && (
            <span className={`chip-outline text-[10px] ${!isReady ? "opacity-60" : ""}`}>{tool.tag}</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold uppercase text-xl text-ink leading-tight">
          {tool.title}
        </h3>
        <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
          {tool.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t-2 border-ink">
        <span className="label-caps text-on-surface-variant">
          {categoryLabel(tool.category)}
        </span>
        <span className={`label-caps ${isReady ? "text-ink group-hover:translate-x-1 transition-transform" : "text-on-surface-variant opacity-60"}`}>
          {isReady ? "Open →" : "Coming soon"}
        </span>
      </div>
    </motion.div>
  );

  if (!isReady) {
    return <div className="cursor-not-allowed">{inner}</div>;
  }
  return (
    <Link href={`/tools/${tool.slug}`} className="block h-full">
      {inner}
    </Link>
  );
}
