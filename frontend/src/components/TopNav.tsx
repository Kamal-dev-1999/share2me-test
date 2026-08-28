"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const goToTransfer = (mode: "send" | "receive") => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(false);
    router.push(`/p2p?mode=${mode}`);
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  const linkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
      active
        ? "bg-surface-muted text-on-surface"
        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-muted"
    }`;

  return (
    <nav className="bg-surface border-b border-hairline sticky top-0 z-50">
      <div
        ref={menuRef}
        className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between relative"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 flex-shrink-0"
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-black flex items-center justify-center relative">
            <Image
              src="/logo.png"
              alt="Share2Me Logo"
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="font-semibold text-[16px] tracking-tight text-on-surface">
            Share2Me
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 ml-4 lg:ml-8">
          <Link href="/" className={linkClass(!!isActive("/"))}>Home</Link>
          <Link href="/p2p?mode=send" onClick={goToTransfer("send")} className={linkClass(!!isActive("/p2p"))}>
            Direct Transfer
          </Link>
          <Link href="/g2p" className={linkClass(!!isActive("/g2p"))}>Share with Code</Link>
          <Link href="/tools" className={linkClass(!!isActive("/tools"))}>Tools</Link>
          <Link href="/about" className={linkClass(!!isActive("/about"))}>About</Link>
          <Link href="/pricing" className={linkClass(!!isActive("/pricing"))}>Pricing</Link>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/p2p"
            className="hidden md:inline-flex items-center gap-2 h-9 px-4 rounded-full bg-black text-white text-[13px] font-medium hover:bg-neutral-800 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={2} />
            Start transfer
          </Link>

          <button
            suppressHydrationWarning
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-muted transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-[calc(100%+6px)] right-4 w-60 bg-surface border border-hairline rounded-xl shadow-[0_8px_24px_rgba(17,17,17,0.06)] flex flex-col p-1.5 md:hidden origin-top-right z-50"
            >
              {[
                { href: "/", label: "Home" },
                { href: "/p2p?mode=send", label: "Send a file", onClick: goToTransfer("send") },
                { href: "/p2p?mode=receive", label: "Receive a file", onClick: goToTransfer("receive") },
                { href: "/g2p", label: "Share with Code" },
                { href: "/tools", label: "PDF tools" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={item.onClick ?? (() => setIsMenuOpen(false))}
                  className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-on-surface hover:bg-surface-muted transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <div className="h-px w-full bg-hairline my-1" />
              {[
                { href: "/about", label: "About" },
                { href: "/blog", label: "Blog" },
                { href: "/pricing", label: "Pricing" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-muted transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
