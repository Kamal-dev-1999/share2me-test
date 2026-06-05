"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Zap, Wifi } from "lucide-react";

export function TopNav() {
  const pathname = usePathname();

  const navLinks = [
    { label: "Send",         href: "/send" },
    { label: "Receive",      href: "/#transfer", scroll: true },
    { label: "How it Works", href: "/how-it-works" },
  ];

  const handleReceive = (e: React.MouseEvent) => {
    // If already on home page, just smooth-scroll to #transfer
    if (pathname === "/") {
      e.preventDefault();
      document.getElementById("transfer")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="h-16 bg-canvas-dark border-b border-hairline-dark flex items-center px-4 sm:px-6 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
          <Zap className="w-5 h-5 text-ink" strokeWidth={2.5} />
        </div>
        <span className="text-white font-display font-bold text-xl tracking-tight">
          Share<span className="text-primary">It</span>
        </span>
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-1 ml-10">
        {navLinks.map(({ label, href }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href.split("#")[0]));
          const isReceive = label === "Receive";
          return (
            <Link
              key={label}
              href={href}
              onClick={isReceive ? handleReceive : undefined}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive && !isReceive
                  ? "text-white bg-surface-elevatedDark"
                  : "text-muted hover:text-white hover:bg-surface-cardDark"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted">
          <Shield className="w-3.5 h-3.5 text-trading-up" />
          <span>E2E Encrypted</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Wifi className="w-3.5 h-3.5 text-primary" />
          <span>P2P Only</span>
        </div>
        {/* Mobile: quick action buttons */}
        <div className="flex md:hidden items-center gap-2 ml-2">
          <Link
            href="/send"
            className="bg-primary text-ink text-xs font-bold px-3 py-1.5 rounded-md hover:bg-primary-active transition-colors"
          >
            Send
          </Link>
        </div>
      </div>
    </nav>
  );
}
