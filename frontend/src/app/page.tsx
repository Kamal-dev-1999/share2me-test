"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SeoContent } from "@/components/SeoContent";
import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Zap,
  HardDrive,
  Shield,
  Globe,
  ChevronDown,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileType2,
  Download,
  Upload,
} from "lucide-react";

// Two-lane bidirectional transport between the laptop (top-left) and phone
// (bottom-right). TOP lane carries files LAPTOP → PHONE; BOTTOM lane carries
// files PHONE → LAPTOP. Files alternate lanes in a sequential loop so exactly
// one card is visible at a time.
const TOP_LANE = {
  start: { x: 240, y: 120 }, // laptop's upper-right area
  end:   { x: 330, y: 200 }, // phone's top-left area
};
const BOTTOM_LANE = {
  start: { x: 330, y: 320 }, // phone's lower-left area
  end:   { x: 240, y: 200 }, // laptop's lower-right area
};

// dir "down" = TOP lane (laptop → phone). dir "up" = BOTTOM lane (phone → laptop).
const FILE_STREAM = [
  { label: "PDF", icon: FileText,        bg: "bg-signal-yellow", dir: "down" },
  { label: "DOC", icon: FileType2,       bg: "bg-surface",       dir: "up"   },
  { label: "XLS", icon: FileSpreadsheet, bg: "bg-signal-yellow", dir: "down" },
  { label: "JPG", icon: FileImage,       bg: "bg-surface",       dir: "up"   },
] as const;

// Timing: each card takes CARD_DURATION seconds to cross, and the whole
// sequence repeats every CARD_DURATION × FILE_STREAM.length. Cards are
// staggered by CARD_DURATION so they never overlap on screen.
const CARD_DURATION = 2;
const CYCLE_LENGTH  = CARD_DURATION * 4;
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
      a: "There are absolutely no file size limits for Direct (P2P) transfers. Connections are established directly between browser clients via WebRTC, so data never touches a cloud server.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. All transfers are end-to-end encrypted using AES-GCM-256. The encryption key is derived locally, so it never leaves your browser.",
    },
    {
      q: "Do both devices need to be online?",
      a: "For Direct (P2P) transfers, yes. For Permanent Portals (G2P), senders can upload files to your dashboard even while you are offline.",
    },
    {
      q: "Does this work on mobile?",
      a: "Absolutely. Share2Me is browser-native and works seamlessly across iOS, Android, macOS, Windows, and Linux — no app installs.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body">
      <TopNav />

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="relative w-full border-b-2 border-ink">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 py-16 md:py-24 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Left column — typography + CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="lg:col-span-7 flex flex-col gap-8"
            >
              {/* Status badge */}
              <div className="inline-flex items-center gap-2 self-start bg-surface border-2 border-ink rounded-md px-3 py-1.5 shadow-hard-sm">
                <span className="flex h-2.5 w-2.5 rounded-full bg-signal-yellow border border-ink" />
                <span className="label-caps text-ink">Share2Me v3.0 · Live</span>
              </div>

              {/* Headline */}
              <h1 className="font-display font-bold uppercase leading-[0.95] tracking-tight text-ink text-[48px] sm:text-[64px] md:text-[80px] lg:text-[96px]">
                File transfer,
                <br />
                <span className="inline-block bg-signal-yellow text-ink px-2 -mx-1 border-2 border-ink rounded-md">
                  reimagined.
                </span>
              </h1>

              <p className="text-on-surface-variant text-lg sm:text-xl max-w-xl leading-relaxed">
                Tunnel files directly between devices with zero latency, or spin up a
                permanent cryptographic inbox to receive payloads from anyone.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch gap-4 pt-2">
                <Link
                  href="/p2p"
                  className="btn-brutalist text-base sm:text-lg py-4 px-8"
                >
                  <Zap className="w-5 h-5" strokeWidth={2.5} />
                  Start P2P Tunnel
                </Link>
                <Link
                  href="/g2p"
                  className="btn-brutalist-ghost text-base sm:text-lg py-4 px-8"
                >
                  <HardDrive className="w-5 h-5" strokeWidth={2.5} />
                  Create Inbox
                </Link>
              </div>

              {/* Share code entry */}
              <div className="pt-4 w-full max-w-lg">
                <label className="label-caps text-on-surface-variant block mb-2">
                  Have a Share Code? Enter it below
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget.elements.namedItem("heroShareCode") as HTMLInputElement;
                    const code = target.value.trim();
                    if (code) router.push(`/g2p/${code.toUpperCase()}`);
                  }}
                  className="flex items-center gap-0 bg-surface border-2 border-ink rounded-lg overflow-hidden shadow-hard focus-within:shadow-[6px_6px_0_0_rgba(30,27,21,1)] transition-shadow"
                >
                  <input
                    suppressHydrationWarning
                    type="text"
                    name="heroShareCode"
                    placeholder="ABC123"
                    autoComplete="off"
                    className="flex-1 bg-transparent border-none font-mono uppercase tracking-[0.25em] text-lg font-bold text-ink placeholder:text-outline px-5 py-3.5 focus:outline-none focus:ring-0 w-full min-w-0"
                  />
                  <button
                    suppressHydrationWarning
                    type="submit"
                    className="bg-ink text-signal-yellow hover:bg-signal-yellow hover:text-ink border-l-2 border-ink font-display font-bold uppercase text-base px-6 py-3.5 tracking-tight transition-colors shrink-0"
                  >
                    Connect →
                  </button>
                </form>
              </div>
            </motion.div>

            {/* Right column — diagonal composition, bidirectional file stream.
                Hidden below xl (1280px) — narrower columns squeeze devices together. */}
            <div className="lg:col-span-5 relative h-[440px] hidden xl:flex items-center justify-center">
              <div className="relative w-full max-w-[500px] h-full">
                {/* No tunnel lines — the motion of the file cards is enough to
                    communicate the transfer path. */}

                {/* Laptop — pinned top-left */}
                <motion.div
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-0 top-[10px] w-[270px] h-[200px] bg-surface border-2 border-ink rounded-xl shadow-hard flex flex-col overflow-hidden z-10"
                >
                  <div className="h-8 bg-ink flex items-center px-3 gap-1.5 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2.5">
                    <div className="w-2/3 h-2.5 bg-surface-container rounded" />
                    <div className="w-1/2 h-2.5 bg-surface-container rounded" />
                    <div className="mt-auto w-full h-10 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center">
                      <span className="label-caps text-ink">Sending Data…</span>
                    </div>
                  </div>
                </motion.div>

                {/* Sequential loop — one card at a time, invisible tracks.
                    Each card fires for CARD_DURATION s, then the next in sequence.
                    Subtle rotation during flight + a yellow glow on the icon
                    tile give the cards a "hot payload in transit" feel. */}
                {FILE_STREAM.map((f, i) => {
                  const lane = f.dir === "down" ? TOP_LANE : BOTTOM_LANE;
                  const startX = lane.start.x - 26, startY = lane.start.y - 28;
                  const endX   = lane.end.x   - 26, endY   = lane.end.y   - 28;
                  const repeatDelay = CYCLE_LENGTH - CARD_DURATION;
                  const tilt = f.dir === "down" ? [-6, 6] : [6, -6];
                  return (
                    <motion.div
                      key={f.label}
                      initial={{ left: `${startX}px`, top: `${startY}px`, opacity: 0, scale: 0.7, rotate: tilt[0] }}
                      animate={{
                        left:    [`${startX}px`, `${endX}px`],
                        top:     [`${startY}px`, `${endY}px`],
                        opacity: [0, 1, 1, 0],
                        scale:   [0.75, 1.05, 1.05, 0.75],
                        rotate:  tilt,
                      }}
                      transition={{
                        duration: CARD_DURATION,
                        repeat: Infinity,
                        repeatDelay,
                        ease: [0.25, 0.1, 0.25, 1],
                        delay: i * CARD_DURATION,
                      }}
                      className="absolute z-30 w-[52px] flex flex-col items-center gap-1 pointer-events-none will-change-transform"
                    >
                      <div
                        className={`w-[52px] h-14 border-2 border-ink rounded-md flex items-center justify-center ${f.bg}`}
                        style={{ boxShadow: "0 4px 0 0 rgba(30,27,21,1), 0 0 18px rgba(255,215,0,0.55)" }}
                      >
                        <f.icon className="w-6 h-6 text-ink" strokeWidth={2.5} />
                      </div>
                      <span className="bg-ink text-signal-yellow font-mono uppercase text-[9px] font-black tracking-widest px-1.5 py-[1px] rounded-sm">
                        {f.label}
                      </span>
                    </motion.div>
                  );
                })}

                {/* Phone — pinned bottom-right (diagonal from laptop) */}
                <motion.div
                  animate={{ y: [3, -3, 3] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute right-0 top-[145px] w-[140px] h-[280px] bg-surface border-2 border-ink rounded-2xl shadow-hard flex flex-col overflow-hidden z-10"
                >
                  <div className="h-4 w-14 bg-ink mx-auto rounded-b-lg" />
                  <div className="p-4 flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-signal-yellow border-2 border-ink flex items-center justify-center relative shadow-[0_0_28px_rgba(255,215,0,0.7)]">
                      <div className="absolute inset-0 rounded-full bg-signal-yellow animate-ping opacity-30" />
                      <Download className="w-7 h-7 text-ink relative z-10" strokeWidth={2.5} />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  MODE COMPARISON                                             */}
      {/* ============================================================ */}
      <section className="w-full bg-surface-container-low border-b-2 border-ink py-20 md:py-24">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="label-caps text-on-surface-variant">// 01 · Modes</span>
              <h2 className="font-display font-bold uppercase text-[40px] md:text-[56px] leading-[1.05] text-ink mt-2">
                Two ways to share
              </h2>
            </div>
            <p className="text-on-surface-variant max-w-md">
              Pick the transport that matches your workflow — instant peer tunnel or
              always-on portal.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* P2P Card */}
            <div className="card-brutalist p-8 group">
              <div className="flex items-start justify-between mb-8">
                <div className="w-14 h-14 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm">
                  <Zap className="w-7 h-7 text-ink" strokeWidth={2.5} />
                </div>
                <span className="chip-outline">P2P · WebRTC</span>
              </div>
              <h3 className="font-display font-bold uppercase text-3xl text-ink mb-3">
                Direct Transfer
              </h3>
              <p className="text-on-surface-variant leading-relaxed mb-8">
                A direct WebRTC tunnel between two browsers. Files stream securely
                without ever touching a server.
              </p>
              <ul className="space-y-3 mb-8">
                <FeatureLine>Zero file size limits</FeatureLine>
                <FeatureLine>Both users must be online</FeatureLine>
                <FeatureLine>No server storage — ever</FeatureLine>
              </ul>
              <Link
                href="/p2p"
                className="inline-flex items-center gap-2 label-caps text-ink hover:gap-3 transition-all border-b-2 border-ink pb-1"
              >
                Start Direct Transfer <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </Link>
            </div>

            {/* G2P Card */}
            <div className="card-brutalist p-8 group bg-signal-yellow">
              <div className="flex items-start justify-between mb-8">
                <div className="w-14 h-14 bg-ink border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm">
                  <HardDrive className="w-7 h-7 text-signal-yellow" strokeWidth={2.5} />
                </div>
                <span className="inline-flex items-center bg-ink text-signal-yellow border-2 border-ink rounded-md px-2 py-0.5 font-mono uppercase text-[11px] font-black">
                  G2P · Persistent
                </span>
              </div>
              <h3 className="font-display font-bold uppercase text-3xl text-ink mb-3">
                Permanent Portal
              </h3>
              <p className="text-ink leading-relaxed mb-8 font-medium">
                Claim a personal Share Code and QR. Anyone can upload files to your
                secure dashboard, even while you are offline.
              </p>
              <ul className="space-y-3 mb-8">
                <FeatureLine dark>Receive from many senders</FeatureLine>
                <FeatureLine dark>Works while you&apos;re offline</FeatureLine>
                <FeatureLine dark>Encrypted at rest</FeatureLine>
              </ul>
              <Link
                href="/g2p"
                className="inline-flex items-center gap-2 label-caps text-ink hover:gap-3 transition-all border-b-2 border-ink pb-1"
              >
                Create Your Portal <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FEATURES                                                    */}
      {/* ============================================================ */}
      <section className="w-full py-20 md:py-24 border-b-2 border-ink">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12">
          <div className="mb-10">
            <span className="label-caps text-on-surface-variant">// 02 · Guarantees</span>
            <h2 className="font-display font-bold uppercase text-[40px] md:text-[56px] leading-[1.05] text-ink mt-2">
              Built for trust
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-ink" strokeWidth={2.5} />}
              title="End-to-End Encrypted"
              body="AES-GCM-256 protects your payloads before they ever leave your device."
              tag="AES-256"
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6 text-ink" strokeWidth={2.5} />}
              title="Browser Native"
              body="No apps, no extensions. Runs on any modern web browser, everywhere."
              tag="WEB API"
            />
            <FeatureCard
              icon={<Lock className="w-6 h-6 text-ink" strokeWidth={2.5} />}
              title="Privacy First"
              body="P2P transfers are anonymous and untraceable. We don't retain metadata."
              tag="ZERO-LOG"
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FAQ                                                         */}
      {/* ============================================================ */}
      <section className="w-full py-20 md:py-24 bg-surface-container-low border-b-2 border-ink">
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="mb-10 text-center">
            <span className="label-caps text-on-surface-variant">// 03 · FAQ</span>
            <h2 className="font-display font-bold uppercase text-[40px] md:text-[56px] leading-[1.05] text-ink mt-2">
              Questions
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            {FAQS.map((faq, idx) => {
              const open = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className={`card-brutalist-flat overflow-hidden transition-all ${
                    open ? "shadow-hard" : ""
                  }`}
                >
                  <button
                    suppressHydrationWarning
                    onClick={() => setActiveFaq(open ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-signal-yellow transition-colors"
                  >
                    <span className="font-display font-bold uppercase text-lg text-ink">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-ink transition-transform shrink-0 ml-4 ${
                        open ? "rotate-180" : ""
                      }`}
                      strokeWidth={2.5}
                    />
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t-2 border-ink"
                      >
                        <p className="px-5 py-4 text-on-surface-variant leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SeoContent />

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="w-full bg-ink text-surface py-10 mt-auto">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-signal-yellow border-2 border-signal-yellow rounded-md flex items-center justify-center">
              <Upload className="w-4 h-4 text-ink" strokeWidth={3} />
            </div>
            <span className="font-display font-bold uppercase tracking-tight text-xl">
              Share2Me
            </span>
          </div>
          <div className="label-caps text-surface/70">© 2026 Share2Me — All Rights Reserved</div>
          <div className="flex items-center gap-6">
            <a href="https://www.linkedin.com/company/share2me" target="_blank" rel="noopener noreferrer" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">
              LinkedIn
            </a>
            <Link href="/privacy" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureLine({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`w-5 h-5 border-2 border-ink rounded-md flex items-center justify-center shrink-0 ${dark ? "bg-ink" : "bg-signal-yellow"}`}>
        <svg className={`w-3 h-3 ${dark ? "text-signal-yellow" : "text-ink"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className={`${dark ? "text-ink" : "text-on-surface"} font-medium`}>{children}</span>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <div className="card-brutalist p-6 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center">
          {icon}
        </div>
        <span className="chip-outline">{tag}</span>
      </div>
      <h3 className="font-display font-bold uppercase text-2xl text-ink mb-2">{title}</h3>
      <p className="text-on-surface-variant leading-relaxed">{body}</p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}
