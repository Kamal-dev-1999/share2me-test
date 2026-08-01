"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopNav }       from "@/components/TopNav";
import { SeoContent }   from "@/components/SeoContent";
import Link from "next/link";
import { ArrowRight, Lock, Zap, HardDrive, Shield, Globe, ChevronDown, FileText, FileImage, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "send" || mode === "receive") {
      router.push(`/p2p?mode=${mode}`);
    }
  }, [searchParams, router]);

  const FAQS = [
    {
      q: "What is the maximum file size limit?",
      a: "There are absolutely no file size limits for Direct (P2P) transfers. Because connections are established directly between browser clients via WebRTC, data never passes through or stores on any cloud server."
    },
    {
      q: "Is my data secure?",
      a: "Yes, 100% secure. All transfers are end-to-end encrypted using AES-GCM-256. The encryption key is derived locally, meaning the key never leaves your browser."
    },
    {
      q: "Do both devices need to be online?",
      a: "For Direct (P2P) transfers, yes. For Permanent Portals (G2P), senders can upload files to your dashboard even if you are offline, and you can download them later."
    },
    {
      q: "Does this work on mobile?",
      a: "Absolutely. Share2Me is entirely browser-native and works seamlessly across iOS, Android, macOS, Windows, and Linux without any app installations."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col justify-between font-sans selection:bg-primary/20">
      <div>
        <TopNav />
        
        {/* 1. Modern Asymmetrical Hero Section */}
        <div className="relative w-full overflow-hidden">
          {/* Background Orb */}
          <div className="absolute top-1/4 left-1/2 w-[800px] lg:w-[1200px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-80 -translate-x-[-10%]" />
          
          <section className="w-full max-w-7xl mx-auto px-6 pt-32 pb-32 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-16 relative">
              {/* Left Column: Typography & CTAs */}
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex-1 flex flex-col items-start text-left space-y-8"
              >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-outline text-xs font-bold text-on-surface shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                Share2Me v3.0 is live
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-bold tracking-tighter leading-[1.05] text-on-surface font-display uppercase">
                File transfer, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#ff9100]">reimagined.</span>
              </h1>
              
              <p className="text-text-secondary text-lg sm:text-xl max-w-xl leading-relaxed font-body">
                Seamlessly tunnel files directly between devices with zero latency, or spin up a permanent cryptographic inbox to receive payloads from anyone.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg pt-4">
                <Link
                  href="/p2p"
                  className="w-full sm:w-auto bg-primary text-on-primary hover:bg-[#ffe170] font-bold py-4 px-8 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <Zap className="w-4 h-4 text-on-primary" />
                  <span>Start P2P Tunnel</span>
                </Link>
                
                <Link
                  href="/g2p"
                  className="w-full sm:w-auto bg-surface-container border border-outline text-on-surface hover:bg-surface-container-high font-bold py-4 px-8 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  <HardDrive className="w-4 h-4 text-primary" />
                  <span>Create Inbox</span>
                </Link>
              </div>

              <div className="pt-8 w-full max-w-lg">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget.elements.namedItem("heroShareCode") as HTMLInputElement;
                    const code = target.value.trim();
                    if (code) router.push(`/g2p/${code.toUpperCase()}`);
                  }}
                  className="flex items-center bg-surface-container border border-outline focus-within:border-primary rounded-2xl p-1.5 transition-all shadow-xl relative"
                >
                  <input
                    suppressHydrationWarning
                    type="text"
                    name="heroShareCode"
                    placeholder="Enter Share Code..."
                    autoComplete="off"
                    className="flex-1 bg-transparent !bg-transparent border-none text-base font-bold text-on-surface placeholder-on-surface-variant px-5 py-3.5 focus:outline-none focus:ring-0 w-full uppercase tracking-widest min-w-0 font-mono"
                  />
                  <button
                    suppressHydrationWarning
                    type="submit"
                    className="bg-primary text-on-primary hover:bg-[#ffe170] font-bold text-sm px-8 py-3.5 rounded-xl transition-all shrink-0 shadow-md"
                  >
                    Connect
                  </button>
                </form>
              </div>
            </motion.div>
            
            {/* Right Column: Visual Showcase */}
            <div className="flex-1 w-full relative h-[500px] hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-[480px] h-full">
                {/* Connecting Secure Tunnel Line */}
                <div className="absolute top-1/2 left-[10%] right-[10%] -translate-y-1/2 h-[2px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 flex items-center justify-center border-t border-dashed border-primary/30">
                  <div className="w-12 h-12 rounded-full bg-background border border-outline flex items-center justify-center z-10 shadow-lg relative">
                    <div className="absolute inset-0 rounded-full border border-status-success animate-ping opacity-20" />
                    <Lock className="w-5 h-5 text-status-success" />
                  </div>
                </div>

                {/* Device 1: Sender (Laptop) */}
                <motion.div 
                  animate={{ y: [-5, 5, -5] }} 
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-0 top-[15%] w-[260px] h-[200px] bg-surface-card border border-outline-variant rounded-2xl shadow-2xl flex flex-col overflow-hidden z-20"
                >
                  <div className="h-8 bg-surface-container border-b border-outline-variant flex items-center px-3 gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <div className="w-2/3 h-3 bg-surface-container rounded-full" />
                    <div className="w-1/2 h-3 bg-surface-container rounded-full" />
                    <div className="mt-auto w-full h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
                      <span className="text-xs text-primary font-bold tracking-wider uppercase font-mono">Sending Data...</span>
                    </div>
                  </div>
                </motion.div>

                {/* Device 2: Receiver (Mobile) */}
                <motion.div 
                  animate={{ y: [5, -5, 5] }} 
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute right-0 bottom-[15%] w-[150px] h-[280px] bg-surface-card border-[6px] border-surface-container rounded-[2rem] shadow-2xl flex flex-col overflow-hidden z-20"
                >
                  <div className="h-4 w-16 bg-surface-container mx-auto rounded-b-xl" />
                  <div className="p-4 flex-1 flex flex-col items-center justify-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative shadow-sm">
                       <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30" />
                       <Download className="w-7 h-7 text-primary relative z-10" />
                    </div>
                    <div className="flex flex-col items-center gap-2 w-full">
                       <div className="w-3/4 h-2 bg-surface-container rounded-full" />
                       <div className="w-1/2 h-2 bg-surface-container rounded-full" />
                    </div>
                  </div>
                </motion.div>

                {/* Animated Payload 1 (Laptop -> Mobile) */}
                <motion.div 
                  animate={{ 
                    x: [0, 220], 
                    y: [0, 120],
                    opacity: [0, 1, 1, 0],
                    scale: [0.8, 1, 1, 0.8],
                    rotate: [0, 15]
                  }} 
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[130px] top-[100px] z-30 w-12 h-14 bg-primary rounded-xl shadow-md flex items-center justify-center border border-white/20"
                >
                  <FileText className="w-6 h-6 text-on-primary" />
                </motion.div>
                
                {/* Animated Payload 2 (Mobile -> Laptop) */}
                <motion.div 
                  animate={{ 
                    x: [0, -220], 
                    y: [0, -120],
                    opacity: [0, 1, 1, 0],
                    scale: [0.8, 1, 1, 0.8],
                    rotate: [0, -15]
                  }} 
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.25 }}
                  className="absolute right-[75px] bottom-[140px] z-30 w-12 h-14 bg-surface-container border border-primary/50 rounded-xl shadow-md flex items-center justify-center"
                >
                  <FileImage className="w-6 h-6 text-primary" />
                </motion.div>
              </div>
            </div>
          </div>
        </section>
        </div>

        {/* 2. Mode Comparison */}
        <section className="w-full bg-surface-container-lowest border-y border-outline-variant py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-on-surface mb-4 font-display uppercase">Two ways to share</h2>
              <p className="text-text-secondary font-body">Choose the mode that fits your workflow.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* P2P Card */}
              <div className="bg-surface-card border border-outline-variant rounded-2xl p-8 hover:border-primary/30 transition-colors shadow-md group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-3 font-display uppercase">Direct P2P Transfer</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-8 font-body">
                  A direct WebRTC tunnel between two browsers. Files stream securely without ever touching a server. Perfect for sending massive files instantly.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-text-secondary font-body">
                    <CheckCircle /> No file size limits
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary font-body">
                    <CheckCircle /> Both users must be online
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary font-body">
                    <CheckCircle /> Zero server storage
                  </li>
                </ul>
                <Link href="/p2p" className="text-primary text-sm font-bold hover:text-primary-hover flex items-center gap-2 group-hover:gap-3 transition-all">
                  Start Direct Transfer <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* G2P Card */}
              <div className="bg-surface-card border border-outline-variant rounded-2xl p-8 hover:border-primary/30 transition-colors shadow-md group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                  <HardDrive className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-3 font-display uppercase">Permanent Receive Portal</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-8 font-body">
                  Claim a personal Share Code and QR. Anyone can upload files to your secure dashboard, even while you are offline.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-text-secondary font-body">
                    <CheckCircle /> Receive from multiple people
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary font-body">
                    <CheckCircle /> You can be offline
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary font-body">
                    <CheckCircle /> Files are stored securely
                  </li>
                </ul>
                <Link href="/g2p" className="text-primary text-sm font-bold hover:text-primary-hover flex items-center gap-2 group-hover:gap-3 transition-all">
                  Create Your Portal <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Features Grid */}
        <section className="w-full max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-card border border-outline-variant rounded-2xl p-8 hover:border-primary/30 transition-colors shadow-md">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2 font-display uppercase">End-to-End Encrypted</h3>
              <p className="text-sm text-text-secondary leading-relaxed font-body">
                We use AES-GCM-256 to encrypt your payloads before they ever leave your device.
              </p>
            </div>
            <div className="bg-surface-card border border-outline-variant rounded-2xl p-8 hover:border-primary/30 transition-colors shadow-md">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2 font-display uppercase">Browser Native</h3>
              <p className="text-sm text-text-secondary leading-relaxed font-body">
                No apps or extensions required. Share2Me uses modern web APIs to run directly in your browser.
              </p>
            </div>
            <div className="bg-surface-card border border-outline-variant rounded-2xl p-8 hover:border-primary/30 transition-colors shadow-md">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2 font-display uppercase">Privacy First</h3>
              <p className="text-sm text-text-secondary leading-relaxed font-body">
                We don&apos;t track your data. P2P transfers are completely anonymous and untraceable.
              </p>
            </div>
          </div>
        </section>

        {/* 4. FAQ */}
        <section className="w-full max-w-3xl mx-auto px-6 py-16 mb-12">
          <h2 className="text-2xl font-bold text-center text-on-surface mb-10 font-display uppercase">Frequently Asked Questions</h2>
          <div className="divide-y divide-outline-variant border-y border-outline-variant">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="w-full">
                <button
                  suppressHydrationWarning
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full py-5 flex items-center justify-between text-sm font-bold text-on-surface hover:text-primary transition-colors text-left"
                >
                  <span className="font-display">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${activeFaq === idx ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm text-text-secondary leading-relaxed font-body">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        <SeoContent />
      </div>

      <footer className="w-full border-t border-outline-variant bg-surface-card py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-on-surface font-bold font-display uppercase">Share2Me</span>
          </div>
          <div className="text-xs text-text-secondary font-mono">
            © 2026 Share2Me. All rights reserved.
          </div>
          <div className="flex items-center gap-6 font-mono text-xs">
            <Link href="/privacy" className="text-text-secondary hover:text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="text-text-secondary hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckCircle() {
  return (
    <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}
