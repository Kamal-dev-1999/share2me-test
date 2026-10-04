"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Home, Network, Inbox, Wrench, Coffee, Fingerprint, Tag, X,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { href: string; icon: LucideIcon; label: string; grad: string; stops: [string, string]; deep: string }[] = [
  { href: "/",             icon: Home,        label: "Home",         grad: "grad-home",   stops: ["#60a5fa", "#2563eb"], deep: "#1e40af" },
  { href: "/p2p",          icon: Network,     label: "Direct Transfer", grad: "grad-p2p",    stops: ["#fcd34d", "#f59e0b"], deep: "#b45309" },
  { href: "/g2p",          icon: Inbox,       label: "Share with Code", grad: "grad-portal", stops: ["#4ade80", "#059669"], deep: "#047857" },
  { href: "/tools",        icon: Wrench,      label: "PDF Tools",    grad: "grad-tools",  stops: ["#e879f9", "#c026d3"], deep: "#86198f" },
  { href: "/blog",         icon: Coffee,      label: "Blog",         grad: "grad-blog",   stops: ["#fb923c", "#ea580c"], deep: "#9a3412" },
  { href: "/about",        icon: Fingerprint, label: "About",        grad: "grad-about",  stops: ["#f472b6", "#db2777"], deep: "#9d174d" },
  { href: "/pricing",      icon: Tag,         label: "Pricing",      grad: "grad-price",  stops: ["#a78bfa", "#7c3aed"], deep: "#5b21b6" },
];

const MAIN_ITEMS = ITEMS.slice(0, 4);
const FOLDER_ITEMS = ITEMS.slice(4);

function RailLink({ item, active, layoutId, horizontal }: { item: typeof ITEMS[0], active: boolean, layoutId: string, horizontal: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      className={`relative flex items-center justify-center group shrink-0 ${
        horizontal ? "w-10 h-10" : "w-12 h-12 mb-2 last:mb-0"
      }`}
    >
      {/* Active state backplate — frosted light pill */}
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-[14px] bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)]"
          aria-hidden="true"
        />
      )}

      {/* Inactive hover backplate */}
      {!active && (
        <span className="absolute inset-0 rounded-[14px] bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      )}

      {/* Icon */}
      <Icon
        className={`relative z-10 w-5 h-5 transition-all duration-300 ease-out group-hover:scale-125 group-hover:-translate-y-0.5 group-hover:opacity-100 ${
          active ? "opacity-100" : "opacity-60"
        }`}
        style={{
          stroke: `url(#${item.grad})`,
          filter: active
            ? `drop-shadow(0 1.5px 0 ${item.deep}) drop-shadow(0 5px 6px rgba(0,0,0,0.30))`
            : `drop-shadow(0 1px 0 ${item.deep}) drop-shadow(0 2.5px 3px rgba(0,0,0,0.18))`,
        }}
        strokeWidth={active ? 2.5 : 2.25}
      />

      {/* Flyout name label */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[70] whitespace-nowrap rounded-full bg-[#111827] text-white text-[12px] font-semibold px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] opacity-0 scale-90 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 ${
          horizontal
            ? "bottom-full mb-2.5 left-1/2 -translate-x-1/2 origin-bottom translate-y-1 group-hover:translate-y-0"
            : "left-full ml-3.5 top-1/2 -translate-y-1/2 origin-left -translate-x-1 group-hover:translate-x-0"
        }`}
      >
        {item.label}
        {/* Little arrow pointing at the icon */}
        <span
          aria-hidden="true"
          className={`absolute w-2 h-2 bg-[#111827] rotate-45 ${
            horizontal
              ? "top-full left-1/2 -translate-x-1/2 -mt-1"
              : "right-full top-1/2 -translate-y-1/2 -mr-1"
          }`}
        />
      </span>
    </Link>
  );
}

function RailItems({ layoutId, folderId, horizontal = false, onOpenFolder }: { layoutId: string; folderId: string; horizontal?: boolean; onOpenFolder: () => void; }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {MAIN_ITEMS.map((item) => (
        <RailLink key={item.href} item={item} active={isActive(item.href)} layoutId={layoutId} horizontal={horizontal} />
      ))}

      {/* Folder Icon Button */}
      <motion.button
        layoutId={folderId}
        onClick={onOpenFolder}
        className={`relative flex items-center justify-center shrink-0 group ${
          horizontal ? "w-10 h-10 ml-0.5" : "w-12 h-12 mt-1"
        }`}
        aria-label="More apps"
      >
        {/* Background pill to match the dock style */}
        <span className="absolute inset-0 rounded-[14px] bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        {/* The miniature app grid */}
        <div className="relative z-10 grid grid-cols-2 gap-[3px] p-[8px] w-full h-full pointer-events-none">
          {FOLDER_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div 
                key={item.href} 
                layoutId={`${folderId}-icon-${item.href}`}
                className="flex items-center justify-center bg-black/10 rounded-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
              >
                <Icon className="w-2.5 h-2.5 text-gray-800" strokeWidth={3} />
              </motion.div>
            )
          })}
          {/* Empty 4th slot to make the 2x2 grid perfect since we have 3 items */}
          <div className="bg-black/5 rounded-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
        </div>

        {/* Flyout label for the folder itself */}
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-[70] whitespace-nowrap rounded-full bg-[#111827] text-white text-[12px] font-semibold px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] opacity-0 scale-90 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 ${
            horizontal
              ? "bottom-full mb-2.5 left-1/2 -translate-x-1/2 origin-bottom translate-y-1 group-hover:translate-y-0"
              : "left-full ml-3.5 top-1/2 -translate-y-1/2 origin-left -translate-x-1 group-hover:translate-x-0"
          }`}
        >
          More Apps
          <span
            aria-hidden="true"
            className={`absolute w-2 h-2 bg-[#111827] rotate-45 ${
              horizontal
                ? "top-full left-1/2 -translate-x-1/2 -mt-1"
                : "right-full top-1/2 -translate-y-1/2 -mr-1"
            }`}
          />
        </span>
      </motion.button>
    </>
  );
}

function FolderOverlay({ folderId, onClose }: { folderId: string; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <motion.div
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10"
      onClick={onClose}
    >
      <motion.div
        layoutId={folderId}
        className="relative flex flex-col gap-6 p-6 bg-white/70 backdrop-blur-3xl border border-white/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-[36px] w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-1 pt-1">
          <h3 className="font-semibold text-gray-800 text-lg tracking-tight">More Apps</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-y-6 gap-x-4">
          {FOLDER_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer bg-transparent border-none p-0 m-0"
              >
                <motion.div
                  layoutId={`${folderId}-icon-${item.href}`}
                  className={`flex items-center justify-center w-[60px] h-[60px] rounded-[18px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06),_inset_0_1px_1px_rgba(255,255,255,1)] border border-gray-100 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] ${active ? "ring-2 ring-blue-500/50 ring-offset-1" : ""}`}
                >
                  <item.icon
                    className={`w-7 h-7 transition-opacity ${active ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
                    style={{ stroke: `url(#${item.grad})`, filter: `drop-shadow(0 1.5px 0 ${item.deep}) drop-shadow(0 4px 5px rgba(0,0,0,0.15))` }}
                    strokeWidth={2.5}
                  />
                </motion.div>
                <span className="text-[11px] font-medium text-gray-700 tracking-tight whitespace-nowrap">{item.label}</span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SideRail({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const [openFolder, setOpenFolder] = useState<"desktop" | "mobile" | "embedded" | null>(null);

  const defs = (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
      <defs>
        {ITEMS.map((item) => (
          <linearGradient key={item.grad} id={item.grad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor={item.stops[0]} offset="0%" />
            <stop stopColor={item.stops[1]} offset="100%" />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );

  return (
    <MotionConfig transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}>
      {defs}

      {/* Embedded variant (Home hero panel) */}
      {embedded && (
        <nav
          aria-label="Primary"
          className="hidden lg:flex shrink-0 w-[64px] rounded-l-[32px] flex-col items-center justify-center py-4 bg-white/50 backdrop-blur-3xl border-r border-white/60 shadow-[inset_-1px_0_4px_rgba(255,255,255,0.5)] self-stretch"
        >
          <RailItems layoutId="rail-active-desktop" folderId="folder-embedded" onOpenFolder={() => setOpenFolder("embedded")} />
        </nav>
      )}

      {/* Desktop floating vertical dock */}
      {!embedded && pathname !== "/" && (
        <nav
          aria-label="Primary"
          className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 w-[64px] z-[60] flex-col items-center py-4 rounded-[28px] bg-white/45 backdrop-blur-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.10),_inset_0_1px_1px_rgba(255,255,255,0.9)]"
        >
          <RailItems layoutId="rail-active-desktop" folderId="folder-desktop" onOpenFolder={() => setOpenFolder("desktop")} />
        </nav>
      )}

      {/* Mobile floating horizontal dock */}
      {!embedded && (
        <nav
          aria-label="Primary mobile"
          className="flex lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] h-[56px] px-1.5 flex-row items-center justify-around gap-0.5 rounded-[28px] bg-white/50 backdrop-blur-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,0.9)] max-w-[95vw] overflow-x-auto scrollbar-hide"
        >
          <RailItems layoutId="rail-active-mobile" folderId="folder-mobile" horizontal onOpenFolder={() => setOpenFolder("mobile")} />
        </nav>
      )}

      {/* Expanded Folder Overlay */}
      <AnimatePresence>
        {openFolder && (
          <FolderOverlay folderId={`folder-${openFolder}`} onClose={() => setOpenFolder(null)} />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
