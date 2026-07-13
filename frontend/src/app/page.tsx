"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopNav }       from "@/components/TopNav";
import { SeoContent }   from "@/components/SeoContent";
import Link from "next/link";
import { Users, ShieldCheck, Zap, ArrowRight, ArrowUpRight, Activity, ChevronDown } from "lucide-react";
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
      q: "What is the maximum file size limit on Share2Me?",
      a: "There are absolutely no file size limits. Because P2P transfers are established directly between browser clients via WebRTC, data never passes through or stores on any cloud server."
    },
    {
      q: "Is my data secure during file and text transfer?",
      a: "Yes, 100% secure. All transfers are end-to-end encrypted using AES-GCM-256. The encryption key is derived locally via ephemeral ECDH (P-256) key exchange, meaning the key never leaves your browser."
    },
    {
      q: "Do both devices need to be online to complete a transfer?",
      a: "For Person-to-Person (P2P), yes, because it uses a direct WebRTC tunnel. For Group-to-Person (G2P), senders can upload files to your claimed dashboard even if you are temporarily offline."
    },
    {
      q: "Can I transfer files between different operating systems?",
      a: "Absolutely. Share2Me is entirely browser-native. It works between iOS, Android, macOS, Windows, and Linux, without requiring any app installations."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] flex flex-col justify-between overflow-x-hidden font-sans">
      <div>
        <TopNav />
        
        {/* 1. Hero Section (Binance Style) */}
        <section className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            {/* Left: Text & Actions */}
            <div className="w-full lg:w-[50%] space-y-6 text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-[#ffffff]">
                Send, receive, and hold files on <span className="text-[#fcd535]">Share2Me</span>
              </h1>
              <p className="text-[#848e9c] text-sm sm:text-base leading-relaxed max-w-lg">
                The world&apos;s leading secure peer-to-peer file transfer system. End-to-end client-side encryption, zero cloud limits, and zero storage caps.
              </p>

              {/* Quick Actions Portal Block (Email/Google style registration cards in Binance) */}
              <div className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row gap-3 max-w-[480px]">
                  <Link
                    href="/p2p"
                    className="flex-1 bg-[#fcd535] text-[#0b0e11] hover:bg-[#fcd535]/90 font-bold py-3.5 px-6 rounded-lg text-sm text-center transition-all flex items-center justify-center gap-2"
                  >
                    <span>Start Direct P2P</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  
                  <Link
                    href="/g2p"
                    className="flex-1 bg-[#1e2329] border border-[#2f3336] text-[#eaecef] hover:bg-[#20232a] hover:border-[#848e9c]/30 font-bold py-3.5 px-6 rounded-lg text-sm text-center transition-all flex items-center justify-center gap-2"
                  >
                    <span>Create G2P Portal</span>
                    <ArrowUpRight className="w-4 h-4 text-[#848e9c]" />
                  </Link>
                </div>

                {/* Senders quick share code gateway */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget.elements.namedItem("heroShareCode") as HTMLInputElement;
                    const code = target.value.trim();
                    if (code) router.push(`/g2p/${code.toUpperCase()}`);
                  }}
                  className="flex bg-[#1e2329] border border-[#2f3336] focus-within:border-[#fcd535]/50 rounded-lg p-1 max-w-[480px] transition-colors"
                >
                  <input
                    type="text"
                    name="heroShareCode"
                    placeholder="Enter Share Code (e.g. STY392)"
                    className="bg-transparent border-none text-xs sm:text-sm text-[#eaecef] placeholder-[#707a8a] pl-3 py-2 focus:outline-none w-full uppercase font-mono tracking-wider"
                  />
                  <button
                    type="submit"
                    className="bg-[#fcd535] text-[#0b0e11] hover:bg-[#fcd535]/90 font-bold text-xs px-5 py-2 rounded-md transition-all shrink-0"
                  >
                    Send Files
                  </button>
                </form>
              </div>

              {/* Trust highlights */}
              <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-[#848e9c]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-status-success" />
                  <span>AES-GCM-256 Encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#fcd535]" />
                  <span>Direct WebRTC Stream</span>
                </div>
              </div>
            </div>

            {/* Right: Binance Feature Card Mockups */}
            <div className="w-full lg:w-[50%] flex justify-center">
              <div className="w-full max-w-[480px] bg-[#181a20] border border-[#2f3336] rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-[#2f3336] pb-4">
                  <span className="text-xs font-bold text-[#848e9c] uppercase font-mono">Real-time Node Activity</span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-status-success/15 border border-status-success/20 text-[10px] text-status-success font-extrabold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                    Online
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-[#0b0e11] border border-[#2f3336] rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs">P2P</div>
                      <div>
                        <h4 className="text-xs font-bold text-[#eaecef]">Direct Peer Stream</h4>
                        <p className="text-[10px] text-[#848e9c]">Browser-to-browser tunnel</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-primary">No limits</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#0b0e11] border border-[#2f3336] rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#B967FF]/10 border border-[#B967FF]/20 flex items-center justify-center font-bold text-[#B967FF] text-xs">G2P</div>
                      <div>
                        <h4 className="text-xs font-bold text-[#eaecef]">Deposit Portal Hub</h4>
                        <p className="text-[10px] text-[#848e9c]">Permanent sharing codes</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#B967FF]">Dashboard</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 2. live protocol ticker (Markets Price Table in Binance) */}
        <section className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="border-t border-[#2f3336] pt-12 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#ffffff]">Protocol Network Markets</h2>
                <p className="text-xs text-[#848e9c] mt-0.5">Real-time status indexes and encryption structures.</p>
              </div>
            </div>

            <div className="overflow-x-auto bg-[#181a20] border border-[#2f3336] rounded-xl">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#2f3336] text-[10px] font-mono text-[#848e9c] tracking-wider uppercase bg-[#0b0e11]/30">
                    <th className="px-6 py-4">System Protocol</th>
                    <th className="px-6 py-4">Encryption Type</th>
                    <th className="px-6 py-4">Bandwidth / Limits</th>
                    <th className="px-6 py-4">Status Index</th>
                    <th className="px-6 py-4 text-right">Action Link</th>
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-[#2f3336]/60 text-xs">
                  {/* P2P Row */}
                  <tr className="hover:bg-[#20232a]/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#ffffff]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-center font-mono font-bold text-primary">P2P</div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary">P2P Direct Stream</span>
                          <span className="text-[9px] text-[#848e9c]">WebRTC Peer Connect</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[#eaecef]">AES-GCM-256</td>
                    <td className="px-6 py-4 font-mono text-[#eaecef]">Unlimited (Direct)</td>
                    <td className="px-6 py-4">
                      <span className="text-status-success font-bold flex items-center gap-1.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                        OPTIMIZED
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href="/p2p" className="text-primary hover:text-primary/80 font-bold flex items-center justify-end gap-1">
                        <span>Trade P2P</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>

                  {/* G2P Row */}
                  <tr className="hover:bg-[#20232a]/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#ffffff]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-[#B967FF]/10 border border-[#B967FF]/20 rounded-md flex items-center justify-center font-mono font-bold text-[#B967FF]">G2P</div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary">G2P Portal Hub</span>
                          <span className="text-[9px] text-[#848e9c]">Permanent Upload link</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[#eaecef]">ECDH P-256 Key Sync</td>
                    <td className="px-6 py-4 font-mono text-[#eaecef]">Unlimited (Portal)</td>
                    <td className="px-6 py-4">
                      <span className="text-status-success font-bold flex items-center gap-1.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                        ACTIVE
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href="/g2p" className="text-primary hover:text-primary/80 font-bold flex items-center justify-end gap-1">
                        <span>Open Portal</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>

                  {/* Signal Node Row */}
                  <tr className="hover:bg-[#20232a]/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#ffffff]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-center font-mono font-bold text-primary">SIG</div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary">WebRTC Signaling Server</span>
                          <span className="text-[9px] text-[#848e9c]">Metadata broker node</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[#eaecef]">WSS / HTTPS TLS 1.3</td>
                    <td className="px-6 py-4 font-mono text-[#eaecef]">Rate Limited (100 MB/s)</td>
                    <td className="px-6 py-4">
                      <span className="text-status-success font-bold flex items-center gap-1.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                        STABLE
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-[#848e9c] font-mono">
                      Online
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3. Binance Features Showcase Grid */}
        <section className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#ffffff]">Designed for secure asset transfers</h2>
              <p className="text-xs sm:text-sm text-[#848e9c] max-w-lg mx-auto">
                Share2Me uses state of the art web security standards to protect your payloads.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              
              {/* Feature 1 */}
              <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-[#ffffff]">End-to-End Cryptography</h3>
                <p className="text-xs text-[#848e9c] leading-relaxed">
                  Keys are generated inside ephemeral sessionStorage and never uploaded to our node. Encryption happens entirely inside client-side JS.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-[#ffffff]">Real-time Speed</h3>
                <p className="text-xs text-[#848e9c] leading-relaxed">
                  WebRTC tunnels create direct peer-to-peer data pipes. File transfers run at the maximum bandwidth speed of your local ISP.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-[#ffffff]">No Account Required</h3>
                <p className="text-xs text-[#848e9c] leading-relaxed">
                  Senders upload files to P2P rooms or G2P portals instantly without creating profiles, keeping transactions fully private.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* 4. FAQ / Accordion Section (Binance Help style) */}
        <section className="w-full max-w-[800px] mx-auto px-4 sm:px-6 py-16">
          <div className="space-y-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#ffffff] flex items-center justify-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Frequently Asked Questions
            </h2>

            <div className="bg-[#181a20] border border-[#2f3336] rounded-xl divide-y divide-[#2f3336]">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="w-full text-left">
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-xs sm:text-sm font-bold text-[#eaecef] hover:text-[#fcd535] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#848e9c] transition-transform ${activeFaq === idx ? "rotate-180" : ""}`} />
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
                        <p className="px-5 pb-5 text-xs text-[#848e9c] leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SeoContent />
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-[#2f3336] bg-[#0b0e11] py-12">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
              <span className="text-[#ffffff] font-display font-bold">Share2Me</span>
            </div>
            
            <div className="text-[13px] text-[#848e9c]">
              © 2026 Share2Me. All rights reserved.
            </div>

            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[13px] text-[#848e9c] hover:text-[#ffffff] transition-colors">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-[#848e9c] hover:text-[#ffffff] transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0e11]" />}>
      <HomeContent />
    </Suspense>
  );
}
