"use client";
import { Shield, Zap, Wifi } from "lucide-react";

export function TopNav() {
  return (
    <nav className="h-16 bg-canvas-dark border-b border-hairline-dark flex items-center px-6 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        {/* Logo mark */}
        <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
          <Zap className="w-5 h-5 text-ink" strokeWidth={2.5} />
        </div>
        <span className="text-white font-display font-bold text-xl tracking-tight">
          Share<span className="text-primary">It</span>
        </span>
      </div>

      {/* Nav items */}
      <div className="hidden md:flex items-center gap-6 ml-10">
        {["Send", "Receive", "How it Works"].map((item) => (
          <a
            key={item}
            href="#"
            className="text-sm font-medium text-muted hover:text-white transition-colors"
          >
            {item}
          </a>
        ))}
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
