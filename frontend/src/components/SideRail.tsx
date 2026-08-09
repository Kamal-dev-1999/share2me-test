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
 * Liquid-motion animated icon rail. 
 * Features a seamless gooey SVG bulge for the active item that physically 
 * travels along the edge of the glass container.
 */
function RailItems({ layoutId, isMobile = false }: { layoutId: string; isMobile?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {/* SVG Definitions for Gradient Strokes & Backgrounds */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="glass-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="rgba(255, 255, 255, 1)" offset="0%" />
            <stop stopColor="rgba(255, 255, 255, 0.4)" offset="100%" />
          </linearGradient>
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
            className={`relative flex flex-col items-center justify-center group ${
              isMobile ? "h-full w-[68px]" : "w-full h-[76px]"
            }`}
          >
            {/* Active state liquid background - Desktop (Vertical) */}
            {active && !isMobile && (
              <motion.svg
                layoutId={`${layoutId}-bg`}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className="absolute left-0 w-[104px] h-[100px] top-[50%] -translate-y-1/2 z-0 pointer-events-none drop-shadow-[4px_4px_12px_rgba(70,40,140,0.2)]"
                viewBox="0 0 104 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 0 L72 0 C72 15, 76 20, 84 26 C96 35, 104 42, 104 50 C104 58, 96 65, 84 74 C76 80, 72 85, 72 100 L0 100 Z"
                  fill="url(#glass-gradient)"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="1.5"
                />
              </motion.svg>
            )}

            {/* Active state liquid background - Mobile (Horizontal) */}
            {active && isMobile && (
              <motion.svg
                layoutId={`${layoutId}-bg`}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className="absolute bottom-0 w-[100px] h-[100px] left-[50%] -translate-x-1/2 z-0 pointer-events-none drop-shadow-[0px_-4px_12px_rgba(70,40,140,0.2)]"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 100 L0 32 C15 32, 20 28, 26 20 C35 8, 42 0, 50 0 C58 0, 65 8, 74 20 C80 28, 85 32, 100 32 L100 100 Z"
                  fill="url(#glass-gradient)"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="1.5"
                />
              </motion.svg>
            )}

            {/* Inactive hover backplate (keeps the pill shape for inactive items) */}
            {!active && (
              <span className="absolute inset-0 m-auto w-[52px] h-[52px] rounded-[16px] bg-white/40 border-[1px] border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.05)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}

            {/* 3D Icon Slot Container */}
            <span
              className={`relative z-10 flex items-center justify-center w-11 h-11 transition-transform duration-300 ${
                active && !isMobile ? "translate-x-2" : ""
              } ${active && isMobile ? "-translate-y-2.5" : ""}`}
            >
              <Icon
                className={`relative z-10 w-5 h-5 transition-transform duration-300 ${
                  !active && "group-hover:scale-110 group-hover:-translate-y-0.5"
                }`}
                style={{
                  stroke: active ? `url(#${grad})` : "#8A8F93",
                  filter: active ? "drop-shadow(0px 3px 3px rgba(0,0,0,0.2))" : "none",
                }}
                strokeWidth={active ? 2.5 : 2}
              />
            </span>

            {/* Label */}
            <span
              className={`relative z-10 text-[10px] leading-none transition-transform duration-300 ${
                active
                  ? "font-bold text-[#171226]"
                  : "font-medium text-[#8A8F93] group-hover:text-[#171226]"
              } ${active && !isMobile ? "translate-x-2" : ""} ${
                active && isMobile ? "-translate-y-2" : ""
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
        className="hidden lg:flex shrink-0 w-[72px] rounded-l-[28px] flex-col items-center justify-center gap-0 py-4 bg-white/40 backdrop-blur-xl border-r border-white/50 shadow-[inset_-1px_0_4px_rgba(255,255,255,0.5)] self-stretch"
      >
        <RailItems layoutId="rail-active-desktop" isMobile={false} />
      </nav>
    );
  }

  return (
    <>
      {pathname !== "/" && (
        <nav
          aria-label="Primary"
          className="hidden lg:flex fixed left-0 inset-y-0 w-[72px] z-[60] flex-col items-center justify-center gap-0 py-4 bg-white/40 backdrop-blur-xl border-r border-white/50 shadow-[8px_0_32px_rgba(70,40,140,0.12),_inset_1px_0_4px_rgba(255,255,255,0.7)]"
        >
          <RailItems layoutId="rail-active-desktop" isMobile={false} />
        </nav>
      )}

      <nav
        aria-label="Primary mobile"
        className="flex lg:hidden fixed bottom-0 inset-x-0 z-[60] h-[68px] flex-row items-center justify-around gap-0 bg-white/60 backdrop-blur-xl border-t border-white/60 shadow-[0_-8px_24px_rgba(70,40,140,0.10)] overflow-x-auto"
      >
        <RailItems layoutId="rail-active-mobile" isMobile={true} />
      </nav>
    </>
  );
}
