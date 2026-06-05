"use client";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import {
  Upload, QrCode, Wifi, Lock, ShieldCheck,
  Server, Eye, Key, Zap, ArrowRight,
} from "lucide-react";

// ── Step-by-step flow ──────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Upload,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    title: "Drop or select your file",
    desc: "Drag your file into the sender workspace. It stays entirely on your device at this point — nothing is uploaded anywhere.",
  },
  {
    icon: Key,
    color: "text-accent-turquoise",
    bg: "bg-accent-turquoise/10",
    border: "border-accent-turquoise/20",
    title: "AES key generated locally",
    desc: "A cryptographically random 256-bit AES-GCM key is generated in your browser. The file is chunked and each chunk is encrypted with this key.",
  },
  {
    icon: QrCode,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    title: "Share the OTC or QR code",
    desc: "A One-Time Code and QR code are generated containing file metadata (not the key). Share the 6-digit code verbally or let the receiver scan the QR.",
  },
  {
    icon: Lock,
    color: "text-trading-up",
    bg: "bg-trading-up/10",
    border: "border-trading-up/20",
    title: "ECDH key exchange",
    desc: "The receiver generates an ephemeral ECDH key pair. The sender wraps the AES key using the receiver's public key. The raw AES key is never transmitted — only the wrapped form.",
  },
  {
    icon: Wifi,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    title: "WebRTC peer-to-peer tunnel",
    desc: "A direct RTCDataChannel is established between the two browsers via WebRTC. The signaling server is only used for the handshake — it never sees your file or keys.",
  },
  {
    icon: ShieldCheck,
    color: "text-trading-up",
    bg: "bg-trading-up/10",
    border: "border-trading-up/20",
    title: "Encrypted chunks flow P2P",
    desc: "Encrypted chunks stream directly from sender to receiver. Each chunk is individually decrypted by the receiver using the unwrapped AES key. Missing chunks are automatically re-requested.",
  },
];

// ── Security guarantees ────────────────────────────────────────────────────
const GUARANTEES = [
  {
    icon: Server,
    title: "Zero server storage",
    desc: "No file, chunk, or key ever passes through or is stored on our servers. The signaling server only relays WebRTC offer/answer/ICE messages.",
  },
  {
    icon: Eye,
    title: "No one can intercept",
    desc: "Even if someone captured every packet on the network, they'd see only AES-GCM-256 encrypted ciphertext with random IVs per chunk.",
  },
  {
    icon: Key,
    title: "Forward secrecy",
    desc: "Each transfer uses a freshly generated AES key and ECDH key pair. There are no long-lived secrets to steal or rotate.",
  },
  {
    icon: Zap,
    title: "No plugins or installs",
    desc: "Everything runs in your browser using Web Crypto API and WebRTC — both built into every modern browser. Nothing to install.",
  },
];

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is the maximum file size?",
    a: "There is no hard limit imposed by ShareIt. Practical limits depend on your browser's available memory and your network speed. Files above 1 GB may take longer to encrypt.",
  },
  {
    q: "Do both devices need to be online at the same time?",
    a: "Yes. WebRTC is a live peer-to-peer connection. Both the sender and receiver need to be on the page simultaneously for the transfer to complete.",
  },
  {
    q: "What happens if the transfer fails halfway?",
    a: "ShareIt uses a NACK (Negative Acknowledgement) retry protocol. If the receiver detects missing chunks after the sender signals done, it sends a NACK and the sender re-transmits only the missing chunks.",
  },
  {
    q: "Is the signaling server trustworthy?",
    a: "You don't need to trust it. The signaling server only sees encrypted WebRTC handshake messages and the 6-digit OTC. It never sees your file, your AES key, or any plaintext data.",
  },
  {
    q: "Can I self-host ShareIt?",
    a: "Yes. The backend is a single Node.js file (server.js) and the frontend is a Next.js app. Clone the repo and run npm install in both directories.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-canvas-dark">
      <TopNav />

      {/* Hero */}
      <div className="border-b border-hairline-dark bg-surface-cardDark/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            Under the Hood
          </p>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight mb-5">
            How ShareIt Works
          </h1>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Every transfer is end-to-end encrypted, peer-to-peer, and ephemeral.
            Here&apos;s exactly what happens from the moment you drop a file to the moment the receiver saves it.
          </p>
        </div>
      </div>

      {/* Step-by-step */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-10 text-center">
          Transfer Flow
        </h2>
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-5 top-10 bottom-10 w-px bg-hairline-dark hidden sm:block" />

          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-5 sm:gap-6 items-start group">
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${step.bg} border ${step.border}
                                 flex items-center justify-center z-10 relative
                                 group-hover:scale-105 transition-transform`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                {/* Content */}
                <div className="flex-1 bg-surface-cardDark border border-hairline-dark rounded-xl p-5
                                hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs font-bold text-muted">STEP {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="text-white font-semibold text-base mb-2">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security guarantees */}
      <section className="bg-surface-cardDark/40 border-y border-hairline-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2 text-center">
            Security Guarantees
          </h2>
          <p className="text-muted text-sm text-center mb-10">
            What you get out of the box — no configuration required.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {GUARANTEES.map((g) => (
              <div key={g.title}
                   className="bg-surface-cardDark border border-hairline-dark rounded-xl p-5
                              hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <g.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-white font-semibold text-sm">{g.title}</span>
                </div>
                <p className="text-muted text-sm leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Crypto spec callout */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="bg-surface-cardDark border border-primary/20 rounded-xl p-6 sm:p-8">
          <h2 className="text-white font-display font-bold text-lg mb-6">Cryptography Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "File Encryption",      value: "AES-GCM-256",  sub: "Random IV per chunk" },
              { label: "Key Agreement",         value: "ECDH P-256",   sub: "Ephemeral key pair per transfer" },
              { label: "Key Wrapping",          value: "Web Crypto API", sub: "wrapKey / unwrapKey" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="border-l-2 border-primary/30 pl-4">
                <div className="text-muted text-xs uppercase tracking-wider mb-1">{label}</div>
                <div className="text-white font-mono font-bold text-base">{value}</div>
                <div className="text-muted text-xs mt-1">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface-cardDark/40 border-t border-hairline-dark">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-10 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="bg-surface-cardDark border border-hairline-dark rounded-xl
                           group open:border-primary/30 transition-colors"
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none
                                    text-white font-semibold text-sm select-none
                                    hover:text-primary transition-colors">
                  {faq.q}
                  <ArrowRight className="w-4 h-4 text-muted flex-shrink-0
                                         group-open:rotate-90 transition-transform duration-200" />
                </summary>
                <div className="px-5 pb-5 text-muted text-sm leading-relaxed border-t border-hairline-dark pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-4">
          Ready to send a file?
        </h2>
        <p className="text-muted mb-8 max-w-md mx-auto">
          No account. No upload. No waiting. Just drop your file and share the code.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/send"
            className="w-full sm:w-auto bg-primary text-ink font-bold px-8 py-3 rounded-lg
                       hover:bg-primary-active transition-colors flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Send a File
          </Link>
          <Link
            href="/#transfer"
            className="w-full sm:w-auto bg-surface-cardDark text-white font-semibold px-8 py-3 rounded-lg
                       border border-hairline-dark hover:border-primary/50 transition-colors
                       flex items-center justify-center gap-2"
          >
            ↓ Receive a File
          </Link>
        </div>
      </section>
    </div>
  );
}
