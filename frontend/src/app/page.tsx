"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopNav }       from "@/components/TopNav";
import { SeoContent }   from "@/components/SeoContent";
import Link from "next/link";
import { ArrowRight, Lock, Zap, HardDrive, Shield, Globe, ChevronDown } from "lucide-react";
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
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-between font-sans selection:bg-primary/20">
      <div>
        <TopNav />
        
        {/* 1. Hero Section */}
        <section className="w-full max-w-6xl mx-auto px-6 pt-24 pb-20 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none opacity-60" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center text-center space-y-8 relative z-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              Share2Me Version 3.0 is live
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.1] text-text-primary max-w-4xl">
              Secure file sharing, <br />
              <span className="text-text-tertiary">without the limits.</span>
            </h1>
            
            <p className="text-text-secondary text-lg sm:text-xl max-w-2xl leading-relaxed">
              Transfer unlimited files directly between devices, or create a permanent portal to receive files from anyone. End-to-end encrypted and completely free.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 w-full justify-center max-w-md mx-auto">
              <Link
                href="/p2p"
                className="w-full sm:w-auto bg-primary text-background hover:bg-primary-hover font-medium py-3.5 px-8 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-glow hover:shadow-glow-active"
              >
                <span>Send via Direct P2P</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              
              <Link
                href="/g2p"
                className="w-full sm:w-auto bg-background-elevated border border-border text-text-primary hover:bg-background-card hover:border-border-hover font-medium py-3.5 px-8 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Create Receive Portal</span>
              </Link>
            </div>

            <div className="pt-8 w-full max-w-md mx-auto">
              <p className="text-xs text-text-tertiary mb-3 font-medium uppercase tracking-widest">Have a Share Code?</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem("heroShareCode") as HTMLInputElement;
                  const code = target.value.trim();
                  if (code) router.push(`/g2p/${code.toUpperCase()}`);
                }}
                className="flex bg-background-elevated border border-border focus-within:border-primary/50 focus-within:bg-background-card rounded-xl p-1.5 transition-all shadow-sm"
              >
                <input
                  type="text"
                  name="heroShareCode"
                  placeholder="Enter 6-digit code"
                  className="bg-transparent border-none text-sm text-text-primary placeholder-text-tertiary pl-4 py-2 focus:outline-none w-full uppercase tracking-wider"
                />
                <button
                  type="submit"
                  className="bg-primary/20 text-primary hover:bg-primary/30 font-bold text-sm px-6 py-2 rounded-lg transition-all shrink-0"
                >
                  Enter
                </button>
              </form>
            </div>
          </motion.div>
        </section>

        {/* 2. Mode Comparison */}
        <section className="w-full bg-background-secondary border-y border-border py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-semibold text-text-primary mb-4">Two ways to share</h2>
              <p className="text-text-tertiary">Choose the mode that fits your workflow.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* P2P Card */}
              <div className="bg-background-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">Direct P2P Transfer</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-8">
                  A direct WebRTC tunnel between two browsers. Files stream securely without ever touching a server. Perfect for sending massive files instantly.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <CheckCircle /> No file size limits
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <CheckCircle /> Both users must be online
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <CheckCircle /> Zero server storage
                  </li>
                </ul>
                <Link href="/p2p" className="text-primary text-sm font-medium hover:text-primary-hover flex items-center gap-2 group-hover:gap-3 transition-all">
                  Start Direct Transfer <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* G2P Card */}
              <div className="bg-background-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                  <HardDrive className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">Permanent Receive Portal</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-8">
                  Claim a personal Share Code and QR. Anyone can upload files to your secure dashboard, even while you are offline.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <CheckCircle /> Receive from multiple people
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <CheckCircle /> You can be offline
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <CheckCircle /> Files are stored securely
                  </li>
                </ul>
                <Link href="/g2p" className="text-primary text-sm font-medium hover:text-primary-hover flex items-center gap-2 group-hover:gap-3 transition-all">
                  Create Your Portal <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Features Grid */}
        <section className="w-full max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-background-elevated border border-border rounded-2xl p-8 hover:border-border-hover transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">End-to-End Encrypted</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                We use AES-GCM-256 to encrypt your payloads before they ever leave your device.
              </p>
            </div>
            <div className="bg-background-elevated border border-border rounded-2xl p-8 hover:border-border-hover transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Browser Native</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                No apps or extensions required. Share2Me uses modern web APIs to run directly in your browser.
              </p>
            </div>
            <div className="bg-background-elevated border border-border rounded-2xl p-8 hover:border-border-hover transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Privacy First</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                We don't track your data. P2P transfers are completely anonymous and untraceable.
              </p>
            </div>
          </div>
        </section>

        {/* 4. FAQ */}
        <section className="w-full max-w-3xl mx-auto px-6 py-16 mb-12">
          <h2 className="text-2xl font-semibold text-center text-text-primary mb-10">Frequently Asked Questions</h2>
          <div className="divide-y divide-border border-y border-border">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="w-full">
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full py-5 flex items-center justify-between text-sm font-medium text-text-primary hover:text-primary transition-colors text-left"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${activeFaq === idx ? "rotate-180" : ""}`} />
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
                      <p className="pb-5 text-sm text-text-secondary leading-relaxed">
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

      <footer className="w-full border-t border-border bg-background py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-text-primary font-semibold">Share2Me</span>
          </div>
          <div className="text-xs text-text-tertiary">
            © 2026 Share2Me. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-text-tertiary hover:text-text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-text-tertiary hover:text-text-primary transition-colors">Terms</Link>
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
