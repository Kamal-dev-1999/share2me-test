"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, Wifi } from "lucide-react";

export function TopNav() {
  const pathname = usePathname();
  const router   = useRouter();

  // Scroll to #transfer on the home page, pre-selecting the given mode
  const goToTransfer = (mode: "send" | "receive") => (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === "/") {
      // Already home — just scroll and set mode via custom event
      window.dispatchEvent(new CustomEvent("set-transfer-mode", { detail: mode }));
      document.getElementById("transfer")?.scrollIntoView({ behavior: "smooth" });
    } else {
      // Navigate home then scroll
      router.push(`/?mode=${mode}#transfer`);
    }
  };

  return (
    <nav className="h-16 bg-canvas-dark border-b border-hairline-dark flex items-center px-4 sm:px-6 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
        <img src="/logo.png" alt="ShareIt Logo" className="w-8 h-8 rounded-md object-cover" />
        <span className="text-white font-display font-bold text-xl tracking-tight">
          Share<span className="text-primary">It</span>
        </span>
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-1 ml-10">
        <a
          href="#transfer"
          onClick={goToTransfer("send")}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-muted hover:text-white hover:bg-surface-cardDark transition-colors cursor-pointer"
        >
          Send
        </a>
        <a
          href="#transfer"
          onClick={goToTransfer("receive")}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-muted hover:text-white hover:bg-surface-cardDark transition-colors cursor-pointer"
        >
          Receive
        </a>
        <Link
          href="/how-it-works"
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            pathname === "/how-it-works"
              ? "text-white bg-surface-elevatedDark"
              : "text-muted hover:text-white hover:bg-surface-cardDark"
          }`}
        >
          How it Works
        </Link>
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
      </div>
    </nav>
  );
}
