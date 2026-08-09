"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home, Zap, HardDrive, Wrench, HelpCircle, Info, Tag,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/",             icon: Home,       label: "Home" },
  { href: "/p2p",          icon: Zap,        label: "P2P" },
  { href: "/g2p",          icon: HardDrive,  label: "Portal" },
  { href: "/tools",        icon: Wrench,     label: "Tools" },
  { href: "/how-it-works", icon: HelpCircle, label: "How" },
  { href: "/about",        icon: Info,       label: "About" },
  { href: "/pricing",      icon: Tag,        label: "Pricing" },
];

/**
 * Apple iPadOS / macOS inspired floating dock sidebar.
 * Features deep frosting, liquid floating layout, and solid monochrome 3D icons.
 */
function RailItems({ layoutId, horizontal = false }: { layoutId: string; horizontal?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {ITEMS.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`relative flex items-center justify-center group ${
              horizontal ? "w-12 h-12" : "w-12 h-12 mb-2 last:mb-0"
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

            {/* Icon - Pure White with subtle drop shadow for depth when active, soft grey when inactive */}
            <Icon
              className="relative z-10 w-5 h-5 transition-all duration-300 group-hover:scale-110"
              style={{
                filter: active ? "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))" : "none"
              }}
              color={active ? "#111827" : "#6B7280"}
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

  // If embedded in the home page hero panel, it hugs the left edge as a pill.
  if (embedded) {
    return (
      <nav
        aria-label="Primary"
        className="hidden lg:flex shrink-0 w-[64px] rounded-l-[32px] flex-col items-center justify-center py-4 bg-white/50 backdrop-blur-3xl border-r border-white/60 shadow-[inset_-1px_0_4px_rgba(255,255,255,0.5)] self-stretch"
      >
        <RailItems layoutId="rail-active-desktop" />
      </nav>
    );
  }

  return (
    <>
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
        className="flex lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] h-[64px] px-2 flex-row items-center justify-around gap-1 rounded-[32px] bg-white/50 backdrop-blur-[32px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,0.9)] max-w-[90vw] overflow-x-auto"
      >
        <RailItems layoutId="rail-active-mobile" horizontal />
      </nav>
    </>
  );
}
