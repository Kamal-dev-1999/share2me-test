"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
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

      {/* HERO — compact so the tool grid fits above the fold */}
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
                PDF tools
              </h1>
              <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1 max-w-[560px]">
                Merge, split, compress, convert — everything runs in your browser. Files never leave your device.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-outline"><ShieldCheck className="w-3 h-3 mr-1" strokeWidth={2} /> In-browser</span>
              <span className="chip-outline"><Zap className="w-3 h-3 mr-1" strokeWidth={2} /> No sign-up</span>
              <span className="chip-yellow">Free</span>
            </div>
          </div>

          {/* Search */}
          <div className="max-w-2xl">
            <div className="flex items-center bg-surface-muted border border-hairline rounded-xl overflow-hidden focus-within:border-black focus-within:shadow-[0_0_0_3px_rgba(9,9,9,0.06)] focus-within:bg-surface transition-all">
              <div className="pl-4 pr-2 py-3 flex items-center">
                <Search className="w-4 h-4 text-on-surface-variant" strokeWidth={2} />
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
                  className="text-[12px] font-medium text-on-surface-variant hover:text-on-surface px-4 py-3 transition-colors shrink-0"
                >
                  Clear
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
          <div className="card-brutalist p-10 text-center">
            <div className="w-12 h-12 bg-surface-muted rounded-xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-on-surface-variant" strokeWidth={1.75} />
            </div>
            <h3 className="text-[18px] font-semibold text-on-surface mb-1">No tools match</h3>
            <p className="text-[13px] text-on-surface-variant">
              Try a different keyword or clear the filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {visibleTools.map((tool, i) => (
              <ToolCard key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        )}

        {/* Bottom callout — mint featured card */}
        <div className="mt-14 card-mint p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0">
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
      className={`shrink-0 text-[13px] font-medium rounded-full px-4 py-1.5 transition-colors ${
        active
          ? "bg-black text-white"
          : "bg-surface border border-hairline text-on-surface hover:border-hairline-strong"
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
      className={`h-full card-brutalist p-5 flex flex-col gap-4 group transition-colors ${
        isReady ? "hover:border-hairline-strong" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`icon-tile ${isReady ? "" : "opacity-60"}`}>
          <Icon className={`w-5 h-5 ${isReady ? "text-on-surface" : "text-on-surface-variant"}`} strokeWidth={1.75} />
        </span>
        <div className="flex items-center gap-1.5">
          {isReady ? (
            <span className="status-pill text-[11px]">
              <span className="status-dot status-dot-success" />
              Ready
            </span>
          ) : (
            <span className="status-pill text-[11px]">
              <span className="status-dot status-dot-warning" />
              Soon
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-on-surface leading-tight">
          {tool.title}
        </h3>
        <p className="text-on-surface-variant text-[13px] mt-1.5 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-hairline text-[12px]">
        <span className="text-on-surface-variant">
          {categoryLabel(tool.category)}
        </span>
        <span className={`font-medium ${isReady ? "text-on-surface group-hover:translate-x-0.5 transition-transform" : "text-on-surface-variant opacity-60"}`}>
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
