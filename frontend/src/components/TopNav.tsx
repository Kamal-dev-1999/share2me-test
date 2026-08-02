"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
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
    `px-3 py-1.5 rounded-md label-caps transition-all border-2 ${
      active
        ? "bg-signal-yellow border-ink text-ink"
        : "border-transparent text-on-surface hover:bg-signal-yellow hover:border-ink"
    }`;

  return (
    <nav className="bg-surface border-b-2 border-ink shadow-[0_4px_0_0_rgba(30,27,21,1)] sticky top-0 z-50">
      <div
        ref={menuRef}
        className="w-full max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 h-[68px] flex items-center justify-between relative"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 flex-shrink-0 group"
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="w-10 h-10 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ink"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="leading-none">
            <span className="block font-display font-bold text-[22px] uppercase tracking-tight text-on-surface">
              Share<span className="text-ink">2Me</span>
            </span>
            <span className="hidden sm:inline-block label-caps mt-1 bg-ink text-surface px-1.5 py-[1px] rounded-sm text-[10px]">
              V3.0
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 ml-8 lg:ml-12">
          <Link href="/" className={linkClass(isActive("/"))}>Home</Link>
          <Link href="/p2p?mode=send" onClick={goToTransfer("send")} className={linkClass(isActive("/p2p"))}>
            Send
          </Link>
          <Link href="/p2p?mode=receive" onClick={goToTransfer("receive")} className={linkClass(false)}>
            Receive
          </Link>
          <Link href="/g2p" className={linkClass(isActive("/g2p"))}>Portal</Link>
          <Link href="/how-it-works" className={linkClass(isActive("/how-it-works"))}>How</Link>
          <Link href="/about" className={linkClass(isActive("/about"))}>About</Link>
          <Link href="/blog" className={linkClass(isActive("/blog"))}>Blog</Link>
          <Link href="/pricing" className={linkClass(isActive("/pricing"))}>Pricing</Link>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/p2p"
            className="hidden md:inline-flex bg-signal-yellow text-ink border-2 border-ink rounded-lg px-4 py-1.5 label-caps items-center gap-2 shadow-hard-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Start Transfer
          </Link>

          {/* Mobile toggle */}
          <button
            suppressHydrationWarning
            className="md:hidden w-10 h-10 flex items-center justify-center border-2 border-ink rounded-md bg-surface text-ink hover:bg-signal-yellow transition-colors"
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
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute top-[calc(100%+8px)] right-4 w-64 bg-surface border-2 border-ink rounded-xl shadow-hard flex flex-col p-2 md:hidden origin-top-right z-50"
            >
              {[
                { href: "/", label: "Home" },
                { href: "/p2p?mode=send", label: "Send a File", onClick: goToTransfer("send") },
                { href: "/p2p?mode=receive", label: "Receive a File", onClick: goToTransfer("receive") },
                { href: "/g2p", label: "Permanent Portal" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={item.onClick ?? (() => setIsMenuOpen(false))}
                  className="px-3 py-2.5 rounded-md label-caps text-on-surface hover:bg-signal-yellow border-2 border-transparent hover:border-ink transition-all"
                >
                  {item.label}
                </Link>
              ))}
              <div className="h-[2px] w-full bg-ink my-2" />
              {[
                { href: "/how-it-works", label: "How it Works" },
                { href: "/about", label: "About" },
                { href: "/blog", label: "Blog" },
                { href: "/pricing", label: "Pricing" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="px-3 py-2.5 rounded-md label-caps text-on-surface hover:bg-signal-yellow border-2 border-transparent hover:border-ink transition-all"
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
