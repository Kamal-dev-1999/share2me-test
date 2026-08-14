"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { SideRail } from "@/components/SideRail";
import { signIn } from "next-auth/react";
import {
  Search, FileText, ImageIcon, FileImage, Film, PenTool,
  FileSpreadsheet, FileType2, AlignLeft, Table,
  Zap, ArrowRight,
  type LucideIcon,
} from "lucide-react";

// File-format tiles that orbit the logo — documents (PDF, DOCX, TXT,
// CSV, XLSX) and images (JPG, PNG, GIF, SVG).
const ORBIT_TILES: { label: string; icon: LucideIcon; from: string; to: string }[] = [
  { label: "PDF",  icon: FileText,        from: "#F87171", to: "#DC2626" },
  { label: "DOCX", icon: FileType2,       from: "#60A5FA", to: "#2563EB" },
  { label: "TXT",  icon: AlignLeft,       from: "#94A3B8", to: "#475569" },
  { label: "CSV",  icon: Table,           from: "#2DD4BF", to: "#0D9488" },
  { label: "XLSX", icon: FileSpreadsheet, from: "#4ADE80", to: "#16A34A" },
  { label: "JPG",  icon: FileImage,       from: "#FBBF24", to: "#D97706" },
  { label: "PNG",  icon: ImageIcon,       from: "#A78BFA", to: "#7C3AED" },
  { label: "GIF",  icon: Film,            from: "#F472B6", to: "#DB2777" },
  { label: "SVG",  icon: PenTool,         from: "#818CF8", to: "#4F46E5" },
];

// Brand icons — inline SVGs (this lucide version has no brand set).
function GithubSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.78 1.05.78 2.13v3.16c0 .31.21.67.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
function LinkedinSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.27c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zm13.5 12.27h-3v-5.6c0-3.37-4-3.11-4 0v5.6h-3v-11h3v1.77c1.4-2.59 7-2.78 7 2.47v6.76z" />
    </svg>
  );
}
function TwitterSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
    </svg>
  );
}
function InstagramSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────
// Glassmorphism landing — gradient blobs + frosted panel +
// left icon rail + floating file-type tiles (Share2Me features).
// Self-contained styling: this page carries its own palette and
// does not depend on the app-wide dashboard tokens.
// ────────────────────────────────────────────────────────────

function GradientBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* top-right purple */}
      <div className="absolute -top-24 right-[8%] w-[380px] h-[380px] rounded-full bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] opacity-90" />
      {/* right green */}
      <div className="absolute top-[38%] -right-28 w-[340px] h-[340px] rounded-full bg-gradient-to-br from-[#A3E635] via-[#4ADE80] to-[#16A34A] opacity-90" />
      {/* bottom-right orange */}
      <div className="absolute -bottom-32 right-[16%] w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-[#F97316] via-[#FB923C] to-[#FBBF24] opacity-90" />
      {/* left pink glow behind the rail */}
      <div className="absolute top-[22%] -left-24 w-[320px] h-[420px] rounded-full bg-gradient-to-b from-[#EC4899] to-[#D946EF] opacity-60 blur-3xl" />
      {/* soft ambient wash */}
      <div className="absolute top-[10%] left-[30%] w-[500px] h-[500px] rounded-full bg-white/30 blur-[120px]" />
    </div>
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <span className={`absolute text-[#7C3AED] font-bold select-none ${className}`} aria-hidden="true">
      +
    </span>
  );
}

function HomeContent() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorModal, setErrorModal] = useState<{ show: boolean; code: string }>({ show: false, code: "" });

  const openPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = code.trim().toUpperCase();
    if (!val) {
      router.push("/g2p");
      return;
    }

    if (/^\d{6}$/.test(val)) {
      router.push(`/p2p?mode=receive&code=${val}`);
      return;
    }

    setIsVerifying(true);
    try {
      const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || "http://localhost:3000";
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/requests/vendor/${val}`);
      if (res.ok) {
        router.push(`/g2p/${val}`);
      } else {
        setErrorModal({ show: true, code: val });
      }
    } catch (err) {
      setErrorModal({ show: true, code: val });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#CDC3E4] relative flex items-center justify-center p-4 sm:p-6 lg:py-10 lg:pr-10 lg:pl-5 font-body">
      <GradientBlobs />

      {/* Shell: glass panel with the rail fused into its left edge */}
      <div className="relative z-10 w-full max-w-[1200px] flex items-center">
        {/* Frosted glass panel */}
        <div className="flex-1 rounded-[28px] bg-white/30 backdrop-blur-2xl border border-white/50 shadow-[0_24px_80px_rgba(70,40,140,0.25)] overflow-visible flex">
          <SideRail embedded />
          <div className="flex-1 min-w-0">

          {/* Top bar */}
          <header className="flex items-center gap-4 px-6 sm:px-8 pt-6 flex-wrap">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="w-9 h-9 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <Image src="/logo.png" alt="Share2Me" width={36} height={36} className="object-cover w-full h-full" priority />
              </span>
              <span className="font-semibold text-[15px] tracking-tight text-[#1E1B2E]">Share2Me</span>
            </Link>

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3 ml-auto">
              <button
                onClick={() => signIn("google", { callbackUrl: "/g2p" })}
                className="px-5 py-2 text-[13px] font-bold text-[#1E1B2E] hover:text-[#4B4560] transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => signIn("google", { callbackUrl: "/g2p" })}
                className="px-5 py-2 rounded-full bg-[#171226] text-white text-[12px] font-bold tracking-[0.08em] uppercase hover:bg-[#2A2140] transition-colors shadow-sm"
              >
                Sign Up
              </button>
            </div>

          </header>

          {/* Body: copy left, floating tiles right */}
          <div className="grid lg:grid-cols-2 gap-8 px-6 sm:px-8 lg:pl-12 pb-10 pt-8 lg:pt-12 items-center">

            {/* Left column */}
            <div className="max-w-[440px]">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#5B5470] uppercase">
                Do more with us!
              </p>
              <h1 className="mt-3 text-[36px] sm:text-[44px] leading-[1.08] font-bold text-[#171226] tracking-tight text-balance">
                Share Files<br />Instantly
              </h1>
              <p className="mt-4 text-[13px] leading-relaxed text-[#4B4560]">
                Send files and text directly between devices — end-to-end encrypted,
                no cloud storage, no size limits, no sign-ups. Or claim a permanent
                portal so anyone can drop files into your inbox.
              </p>

              {/* Share-code input (the email field in the reference) */}
              <form onSubmit={openPortal} className="mt-7 flex flex-col gap-3">
                <div className="flex items-center bg-white/55 border border-white/80 rounded-full px-5 py-3">
                  <input
                    suppressHydrationWarning
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Your share code…"
                    className="flex-1 bg-transparent text-[13px] text-[#1E1B2E] placeholder:text-[#6B6480] focus:outline-none min-w-0 uppercase tracking-[0.14em]"
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    suppressHydrationWarning
                    type="submit"
                    disabled={isVerifying}
                    className="h-11 px-8 rounded-full bg-[#171226] text-white text-[12px] font-bold tracking-[0.12em] uppercase hover:bg-[#2A2140] transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? "Verifying..." : "Open portal"}
                    {!isVerifying && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />}
                  </button>
                  <Link
                    href="/p2p"
                    className="h-11 px-6 rounded-full bg-white/55 border border-white/80 text-[#171226] text-[12px] font-bold tracking-[0.08em] uppercase hover:bg-white/80 transition-colors flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                    P2P transfer
                  </Link>
                </div>
              </form>

              {/* Social row */}
              <div className="mt-8 flex items-center gap-3">
                {[
                  { Svg: GithubSvg,    href: "https://github.com/share2me",               label: "GitHub" },
                  { Svg: LinkedinSvg,  href: "https://www.linkedin.com/company/share2me", label: "LinkedIn" },
                  { Svg: TwitterSvg,   href: "https://twitter.com",                       label: "Twitter" },
                  { Svg: InstagramSvg, href: "https://instagram.com",                     label: "Instagram" },
                ].map(({ Svg, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full bg-white/50 border border-white/70 flex items-center justify-center text-[#4B4560] hover:text-[#171226] hover:bg-white/80 transition-colors"
                  >
                    <Svg className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Right column — file-format icons orbiting the centered logo */}
            <div className="relative h-[340px] sm:h-[400px] hidden lg:flex items-center justify-center">
              <div className="relative w-[340px] h-[340px] flex items-center justify-center">
                {/* Center logo medallion — flex-centered normal-flow child,
                    immune to transform/margin drift */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="w-28 h-28 rounded-[28px] overflow-hidden bg-black shadow-[0_24px_60px_rgba(30,20,60,0.35)] z-10"
                >
                  <Image src="/logo.png" alt="" width={112} height={112} className="object-cover w-full h-full" />
                </motion.div>

                {/* Orbit ring — every rotation happens on a full-size (inset-0)
                    layer so its origin is exactly the container center; the
                    counter-spin happens on the 58px tile box itself so its
                    origin is exactly the tile center. No drift possible. */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0"
                >
                  {ORBIT_TILES.map((t, i) => {
                    const angle = (360 / ORBIT_TILES.length) * i;
                    return (
                      /* Angular placement layer — full size, origin = center */
                      <div
                        key={t.label}
                        className="absolute inset-0 pointer-events-none"
                        style={{ transform: `rotate(${angle}deg)` }}
                      >
                        {/* Tile slot at 12 o'clock, radius 140px from center:
                            top = 170 (center) - 140 (radius) - 29 (half tile) */}
                        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "1px" }}>
                          <motion.div
                            initial={{ rotate: -angle }}
                            animate={{ rotate: [-angle, -angle - 360] }}
                            transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
                            className="w-[58px] h-[58px] pointer-events-auto"
                          >
                            {/* 3D glossy tile — icon + extension label */}
                            <div
                              title={t.label}
                              className="relative w-full h-full rounded-[18px] flex flex-col items-center justify-center gap-0.5 overflow-hidden"
                              style={{
                                background: `linear-gradient(145deg, ${t.from} 0%, ${t.to} 100%)`,
                                boxShadow: [
                                  "0 14px 28px rgba(30, 20, 60, 0.30)",     // drop
                                  "0 4px 8px rgba(30, 20, 60, 0.18)",       // contact
                                  "inset 0 2px 3px rgba(255,255,255,0.55)", // top bevel
                                  "inset 0 -3px 6px rgba(0,0,0,0.25)",      // bottom bevel
                                ].join(", "),
                              }}
                            >
                              {/* Gloss highlight — top half sheen */}
                              <span
                                aria-hidden="true"
                                className="absolute inset-x-0 top-0 h-1/2 rounded-t-[18px]"
                                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))" }}
                              />
                              <t.icon
                                className="w-5 h-5 text-white relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
                                strokeWidth={2.25}
                              />
                              <span className="relative z-10 text-[8px] font-bold tracking-[0.08em] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                                {t.label}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Decorative sparkles */}
                <Sparkle className="left-[10%] top-[16%] text-[18px]" />
                <Sparkle className="right-[8%] top-[30%] text-[14px]" />
                <Sparkle className="left-[16%] bottom-[10%] text-[16px]" />
                <Sparkle className="right-[14%] bottom-[16%] text-[20px]" />
              </div>
            </div>
          </div>

          </div>
        </div>
      </div>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-[#EFEAF6] rounded-3xl p-8 max-w-sm w-full shadow-[0_24px_80px_rgba(70,40,140,0.2)] flex flex-col items-center text-center border border-white/50"
            >
              <div className="w-16 h-16 rounded-3xl bg-[#F0D5D8] flex items-center justify-center mb-5 border border-white/50">
                <AlertCircle className="w-8 h-8 text-[#DC2626]" strokeWidth={2} />
              </div>
              <h2 className="text-[22px] font-bold text-[#171226] mb-2 tracking-tight">Portal not found</h2>
              <p className="text-[14px] text-[#4B4560] leading-relaxed mb-8 px-2">
                The Share Code <strong className="text-[#171226]">"{errorModal.code}"</strong> is invalid or has expired.
              </p>
              <button
                onClick={() => setErrorModal({ show: false, code: "" })}
                className="w-full h-12 rounded-full bg-[#171226] text-white text-[13px] font-bold hover:bg-[#2A2140] transition-colors shadow-md"
              >
                Return Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#CDC3E4]" />}>
      <HomeContent />
    </Suspense>
  );
}
