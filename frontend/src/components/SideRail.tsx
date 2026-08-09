"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home, Zap, HardDrive, Wrench, HelpCircle, Info, Tag,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { href: string; icon: LucideIcon; label: string; grad: string; stops: [string, string] }[] = [
  { href: "/",             icon: Home,       label: "Home",    grad: "grad-home",   stops: ["#38bdf8", "#3b82f6"] },
  { href: "/p2p",          icon: Zap,        label: "P2P",     grad: "grad-p2p",    stops: ["#fde047", "#f59e0b"] },
  { href: "/g2p",          icon: HardDrive,  label: "Portal",  grad: "grad-portal", stops: ["#34d399", "#10b981"] },
  { href: "/tools",        icon: Wrench,     label: "Tools",   grad: "grad-tools",  stops: ["#e879f9", "#d946ef"] },
  { href: "/how-it-works", icon: HelpCircle, label: "How",     grad: "grad-how",    stops: ["#7dd3fc", "#0ea5e9"] },
  { href: "/about",        icon: Info,       label: "About",   grad: "grad-about",  stops: ["#f472b6", "#ec4899"] },
  { href: "/pricing",      icon: Tag,        label: "Pricing", grad: "grad-price",  stops: ["#c084fc", "#9333ea"] },
];

/**
 * Icon rail in the reference's frosted-glass style, but upgraded to 
 * feature colorful, 3D-matching logos based on the user's request.
 */
function RailItems({ layoutId }: { layoutId: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {/* SVG Definitions for Gradient Strokes */}
      <svg width="0" height="0" className="absolute">
        <defs>
          {ITEMS.map((item) => (
            <linearGradient key={item.grad} id={item.grad} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop stopColor={item.stops[0]} offset="0%" />
              <stop stopColor={item.stops[1]} offset="100%" />
            </linearGradient>
          ))}
        </defs>
      </svg>

      {ITEMS.map(({ href, icon: Icon, label, grad }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="relative flex flex-col items-center gap-1.5 w-14 py-1 group"
          >
            {/* 3D Icon Slot Container */}
            <span className="relative flex items-center justify-center w-11 h-11">
              {/* Active state backplate (3D glowing button) */}
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.55 }}
                  className="absolute inset-0 rounded-[14px] bg-white border-[1px] border-white/60 shadow-[0_4px_12px_rgba(23,18,38,0.1),_inset_0_2px_4px_rgba(255,255,255,1)]"
                  aria-hidden="true"
                />
              )}
              
              {/* Inactive hover backplate */}
              {!active && (
                <span className="absolute inset-0 rounded-[14px] bg-white/40 border-[1px] border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.05),_inset_0_1px_2px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}

              {/* The Icon itself, colored with gradients and a 3D drop-shadow */}
              <Icon
                className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5"
                style={{
                  stroke: active ? `url(#${grad})` : "#8A8F93",
                  filter: active ? "drop-shadow(0px 2px 2px rgba(0,0,0,0.15))" : "none"
                }}
                strokeWidth={active ? 2.5 : 2}
              />
            </span>

            {/* Label */}
            <span
              className={`text-[10px] leading-none transition-colors duration-150 ${
                active
                  ? "font-bold text-[#171226]"
                  : "font-medium text-[#8A8F93] group-hover:text-[#171226]"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

export function SideRail({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();

  if (embedded) {
    return (
      <nav
        aria-label="Primary"
        className="hidden lg:flex shrink-0 w-[72px] rounded-l-[28px] flex-col items-center justify-center gap-3 bg-white/40 backdrop-blur-xl border-r border-white/50 shadow-[inset_-1px_0_4px_rgba(255,255,255,0.5)] self-stretch"
      >
        <RailItems layoutId="rail-active-desktop" />
      </nav>
    );
  }

  return (
    <>
      {pathname !== "/" && (
        <nav
          aria-label="Primary"
          className="hidden lg:flex fixed left-0 inset-y-0 w-[72px] z-[60] flex-col items-center justify-center gap-3 bg-white/40 backdrop-blur-xl border-r border-white/50 shadow-[8px_0_32px_rgba(70,40,140,0.12),_inset_1px_0_4px_rgba(255,255,255,0.7)]"
        >
          <RailItems layoutId="rail-active-desktop" />
        </nav>
      )}

      <nav
        aria-label="Primary mobile"
        className="flex lg:hidden fixed bottom-0 inset-x-0 z-[60] h-[68px] flex-row items-center justify-around bg-white/60 backdrop-blur-xl border-t border-white/60 shadow-[0_-8px_24px_rgba(70,40,140,0.10)] overflow-x-auto"
      >
        <RailItems layoutId="rail-active-mobile" />
      </nav>
    </>
  );
}
