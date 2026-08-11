"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home, ArrowRightLeft, Cloud, LayoutGrid, Lightbulb, Info, CreditCard, Newspaper, Users,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { href: string; icon: LucideIcon; label: string; grad: string; stops: [string, string] }[] = [
  { href: "/",             icon: Home,           label: "Home",    grad: "grad-home",   stops: ["#38bdf8", "#3b82f6"] },
  { href: "/p2p",          icon: ArrowRightLeft, label: "P2P",     grad: "grad-p2p",    stops: ["#fde047", "#f59e0b"] },
  { href: "/g2p",          icon: Cloud,          label: "Portal",  grad: "grad-portal", stops: ["#34d399", "#10b981"] },
  { href: "/tools",        icon: LayoutGrid,     label: "Tools",   grad: "grad-tools",  stops: ["#e879f9", "#d946ef"] },
  { href: "/how-it-works", icon: Lightbulb,      label: "How",     grad: "grad-how",    stops: ["#7dd3fc", "#0ea5e9"] },
  { href: "/blog",         icon: Newspaper,      label: "Blog",    grad: "grad-blog",   stops: ["#fb923c", "#ea580c"] },
  { href: "/about",        icon: Users,          label: "About",   grad: "grad-about",  stops: ["#f472b6", "#ec4899"] },
  { href: "/pricing",      icon: CreditCard,     label: "Pricing", grad: "grad-price",  stops: ["#c084fc", "#9333ea"] },
];

/**
 * Apple iPadOS / macOS inspired floating dock sidebar, but with 
 * vibrant 3D colorful icons.
 */
function RailItems({ layoutId, horizontal = false }: { layoutId: string; horizontal?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {ITEMS.map(({ href, icon: Icon, label, grad }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`relative flex items-center justify-center group shrink-0 ${
              horizontal ? "w-10 h-10" : "w-12 h-12 mb-2 last:mb-0"
            }`}
          >
            {/* Active state backplate (Apple style subtle translucent pill) */}
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
              <span className="absolute inset-0 rounded-[14px] bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}

            {/* Icon - Vibrant 3D gradient stroke */}
            <Icon
              className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{
                stroke: `url(#${grad})`,
                filter: active ? "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" : "drop-shadow(0px 1px 2px rgba(0,0,0,0.1))"
              }}
              strokeWidth={active ? 2.5 : 2}
            />
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
          className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 w-[64px] z-[60] flex-col items-center py-4 rounded-[28px] bg-white/45 backdrop-blur-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,0.9)]"
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
