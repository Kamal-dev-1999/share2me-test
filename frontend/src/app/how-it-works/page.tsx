"use client";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import {
  Upload, QrCode, Wifi, Lock, ShieldCheck,
  Server, Eye, Key, Zap, ArrowRight, Monitor, Smartphone,
} from "lucide-react";

// ── Steps data ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Upload,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20",
    title: "Drop your file",
    desc: "Select any file. It stays entirely on your device — nothing is uploaded at this point.",
  },
  {
    icon: Key,
    color: "text-accent-turquoise", bg: "bg-accent-turquoise/10", border: "border-accent-turquoise/20",
    title: "Local AES-GCM-256 encryption",
    desc: "A random 256-bit key is generated in your browser. The file is split into chunks; each is encrypted with a unique IV.",
  },
  {
    icon: QrCode,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20",
    title: "Share OTC or QR code",
    desc: "A 6-digit one-time code and QR code are generated from file metadata. Share verbally or let the receiver scan.",
  },
  {
    icon: Lock,
    color: "text-status-success", bg: "bg-status-success/10", border: "border-status-success/20",
    title: "ECDH key exchange",
    desc: "The receiver generates an ephemeral P-256 key pair and sends the public key. The sender wraps the AES key — the raw key never leaves either device.",
  },
  {
    icon: Wifi,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20",
    title: "WebRTC P2P tunnel",
    desc: "A direct RTCDataChannel is established. The signaling server is only used for the WebRTC handshake — it never sees your file or keys.",
  },
  {
    icon: ShieldCheck,
    color: "text-status-success", bg: "bg-status-success/10", border: "border-status-success/20",
    title: "Encrypted transfer + NACK retry",
    desc: "Chunks stream directly peer-to-peer. Missing chunks are automatically re-requested via NACK until all arrive and the file is assembled.",
  },
];

const GUARANTEES = [
  { icon: Server,     title: "Zero server storage", desc: "No file, chunk, or key touches our servers. The signaling server only relays WebRTC handshake messages." },
  { icon: Eye,        title: "No interception possible", desc: "Every byte is AES-GCM-256 encrypted with a random IV per chunk before it leaves your device." },
  { icon: Key,        title: "Forward secrecy", desc: "Each transfer uses a freshly generated AES key and ECDH pair. No long-lived secrets exist." },
  { icon: Zap,        title: "No installs needed", desc: "Runs entirely in your browser using Web Crypto API and WebRTC — both built into every modern browser." },
];

const FAQS = [
  { q: "What is the maximum file size?", a: "No hard limit. Practical limits depend on available browser memory and network speed. Files over 1 GB may take longer to encrypt." },
  { q: "Do both devices need to be online simultaneously?", a: "Yes. WebRTC is a live connection. Both sender and receiver must have the page open at the same time." },
  { q: "What if the transfer fails halfway?", a: "Share2Me uses NACK (Negative Acknowledgement) retry. After the sender signals done, the receiver checks for missing chunks and requests only those to be re-sent." },
  { q: "Do I need to trust the signaling server?", a: "No. The server only sees WebRTC offer/answer/ICE messages and the 6-digit OTC. It never sees your file, AES key, or any plaintext data." },
  { q: "Can I self-host Share2Me?", a: "Yes. The backend is a single Node.js file (server.js). Clone the repo and run npm install in both directories." },
];

// ── Flow Diagram ─────────────────────────────────────────────────────────────
function FlowDiagram() {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[700px] relative px-4 py-6">

        {/* ── ROW 1: Sender device / Signaling server / Receiver device ── */}
        <div className="grid grid-cols-3 gap-6 items-center mb-0">

          {/* SENDER */}
          <div className="flex flex-col items-center">
            <div className="bg-background-card border border-primary/30 rounded-2xl p-5 w-full text-center
                            shadow-[0_0_24px_rgba(252,213,53,0.08)]">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="text-text-primary font-bold text-sm mb-1">Sender</div>
              <div className="text-text-tertiary text-xs">Browser / Device</div>

              {/* Inner steps */}
              <div className="mt-4 space-y-2 text-left">
                {[
                  { label: "📄 File selected" },
                  { label: "🔑 AES-256 key gen" },
                  { label: "🔒 Chunks encrypted" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background-elevated rounded-lg px-3 py-2">
                    <span className="text-xs text-text-secondary">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SIGNALING SERVER (centre) */}
          <div className="flex flex-col items-center">
            {/* OTC / QR arrow down from sender side */}
            <div className="flex items-center w-full mb-3">
              <div className="flex-1 h-px bg-gradient-to-r from-primary/40 to-surface-elevatedDark" />
              <div className="flex flex-col items-center mx-2">
                <div className="bg-background-card border border-border rounded-lg px-2 py-1 mb-1">
                  <span className="text-xs text-text-tertiary font-mono">OTC / QR</span>
                </div>
                <svg width="20" height="12" viewBox="0 0 20 12" className="text-text-tertiary">
                  <path d="M10 12 L0 0 L20 0 Z" fill="currentColor" opacity="0.4" />
                </svg>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-primary/40 to-surface-elevatedDark" />
            </div>

            {/* Signaling box */}
            <div className="bg-background-elevated border border-border rounded-2xl p-4 w-full text-center">
              <div className="flex justify-center mb-2">
                <div className="w-10 h-10 bg-background-card rounded-xl flex items-center justify-center">
                  <Server className="w-5 h-5 text-text-tertiary" />
                </div>
              </div>
              <div className="text-text-tertiary font-semibold text-xs mb-1">Signaling Server</div>
              <div className="text-xs text-text-tertiary/60 leading-relaxed">
                WebRTC handshake only.<br />Never sees your file.
              </div>
              <div className="mt-3 bg-background-card rounded-lg px-2 py-1.5">
                <span className="text-xs text-text-tertiary/70 font-mono">offer / answer / ICE</span>
              </div>
            </div>

            {/* ECDH key exchange arrow up from receiver side */}
            <div className="flex items-center w-full mt-3">
              <div className="flex-1 h-px bg-gradient-to-r from-status-success/30 to-surface-elevatedDark" />
              <div className="flex flex-col items-center mx-2">
                <svg width="20" height="12" viewBox="0 0 20 12" className="text-status-success rotate-180 mb-1">
                  <path d="M10 12 L0 0 L20 0 Z" fill="currentColor" opacity="0.4" />
                </svg>
                <div className="bg-background-card border border-status-success/20 rounded-lg px-2 py-1">
                  <span className="text-xs text-status-success font-mono">ECDH keys</span>
                </div>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-status-success/30 to-surface-elevatedDark" />
            </div>
          </div>

          {/* RECEIVER */}
          <div className="flex flex-col items-center">
            <div className="bg-background-card border border-status-success/30 rounded-2xl p-5 w-full text-center
                            shadow-[0_0_24px_rgba(14,203,129,0.06)]">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-status-success/10 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-status-success" />
                </div>
              </div>
              <div className="text-text-primary font-bold text-sm mb-1">Receiver</div>
              <div className="text-text-tertiary text-xs">Browser / Device</div>

              {/* Inner steps */}
              <div className="mt-4 space-y-2 text-left">
                {[
                  { label: "📷 Scan QR / enter OTC" },
                  { label: "🔑 ECDH key pair gen" },
                  { label: "🔓 Chunks decrypted" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background-elevated rounded-lg px-3 py-2">
                    <span className="text-xs text-text-secondary">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: WebRTC P2P data channel arrow ── */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex-shrink-0 w-full flex flex-col items-center">
            {/* Label */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-primary via-primary/60 to-status-success
                              relative overflow-visible">
                {/* Animated dot */}
                <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary
                                animate-[slide_2.5s_linear_infinite]
                                shadow-[0_0_8px_rgba(252,213,53,0.8)]" />
                <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary
                                animate-[slide_2.5s_linear_infinite_0.8s]
                                shadow-[0_0_8px_rgba(252,213,53,0.8)]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 bg-background-card border border-primary/20
                            rounded-xl px-5 py-3 w-fit mx-auto">
              <Wifi className="w-4 h-4 text-primary" />
              <span className="text-text-primary font-semibold text-sm">WebRTC P2P DataChannel</span>
              <span className="text-text-tertiary text-xs ml-2">— encrypted chunks only, direct device-to-device</span>
            </div>
          </div>
        </div>

        {/* Sliding dot keyframe via style tag */}
        <style>{`
          @keyframes slide {
            0%   { left: 0%; opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 1; }
            100% { left: 100%; opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/* Hero */}
      <div className="border-b border-border bg-background-card/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">Under the Hood</p>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-text-primary tracking-tight mb-5">
            How Share2Me Works
          </h1>
          <p className="text-text-tertiary text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Every transfer is end-to-end encrypted, peer-to-peer, and ephemeral.
            Here&apos;s exactly what happens — from the moment you drop a file to the moment the receiver saves it.
          </p>
        </div>
      </div>

      {/* ── Flow Diagram ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-text-primary mb-2">Transfer Architecture</h2>
          <p className="text-text-tertiary text-sm">The complete flow — sender, signaling, and receiver</p>
        </div>
        <div className="bg-background-card border border-border rounded-2xl p-4 sm:p-8">
          <FlowDiagram />
        </div>
      </section>

      {/* ── Step-by-step ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="text-center mb-10">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-text-primary mb-2">Step-by-Step Breakdown</h2>
          <p className="text-text-tertiary text-sm">What happens at each stage of the transfer</p>
        </div>

        <div className="relative">
          {/* Vertical line connector */}
          <div className="absolute left-5 top-5 bottom-5 w-px bg-gradient-to-b from-primary/40 via-hairline-dark to-status-success/40 hidden sm:block" />

          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-4 sm:gap-6 items-start group">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${step.bg} border ${step.border}
                                 flex items-center justify-center z-10 relative
                                 group-hover:scale-110 transition-transform duration-200`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div className="flex-1 bg-background-card border border-border rounded-xl p-5
                                hover:border-primary/20 transition-colors duration-200">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs font-bold text-text-tertiary bg-background-elevated px-2 py-0.5 rounded">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-text-primary font-semibold text-base mb-1.5">{step.title}</h3>
                  <p className="text-text-tertiary text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Crypto spec ── */}
      <section className="bg-background-card/40 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-xl font-display font-bold text-text-primary mb-6 text-center">Cryptography Spec</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "File Encryption",  value: "AES-GCM-256",    sub: "Random IV per chunk" },
              { label: "Key Agreement",    value: "ECDH P-256",     sub: "Ephemeral pair per transfer" },
              { label: "Key Wrapping",     value: "Web Crypto API", sub: "wrapKey / unwrapKey" },
            ].map(({ label, value, sub }) => (
              <div key={label}
                   className="bg-background-card border border-border rounded-xl p-5
                              hover:border-primary/20 transition-colors">
                <div className="text-text-tertiary text-xs uppercase tracking-wider mb-2">{label}</div>
                <div className="text-text-primary font-mono font-bold text-lg mb-1">{value}</div>
                <div className="text-text-tertiary text-xs">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security guarantees ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-text-primary mb-2 text-center">Security Guarantees</h2>
        <p className="text-text-tertiary text-sm text-center mb-10">What you get out-of-the-box — no configuration required.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GUARANTEES.map((g) => (
            <div key={g.title}
                 className="bg-background-card border border-border rounded-xl p-5
                            hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <g.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-text-primary font-semibold text-sm">{g.title}</span>
              </div>
              <p className="text-text-tertiary text-sm leading-relaxed">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-background-card/40 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-text-primary mb-10 text-center">FAQ</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="bg-background-card border border-border rounded-xl group open:border-primary/20 transition-colors"
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none
                                    text-text-primary font-semibold text-sm select-none hover:text-primary transition-colors">
                  {faq.q}
                  <ArrowRight className="w-4 h-4 text-text-tertiary flex-shrink-0 group-open:rotate-90 transition-transform duration-200" />
                </summary>
                <div className="px-5 pb-5 pt-4 text-text-tertiary text-sm leading-relaxed border-t border-border">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary mb-4">
          Ready to try it?
        </h2>
        <p className="text-text-tertiary mb-8 max-w-md mx-auto">
          No account. No upload. No waiting. Drop your file and share the code.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/?mode=send#transfer"
            className="w-full sm:w-auto bg-primary text-background font-bold px-8 py-3 rounded-lg
                       hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Send a File
          </Link>
          <Link
            href="/?mode=receive#transfer"
            className="w-full sm:w-auto bg-background-card text-text-primary font-semibold px-8 py-3 rounded-lg
                       border border-border hover:border-primary/50 transition-colors
                       flex items-center justify-center gap-2"
          >
            ↓ Receive a File
          </Link>
        </div>
      </section>
    </div>
  );
}
