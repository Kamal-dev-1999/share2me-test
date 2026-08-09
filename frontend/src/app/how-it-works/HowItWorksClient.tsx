"use client";
import Link from "next/link";
import {
  Upload, QrCode, Wifi, Lock, ShieldCheck,
  Server, Eye, Key, Zap, ArrowRight, Monitor, Smartphone,
} from "lucide-react";
import { motion } from "framer-motion";

// ── Steps data ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Upload,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", shadow: "shadow-[0_0_15px_rgba(255,204,0,0.15)]",
    title: "Drop your file",
    desc: "Select any file. It stays entirely on your device — nothing is uploaded at this point.",
  },
  {
    icon: Key,
    color: "text-accent-turquoise", bg: "bg-accent-turquoise/10", border: "border-accent-turquoise/20", shadow: "shadow-[0_0_15px_rgba(45,212,191,0.15)]",
    title: "Local AES-GCM-256 encryption",
    desc: "A random 256-bit key is generated in your browser. The file is split into chunks; each is encrypted with a unique IV.",
  },
  {
    icon: QrCode,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", shadow: "shadow-[0_0_15px_rgba(255,204,0,0.15)]",
    title: "Share OTC or QR code",
    desc: "A 6-digit one-time code and QR code are generated from file metadata. Share verbally or let the receiver scan.",
  },
  {
    icon: Lock,
    color: "text-status-success", bg: "bg-status-success/10", border: "border-status-success/20", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    title: "ECDH key exchange",
    desc: "The receiver generates an ephemeral P-256 key pair and sends the public key. The sender wraps the AES key — the raw key never leaves either device.",
  },
  {
    icon: Wifi,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", shadow: "shadow-[0_0_15px_rgba(255,204,0,0.15)]",
    title: "WebRTC P2P tunnel",
    desc: "A direct RTCDataChannel is established. The signaling server is only used for the WebRTC handshake — it never sees your file or keys.",
  },
  {
    icon: ShieldCheck,
    color: "text-status-success", bg: "bg-status-success/10", border: "border-status-success/20", shadow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
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
  {
    q: "What is the maximum file size limit on Share2Me?",
    a: "There are absolutely no file size limits on Share2Me. Because the transfer is established directly peer-to-peer (P2P) between the sender and receiver browsers via WebRTC, the data does not pass through or store on any intermediate cloud server."
  },
  {
    q: "Is my data secure when transferring files and text?",
    a: "Yes, completely secure. All transfers are end-to-end encrypted using military-grade AES-GCM-256 encryption. The encryption key is derived locally on your device via ephemeral ECDH (P-256) key exchange, meaning the raw key never leaves your browser and cannot be read by anyone, including the signaling server."
  },
  {
    q: "Do both devices need to be online at the same time?",
    a: "Yes. Because Share2Me uses direct WebRTC peer-to-peer tunnels to transfer data, both the sending device and the receiving device must have the page open and be online concurrently to perform the transfer."
  },
  {
    q: "Can I transfer files between different operating systems?",
    a: "Absolutely. Share2Me is entirely browser-native and cross-platform. It works seamlessly between iOS, Android, macOS, Windows, Linux, and any other operating system running a modern web browser, without needing any software installations."
  },
  {
    q: "Can I send clipboard text and messages securely?",
    a: "Yes. Share2Me offers a dedicated Text Transfer mode. Copy-paste any text, passwords, or code snippets, and it will be encrypted and streamed securely through the same WebRTC pipeline, complete with a convenient 'Copy All' button for the receiver."
  },
  {
    q: "What if the transfer fails halfway?",
    a: "Share2Me uses a built-in NACK (Negative Acknowledgement) chunk retry algorithm. If a chunk is lost in transit due to network jitter, the receiver's browser automatically requests just the missing sequence numbers from the sender, recovering the transfer automatically without starting over."
  },
  {
    q: "Can I self-host Share2Me?",
    a: "Yes. The codebase is designed to be easily self-hosted. The backend is built using standard Node.js, Express, and Socket.io, and works perfectly in a single container or in clustered environments via the integrated Redis adapter configuration."
  }
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
            <div className="bg-background-card/80 backdrop-blur-md border border-primary/30 rounded-3xl p-5 w-full text-center
                            shadow-[0_8px_30px_rgba(252,213,53,0.08)]">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,204,0,0.15)]">
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
                  <div key={i} className="flex items-center gap-2 bg-background-elevated rounded-xl px-3 py-2 border border-border/50">
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
              <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent" />
              <div className="flex flex-col items-center mx-2">
                <div className="bg-background-elevated/80 backdrop-blur-sm border border-border rounded-lg px-2 py-1 mb-1 shadow-sm">
                  <span className="text-[11px] text-text-secondary font-mono tracking-wider">OTC / QR</span>
                </div>
                <svg width="20" height="12" viewBox="0 0 20 12" className="text-text-tertiary">
                  <path d="M10 12 L0 0 L20 0 Z" fill="currentColor" opacity="0.4" />
                </svg>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-primary/50 to-transparent" />
            </div>

            {/* Signaling box */}
            <div className="bg-background-elevated/80 backdrop-blur-md border border-border rounded-3xl p-5 w-full text-center shadow-lg">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 bg-background-card rounded-xl flex items-center justify-center border border-border">
                  <Server className="w-5 h-5 text-text-tertiary" />
                </div>
              </div>
              <div className="text-text-primary font-bold text-sm mb-1">Signaling Server</div>
              <div className="text-xs text-text-tertiary/80 leading-relaxed">
                WebRTC handshake only.<br />Never sees your file.
              </div>
              <div className="mt-3 bg-background-card border border-border/50 rounded-xl px-2 py-2">
                <span className="text-[11px] text-text-secondary font-mono">offer / answer / ICE</span>
              </div>
            </div>

            {/* ECDH key exchange arrow up from receiver side */}
            <div className="flex items-center w-full mt-3">
              <div className="flex-1 h-px bg-gradient-to-r from-status-success/50 to-transparent" />
              <div className="flex flex-col items-center mx-2">
                <svg width="20" height="12" viewBox="0 0 20 12" className="text-status-success rotate-180 mb-1">
                  <path d="M10 12 L0 0 L20 0 Z" fill="currentColor" opacity="0.4" />
                </svg>
                <div className="bg-background-elevated/80 backdrop-blur-sm border border-status-success/30 rounded-lg px-2 py-1 shadow-sm">
                  <span className="text-[11px] text-status-success font-mono tracking-wider">ECDH keys</span>
                </div>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-status-success/50 to-transparent" />
            </div>
          </div>

          {/* RECEIVER */}
          <div className="flex flex-col items-center">
            <div className="bg-background-card/80 backdrop-blur-md border border-status-success/30 rounded-3xl p-5 w-full text-center
                            shadow-[0_8px_30px_rgba(14,203,129,0.08)]">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-status-success/10 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
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
                  <div key={i} className="flex items-center gap-2 bg-background-elevated rounded-xl px-3 py-2 border border-border/50">
                    <span className="text-xs text-text-secondary">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: WebRTC P2P data channel arrow ── */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex-shrink-0 w-full flex flex-col items-center">
            {/* Label */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-[2px] bg-gradient-to-r from-primary via-primary/60 to-status-success
                              relative overflow-visible rounded-full">
                {/* Animated dot */}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary
                                animate-[slide_2.5s_linear_infinite]
                                shadow-[0_0_12px_rgba(252,213,53,0.9)]" />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-status-success
                                animate-[slide_2.5s_linear_infinite_0.8s]
                                shadow-[0_0_12px_rgba(16,185,129,0.9)]" />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 bg-background-elevated/90 backdrop-blur-md border border-border
                            rounded-2xl px-6 py-3 w-fit mx-auto shadow-lg hover:border-primary/40 transition-colors">
              <Wifi className="w-5 h-5 text-primary" />
              <span className="text-text-primary font-bold text-sm tracking-wide">WebRTC P2P DataChannel</span>
              <span className="text-text-tertiary text-xs ml-2 border-l border-border pl-3">— Encrypted chunks only</span>
            </div>
          </div>
        </div>

        {/* Sliding dot keyframe via style tag */}
        <style>{`
          @keyframes slide {
            0%   { left: 0%; opacity: 0; transform: translateY(-50%) scale(0.5); }
            10%  { opacity: 1; transform: translateY(-50%) scale(1); }
            90%  { opacity: 1; transform: translateY(-50%) scale(1); }
            100% { left: 100%; opacity: 0; transform: translateY(-50%) scale(0.5); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function HowItWorksClient() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[-10%] w-[30%] h-[30%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-status-success/10 blur-[120px] pointer-events-none" />


      {/* Hero */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 pt-16 pb-12 sm:pt-24 sm:pb-20 text-center px-4"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 shadow-[0_0_20px_rgba(255,204,0,0.1)] mb-6"
        >
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-[13px] font-bold text-primary tracking-widest uppercase">Under the Hood</span>
        </motion.div>
        
        <h1 className="text-5xl sm:text-6xl font-display font-extrabold text-text-primary tracking-tight mb-6">
          How <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#ffaa00] to-status-success">Share2Me</span> Works
        </h1>
        <p className="text-text-secondary text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
          Every transfer is end-to-end encrypted, peer-to-peer, and completely ephemeral.
          Here&apos;s exactly what happens — from the moment you drop a file to the moment the receiver saves it.
        </p>
      </motion.div>

      {/* ── Flow Diagram ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl font-display font-bold text-text-primary mb-3">Transfer Architecture</h2>
          <p className="text-text-tertiary text-[16px]">The complete flow — sender, signaling, and receiver</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-background-elevated/60 backdrop-blur-xl border border-border rounded-[40px] p-2 sm:p-6 shadow-2xl relative"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-[40px] pointer-events-none" />
          <FlowDiagram />
        </motion.div>
      </section>

      {/* ── Step-by-step ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-display font-bold text-text-primary mb-3">Step-by-Step Breakdown</h2>
          <p className="text-text-tertiary text-[16px]">What happens at each stage of the transfer</p>
        </motion.div>

        <div className="relative">
          {/* Vertical line connector */}
          <div className="absolute left-[27px] top-5 bottom-5 w-[2px] bg-gradient-to-b from-primary/50 via-border to-status-success/50 hidden sm:block rounded-full" />

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-4 sm:gap-8 items-start group"
              >
                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${step.bg} border ${step.border}
                                 flex items-center justify-center z-10 relative bg-background
                                 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${step.shadow}`}>
                  <step.icon className={`w-6 h-6 ${step.color}`} />
                </div>
                <div className="flex-1 bg-background-card/50 backdrop-blur-md border border-border rounded-3xl p-6 sm:p-8
                                hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 shadow-lg group-hover:-translate-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-xs font-bold text-text-primary bg-background-elevated border border-border px-3 py-1 rounded-full shadow-sm">
                      STEP {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-text-primary font-bold text-xl mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-[15px] leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Crypto spec ── */}
      <section className="relative z-10 bg-background-card/20 border-y border-border backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-display font-bold text-text-primary mb-3">Cryptography Spec</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "File Encryption",  value: "AES-GCM-256",    sub: "Random IV per chunk" },
              { label: "Key Agreement",    value: "ECDH P-256",     sub: "Ephemeral pair per transfer" },
              { label: "Key Wrapping",     value: "Web Crypto API", sub: "wrapKey / unwrapKey" },
            ].map(({ label, value, sub }, i) => (
              <motion.div 
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-background-elevated/80 backdrop-blur-xl border border-border rounded-3xl p-8
                           hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 shadow-lg text-center group"
              >
                <div className="text-text-tertiary text-xs font-bold uppercase tracking-widest mb-3">{label}</div>
                <div className="text-text-primary font-mono font-bold text-2xl mb-2 group-hover:text-primary transition-colors">{value}</div>
                <div className="text-text-secondary text-sm">{sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security guarantees ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-display font-bold text-text-primary mb-3">Security Guarantees</h2>
          <p className="text-text-tertiary text-[16px]">What you get out-of-the-box — no configuration required.</p>
        </motion.div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {GUARANTEES.map((g, i) => (
            <motion.div 
              key={g.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-background-card/60 backdrop-blur-xl border border-border rounded-[32px] p-8
                         hover:border-status-success/40 hover:bg-status-success/5 transition-all duration-300 shadow-lg group"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-status-success/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <g.icon className="w-6 h-6 text-status-success" />
                </div>
                <span className="text-text-primary font-bold text-lg leading-tight">{g.title}</span>
              </div>
              <p className="text-text-secondary text-[15px] leading-relaxed">{g.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative z-10 bg-background-elevated/30 border-t border-border mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-display font-bold text-text-primary mb-3">Frequently Asked Questions</h2>
          </motion.div>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <motion.details
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                key={faq.q}
                className="bg-background-card/80 backdrop-blur-xl border border-border rounded-2xl group open:border-primary/40 transition-colors shadow-sm"
              >
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none
                                    text-text-primary font-bold text-[15px] select-none hover:text-primary transition-colors">
                  {faq.q}
                  <ArrowRight className="w-5 h-5 text-text-tertiary flex-shrink-0 group-open:rotate-90 transition-transform duration-300" />
                </summary>
                <div className="px-6 pb-6 pt-2 text-text-secondary text-[15px] leading-relaxed">
                  {faq.a}
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-background-elevated to-background-card border border-border rounded-[40px] p-12 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-4 relative z-10">
            Ready to try it?
          </h2>
          <p className="text-text-secondary text-lg mb-10 max-w-lg mx-auto relative z-10">
            No account. No upload. No waiting. Drop your file and share the code.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 relative z-10">
            <Link
              href="/?mode=send#transfer"
              className="w-full sm:w-auto bg-primary text-background font-bold px-8 py-4 rounded-xl
                         hover:bg-primary-hover transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,204,0,0.3)] hover:shadow-[0_0_30px_rgba(255,204,0,0.5)] hover:-translate-y-1"
            >
              <Upload className="w-5 h-5" />
              Send a File
            </Link>
            <Link
              href="/?mode=receive#transfer"
              className="w-full sm:w-auto bg-background-elevated text-text-primary font-bold px-8 py-4 rounded-xl
                         border border-border hover:border-primary/50 hover:bg-background-card transition-all duration-300
                         flex items-center justify-center gap-2 hover:-translate-y-1 shadow-lg"
            >
              <QrCode className="w-5 h-5" />
              Receive a File
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-12 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
              <span className="text-text-primary font-display font-bold">Share2Me</span>
            </div>
            
            <div className="text-[13px] text-text-tertiary">
              © 2026 Share2Me. All rights reserved.
            </div>

            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
