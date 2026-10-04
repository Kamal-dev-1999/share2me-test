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
  { href: "/", icon: Home, label: "Home", grad: "grad-home", stops: ["#60a5fa", "#2563eb"], deep: "#1e40af" },
  { href: "/p2p", icon: Network, label: "Direct Transfer", grad: "grad-p2p", stops: ["#fcd34d", "#f59e0b"], deep: "#b45309" },
  { href: "/g2p", icon: Inbox, label: "Share with Code", grad: "grad-portal", stops: ["#4ade80", "#059669"], deep: "#047857" },
  { href: "/tools", icon: Wrench, label: "PDF Tools", grad: "grad-tools", stops: ["#e879f9", "#c026d3"], deep: "#86198f" },
  { href: "/blog", icon: Coffee, label: "Blog", grad: "grad-blog", stops: ["#fb923c", "#ea580c"], deep: "#9a3412" },
  { href: "/about", icon: Fingerprint, label: "About", grad: "grad-about", stops: ["#f472b6", "#db2777"], deep: "#9d174d" },
  { href: "/pricing", icon: Tag, label: "Pricing", grad: "grad-price", stops: ["#a78bfa", "#7c3aed"], deep: "#5b21b6" },
];

const MAIN_ITEMS = ITEMS.slice(0, 4);
const FOLDER_ITEMS = ITEMS.slice(4);

/* ───────── Notch geometry (bubble + tangent fillets as ONE path) ───────── */
const R = 28;   // bubble radius
const r = 10;   // fillet radius
const D = 4;    // bubble centre sits D px below the dock's top edge
const DIST = R + r;
const DX = Math.sqrt(DIST * DIST - (D + r) ** 2);
const NOTCH_W = +(DX * 2).toFixed(2);
const TX = +(DX - (DX * R) / DIST).toFixed(2);          // tangent point (x)
const TY = +(D - ((r + D) * R) / DIST).toFixed(2);      // tangent point (y)
const NOTCH_PATH =
  `M0 2 L0 0 A${r} ${r} 0 0 0 ${TX} ${TY} ` +
  `A${R} ${R} 0 0 1 ${(NOTCH_W - TX).toFixed(2)} ${TY} ` +
  `A${r} ${r} 0 0 0 ${NOTCH_W} 0 L${NOTCH_W} 2 Z`;
const NOTCH_TOP = D - R; // -24 → top of the bubble relative to dock edge

function RailLink({ item, active, layoutId, horizontal }: { item: typeof ITEMS[0]; active: boolean; layoutId: string; horizontal: boolean }) {
  const Icon = item.icon;

  if (horizontal) {
    const shortLabel =
      item.label === "Direct Transfer" ? "P2P" :
      item.label === "Share with Code" ? "Share" :
      item.label === "PDF Tools" ? "Tools" : item.label;

    return (
      <Link
        href={item.href}
        scroll={false}
        aria-label={item.label}
        className="relative flex flex-col items-center justify-end flex-1 min-w-0 max-w-[72px] h-[72px] pb-2 group outline-none [-webkit-tap-highlight-color:transparent]"
      >
        {/* Notch: clipped at the dock's top edge so the shadow never bleeds into the dock */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: "inset(-60px -600px calc(100% - 2px) -600px)" }}
        >
          {active && (
            <motion.div
              layoutId={`${layoutId}-bubble`}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="absolute"
              style={{
                left: "50%",
                marginLeft: -NOTCH_W / 2,
                top: NOTCH_TOP,
                width: NOTCH_W,
                height: -NOTCH_TOP + 2,
                filter: "drop-shadow(0 -2px 3px rgba(0,0,0,0.08))",
              }}
            >
              <svg
                width={NOTCH_W}
                height={-NOTCH_TOP + 2}
                viewBox={`0 ${NOTCH_TOP} ${NOTCH_W} ${-NOTCH_TOP + 2}`}
                className="block overflow-visible"
                aria-hidden="true"
              >
                <path d={NOTCH_PATH} fill="#fff" />
              </svg>
            </motion.div>
          )}
        </div>

        {/* Icon (centre of bubble = D px below dock edge) */}
        <div className="relative w-full h-[32px] mb-[2px] flex items-center justify-center z-30 pointer-events-none">
          <motion.div
            initial={false}
            animate={{ y: active ? -26 : 0, scale: active ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute"
          >
            <Icon
              className={`w-6 h-6 transition-opacity duration-300 ${active ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
              style={{
                stroke: `url(#${item.grad})`,
                filter: `drop-shadow(0 1.5px 0 ${item.deep}) drop-shadow(0 3px 5px rgba(0,0,0,0.25))`,
              }}
              strokeWidth={active ? 2.5 : 2.2}
            />
          </motion.div>
        </div>

        <span className={`text-[11px] leading-[16px] font-bold z-10 transition-colors duration-300 ${active ? "text-gray-800" : "text-[#9CA3AF]"}`}>
          {shortLabel}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      scroll={false}
      aria-label={item.label}
      className="relative flex items-center justify-center group shrink-0 w-12 h-12 mb-2 last:mb-0 outline-none [-webkit-tap-highlight-color:transparent]"
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-[14px] bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)]"
          aria-hidden="true"
        />
      )}
      {!active && (
        <span className="absolute inset-0 rounded-[14px] bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      )}

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

      <span
        role="tooltip"
        className="pointer-events-none absolute z-[70] whitespace-nowrap rounded-full bg-[#111827] text-white text-[12px] font-semibold px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] opacity-0 scale-90 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 left-full ml-3.5 top-1/2 -translate-y-1/2 origin-left -translate-x-1 group-hover:translate-x-0"
      >
        {item.label}
        <span aria-hidden="true" className="absolute w-2 h-2 bg-[#111827] rotate-45 right-full top-1/2 -translate-y-1/2 -mr-1" />
      </span>
    </Link>
  );
}

function RailItems({ layoutId, folderId, horizontal = false, onOpenFolder }: { layoutId: string; folderId: string; horizontal?: boolean; onOpenFolder: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <>
      {MAIN_ITEMS.map((item) => (
        <RailLink key={item.href} item={item} active={!!isActive(item.href)} layoutId={layoutId} horizontal={horizontal} />
      ))}

      <motion.button
        layoutId={folderId}
        onClick={onOpenFolder}
        className={`relative flex flex-col items-center shrink-0 group outline-none [-webkit-tap-highlight-color:transparent] ${
          horizontal
            ? "justify-end flex-1 min-w-0 max-w-[72px] h-[72px] pb-2"
            : "justify-center w-12 h-12 mt-1"
        }`}
        aria-label="More apps"
      >
        {horizontal ? (
          <>
            <div className="relative w-full h-[32px] mb-[2px] flex items-center justify-center z-30 pointer-events-none">
              <div className="grid grid-cols-2 gap-[3px] p-[3px] w-[24px] h-[24px] opacity-80 group-hover:opacity-100 transition-opacity">
                <div className="bg-[#9CA3AF] rounded-[2px]" />
                <div className="bg-[#9CA3AF] rounded-[2px]" />
                <div className="bg-[#9CA3AF] rounded-[2px]" />
                <div className="bg-[#9CA3AF]/40 rounded-[2px]" />
              </div>
            </div>
            <span className="text-[11px] leading-[16px] font-bold text-[#9CA3AF] z-10 transition-colors duration-300 group-hover:text-gray-600">More</span>
          </>
        ) : (
          <>
            <span className="absolute inset-0 rounded-[14px] bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="relative z-10 grid grid-cols-2 gap-[3px] p-[8px] w-full h-full pointer-events-none">
              {FOLDER_ITEMS.map((item) => (
                <motion.div
                  key={item.href}
                  layoutId={`${folderId}-icon-${item.href}`}
                  className="flex items-center justify-center bg-black/10 rounded-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                >
                  <item.icon className="w-2.5 h-2.5 text-gray-800" strokeWidth={3} />
                </motion.div>
              ))}
              <div className="bg-black/5 rounded-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
            </div>
            <span
              role="tooltip"
              className="pointer-events-none absolute z-[70] whitespace-nowrap rounded-full bg-[#111827] text-white text-[12px] font-semibold px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] opacity-0 scale-90 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 left-full ml-3.5 top-1/2 -translate-y-1/2 origin-left -translate-x-1 group-hover:translate-x-0"
            >
              More Apps
              <span aria-hidden="true" className="absolute w-2 h-2 bg-[#111827] rotate-45 right-full top-1/2 -translate-y-1/2 -mr-1" />
            </span>
          </>
        )}
      </motion.button>
    </>
  );
}

function FolderOverlay({ folderId, onClose }: { folderId: string; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        layoutId={folderId}
        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        className="relative flex flex-col gap-6 p-6 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)] rounded-t-[36px] sm:rounded-[36px] w-full sm:w-[320px] pb-12 sm:pb-6 will-change-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-black text-xl tracking-tight">More Apps</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-y-8 gap-x-4">
          {FOLDER_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
                className="flex flex-col items-center gap-2.5 group cursor-pointer bg-transparent border-none p-0 m-0"
              >
                <div
                  className={`flex items-center justify-center w-[60px] h-[60px] rounded-[20px] bg-white shadow-sm border transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md ${active ? "border-black shadow-md" : "border-gray-200"}`}
                >
                  <item.icon
                    className={`w-7 h-7 transition-opacity ${active ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
                    style={{
                      stroke: `url(#${item.grad})`,
                      filter: `drop-shadow(0 1.5px 0 ${item.deep}) drop-shadow(0 3px 4px rgba(0,0,0,0.15))`,
                    }}
                    strokeWidth={2.5}
                  />
                </div>
                <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap ${active ? "text-black" : "text-gray-500"}`}>{item.label}</span>
              </button>
            );
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

      {/* Mobile floating dock — px-8 leaves room for the edge fillets inside the rounded corners */}
      {!embedded && (
        <nav
          aria-label="Primary mobile"
          className="flex lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] h-[72px] px-8 flex-row items-end justify-between rounded-[26px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)] w-[92vw] max-w-[420px]"
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