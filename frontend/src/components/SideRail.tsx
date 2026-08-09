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
 * Icon rail in the reference's frosted-glass style.
 *
 * - `embedded` — renders as the glass panel's own left column (home page
 *   fuses it into the panel; rounded left edge matches the panel radius).
 * - default    — fixed full-height glass strip on the left of every other
 *   page. The global instance in layout.tsx skips the home route so the
 *   embedded one isn't doubled.
 *
 * Active item: white circle that bulges out of the rail to the right.
 */
function RailItems({ layoutId }: { layoutId: string }) {
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
            aria-label={label}
            className="relative flex flex-col items-center gap-1 w-14 py-0.5 group"
          >
            {/* Icon slot — active gets the outlined squircle that glides
                between items on navigation (shared layoutId) */}
            <span className="relative flex items-center justify-center w-10 h-10">
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.55 }}
                  className="absolute inset-0 rounded-[14px] bg-white border-[1.5px] border-[#171226] shadow-[0_4px_12px_rgba(23,18,38,0.12)]"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={`relative z-10 w-5 h-5 transition-colors duration-150 ${
                  active
                    ? "text-[#171226]"
                    : "text-[#8A8F93] group-hover:text-[#171226]"
                }`}
                strokeWidth={active ? 2.25 : 2}
              />
            </span>
            {/* Label — always visible, bold when active */}
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
    // Home page fuses this into the glass panel's left edge (desktop only).
    return (
      <nav
        aria-label="Primary"
        className="hidden lg:flex shrink-0 w-[68px] rounded-l-[28px] flex-col items-center justify-center gap-3 bg-white/35 backdrop-blur-xl border-r border-white/50 self-stretch"
      >
        <RailItems layoutId="rail-active-desktop" />
      </nav>
    );
  }

  return (
    <>
      {/* Desktop fixed rail — every page except home (home embeds its own) */}
      {pathname !== "/" && (
        <nav
          aria-label="Primary"
          className="hidden lg:flex fixed left-0 inset-y-0 w-[68px] z-[60] flex-col items-center justify-center gap-3 bg-white/30 backdrop-blur-xl border-r border-white/50 shadow-[8px_0_32px_rgba(70,40,140,0.12)]"
        >
          <RailItems layoutId="rail-active-desktop" />
        </nav>
      )}

      {/* Mobile bottom bar — all pages (the reference's horizontal layout) */}
      <nav
        aria-label="Primary mobile"
        className="flex lg:hidden fixed bottom-0 inset-x-0 z-[60] h-[64px] flex-row items-center justify-around bg-white/60 backdrop-blur-xl border-t border-white/60 shadow-[0_-8px_24px_rgba(70,40,140,0.10)] overflow-x-auto"
      >
        <RailItems layoutId="rail-active-mobile" />
      </nav>
    </>
  );
}
