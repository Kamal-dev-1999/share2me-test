"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, Wifi, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TopNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Scroll to #transfer on the home page, pre-selecting the given mode
  const goToTransfer = (mode: "send" | "receive") => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(false); // Close menu on click
    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent("set-transfer-mode", { detail: mode }));
      document.getElementById("transfer")?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`/?mode=${mode}#transfer`);
    }
  };

  return (
    <nav className="h-[72px] bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-center sticky top-0 z-50">
      <div className="w-full max-w-[1440px] px-6 lg:px-8 flex items-center justify-between relative" ref={menuRef}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0 group" onClick={() => setIsMenuOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors border border-primary/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <span className="text-text-primary font-display font-bold text-xl tracking-tight">
            Share<span className="text-primary">2Me</span>
          </span>
        </Link>

        {/* Nav links (Desktop) */}
        <div className="hidden md:flex items-center gap-1.5 ml-12 lg:ml-16">
          <a href="/#transfer" onClick={goToTransfer("send")} className="px-4 py-2 rounded-lg text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-all cursor-pointer">
            Send
          </a>
          <a href="/#transfer" onClick={goToTransfer("receive")} className="px-4 py-2 rounded-lg text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-all cursor-pointer">
            Receive
          </a>
          <Link href="/how-it-works" className="px-4 py-2 rounded-lg text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-all">
            How it Works
          </Link>
          <Link href="/about" className="px-4 py-2 rounded-lg text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-all">
            About Us
          </Link>
          <Link href="/blog" className="px-4 py-2 rounded-lg text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-all">
            Blog
          </Link>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background-elevated/50">
              <Shield className="w-3.5 h-3.5 text-status-success" />
              <span className="text-[12px] font-medium text-text-secondary">E2E Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background-elevated/50">
              <Wifi className="w-3.5 h-3.5 text-primary" />
              <span className="text-[12px] font-medium text-text-secondary">P2P Only</span>
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button 
            className="md:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-[calc(100%+16px)] right-6 w-56 bg-background-elevated border border-border rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col p-2 md:hidden overflow-hidden origin-top-right z-50"
            >
              <a href="/#transfer" onClick={goToTransfer("send")} className="px-4 py-3 rounded-xl text-[15px] font-medium text-text-secondary hover:text-text-primary hover:bg-background-card transition-all cursor-pointer flex items-center gap-3">
                Send a File
              </a>
              <a href="/#transfer" onClick={goToTransfer("receive")} className="px-4 py-3 rounded-xl text-[15px] font-medium text-text-secondary hover:text-text-primary hover:bg-background-card transition-all cursor-pointer flex items-center gap-3">
                Receive a File
              </a>
              <div className="h-px w-full bg-border my-1" />
              <Link href="/how-it-works" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 rounded-xl text-[15px] font-medium text-text-secondary hover:text-text-primary hover:bg-background-card transition-all flex items-center gap-3">
                How it Works
              </Link>
              <Link href="/about" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 rounded-xl text-[15px] font-medium text-text-secondary hover:text-text-primary hover:bg-background-card transition-all flex items-center gap-3">
                About Us
              </Link>
              <Link href="/blog" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 rounded-xl text-[15px] font-medium text-text-secondary hover:text-text-primary hover:bg-background-card transition-all flex items-center gap-3">
                Blog
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
