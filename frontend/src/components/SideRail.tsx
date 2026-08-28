"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home, Network, Inbox, Wrench, Compass, Coffee, Fingerprint, Tag,
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

/**
 * Apple-style floating dock with clean monochrome icons. On hover the icon
 * grows and an animated pill flies out with the item's full name — the name
 * IS the explanation, so no colors are needed to decode the icons.
 */
function RailItems({ layoutId, horizontal = false }: { layoutId: string; horizontal?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {ITEMS.map(({ href, icon: Icon, label, grad, deep }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`relative flex items-center justify-center group shrink-0 ${
              horizontal ? "w-10 h-10" : "w-12 h-12 mb-2 last:mb-0"
            }`}
          >
            {/* Active state backplate — frosted light pill */}
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="absolute inset-0 rounded-[14px] bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)]"
                aria-hidden="true"
              />
            )}

            {/* Inactive hover backplate */}
            {!active && (
              <span className="absolute inset-0 rounded-[14px] bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}

            {/* Icon — 3D: gradient face + hard colored extrusion (the "side
                face", like the beveled brand logo) + soft ground shadow */}
            <Icon
              className={`relative z-10 w-5 h-5 transition-all duration-300 ease-out group-hover:scale-125 group-hover:-translate-y-0.5 group-hover:opacity-100 ${
                active ? "opacity-100" : "opacity-60"
              }`}
              style={{
                stroke: `url(#${grad})`,
                filter: active
                  ? `drop-shadow(0 1.5px 0 ${deep}) drop-shadow(0 5px 6px rgba(0,0,0,0.30))`
                  : `drop-shadow(0 1px 0 ${deep}) drop-shadow(0 2.5px 3px rgba(0,0,0,0.18))`,
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
              {label}
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
      })}
    </>
  );
}

export function SideRail({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();

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

  // If embedded in the home page hero panel, it hugs the left edge as a pill.
  if (embedded) {
    return (
      <nav
        aria-label="Primary"
        className="hidden lg:flex shrink-0 w-[64px] rounded-l-[32px] flex-col items-center justify-center py-4 bg-white/50 backdrop-blur-3xl border-r border-white/60 shadow-[inset_-1px_0_4px_rgba(255,255,255,0.5)] self-stretch"
      >
        {defs}
        <RailItems layoutId="rail-active-desktop" />
      </nav>
    );
  }

  return (
    <>
      {defs}
      {/* Desktop floating vertical dock */}
      {pathname !== "/" && (
        <nav
          aria-label="Primary"
          className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 w-[64px] z-[60] flex-col items-center py-4 rounded-[28px] bg-white/45 backdrop-blur-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.10),_inset_0_1px_1px_rgba(255,255,255,0.9)]"
        >
          <RailItems layoutId="rail-active-desktop" />
        </nav>
      )}

      {/* Mobile floating horizontal dock */}
      <nav
        aria-label="Primary mobile"
        className="flex lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] h-[56px] px-1.5 flex-row items-center justify-around gap-0.5 rounded-[28px] bg-white/50 backdrop-blur-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,0.9)] max-w-[95vw] overflow-x-auto scrollbar-hide"
      >
        <RailItems layoutId="rail-active-mobile" horizontal />
      </nav>
    </>
  );
}
