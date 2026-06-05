"use client";
import { Lock, Zap, Globe } from "lucide-react";

const STATS = [
  { value: "AES-256", label: "Encryption Standard", color: "text-primary" },
  { value: "P2P",     label: "Direct Transfer",     color: "text-trading-up" },
  { value: "0 KB",    label: "Stored on Server",    color: "text-primary" },
];

const TRUST = [
  { icon: Lock,  label: "ECDH Key Exchange",   sub: "Raw key never leaves your device" },
  { icon: Zap,   label: "WebRTC DataChannel",  sub: "Browser-native P2P, no plugins" },
  { icon: Globe, label: "Works Everywhere",    sub: "Any device, any OS, any browser" },
];

export function HeroSection() {
  return (
    <section className="py-8 sm:py-14 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Hero headline */}
      <div className="max-w-3xl mb-8 sm:mb-14">
        <p className="text-primary text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3">
          Secure · Private · Fast
        </p>
        <h1 className="text-3xl sm:text-5xl lg:text-hero font-display font-bold text-white leading-tight tracking-tight mb-4">
          Transfer Files.<br />
          <span className="text-gradient-yellow">No Cloud.</span><br />
          No Compromise.
        </h1>
        <p className="text-body text-sm sm:text-base leading-relaxed max-w-xl">
          End-to-end encrypted peer-to-peer file transfer. Your file goes directly
          to the recipient — never touches our servers. Powered by WebRTC and AES‑GCM‑256.
        </p>
      </div>

      {/* Stat callouts */}
      <div className="flex flex-wrap gap-6 sm:gap-8 mb-8 sm:mb-14">
        {STATS.map((s) => (
          <div key={s.label}>
            <div className={`font-mono text-2xl sm:text-disp-md font-bold ${s.color}`}>{s.value}</div>
            <div className="text-muted text-xs sm:text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Trust badges — single column on mobile */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        {TRUST.map(({ icon: Icon, label, sub }) => (
          <div
            key={label}
            className="flex items-center gap-3 bg-surface-cardDark rounded-lg px-4 py-3 border border-hairline-dark"
          >
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-white text-sm font-semibold">{label}</div>
              <div className="text-muted text-xs">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
