"use client";
import { Suspense } from "react";
import { TopNav } from "@/components/TopNav";
import G2pDashboard from "@/components/G2pDashboard";
import Link from "next/link";
import { ArrowLeft, UserCheck, Send, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn, signOut, useSession, SessionProvider } from "next-auth/react";

function G2PContent() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  const g2pUser = session?.user
    ? {
        userId: (session.user as any).id as string,
        email: session.user.email as string,
        username: session.user.name as string,
        shareCode: (session.user as any).shareCode as string,
        profilePhoto: session.user.image as string,
        googleId: "",
        createdAt: new Date().toISOString(),
      }
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <TopNav />

      <main className="w-full max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 pt-6 pb-16 flex-1">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 border-2 border-ink rounded-md px-3 py-1.5 bg-surface hover:bg-signal-yellow transition-colors label-caps text-ink shadow-hard-sm"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
            Back to Home
          </Link>
        </div>

        {/* Section header */}
        <div className="mb-8">
          <span className="label-caps text-on-surface-variant">// G2P · Permanent Portal</span>
          <h1 className="font-display font-bold uppercase text-[40px] md:text-[56px] leading-[1.05] text-ink mt-2">
            Receive Portal
          </h1>
          <p className="text-on-surface-variant mt-3 max-w-[650px] leading-relaxed">
            Create a permanent inbox to receive files from anyone using your unique
            Share Code.
          </p>
        </div>

        {isLoading ? (
          <div className="card-brutalist p-12 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-ink border-t-transparent animate-spin" />
              <span className="label-caps text-ink">Authenticating…</span>
            </div>
          </div>
        ) : g2pUser ? (
          <G2pDashboard user={g2pUser} onLogout={() => signOut()} />
        ) : (
          <div className="w-full">
            <AnimatePresence mode="wait">
              <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-stretch w-full">
                {/* Login Card */}
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="card-brutalist p-8 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm">
                      <HardDrive className="w-7 h-7 text-ink" strokeWidth={2.5} />
                    </div>
                    <span className="chip-outline">Free · Google Auth</span>
                  </div>
                  <h2 className="font-display font-bold uppercase text-2xl md:text-3xl text-ink mb-2">
                    Create Your Portal
                  </h2>
                  <p className="text-on-surface-variant mb-8">
                    Sign in to claim your permanent Share Code and start receiving
                    files.
                  </p>
                  <button
                    onClick={() => signIn("google")}
                    className="btn-brutalist mt-auto"
                  >
                    <UserCheck className="w-5 h-5" strokeWidth={2.5} />
                    Continue with Google
                  </button>
                </motion.div>

                {/* Send Files Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.08 }}
                  className="card-brutalist bg-signal-yellow p-8 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-ink border-2 border-ink rounded-md flex items-center justify-center shadow-hard-sm">
                      <Send className="w-7 h-7 text-signal-yellow" strokeWidth={2.5} />
                    </div>
                    <span className="inline-flex items-center bg-ink text-signal-yellow border-2 border-ink rounded-md px-2 py-0.5 font-mono uppercase text-[11px] font-black">
                      Sender Path
                    </span>
                  </div>
                  <h3 className="font-display font-bold uppercase text-2xl md:text-3xl text-ink mb-2">
                    Send Files Instead?
                  </h3>
                  <p className="text-ink font-medium mb-8">
                    Enter a receiver&apos;s Share Code to open their portal.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const target = e.currentTarget.elements.namedItem("shareCodeInput") as HTMLInputElement;
                      const entered = target.value.trim();
                      if (entered) window.location.href = `/g2p/${entered.toUpperCase()}`;
                    }}
                    className="mt-auto flex flex-col sm:flex-row gap-0 bg-surface border-2 border-ink rounded-lg overflow-hidden"
                  >
                    <input
                      type="text"
                      name="shareCodeInput"
                      required
                      placeholder="STY392"
                      className="bg-transparent border-none px-4 py-3 font-mono uppercase tracking-[0.2em] font-bold text-ink placeholder:text-outline focus:outline-none focus:ring-0 w-full min-w-0"
                    />
                    <button
                      type="submit"
                      className="bg-ink text-signal-yellow hover:bg-on-surface font-display font-bold uppercase text-base px-6 py-3 tracking-tight transition-colors shrink-0 border-l-2 border-ink"
                    >
                      Open →
                    </button>
                  </form>
                </motion.div>
              </div>
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="w-full bg-ink text-surface py-10 mt-auto">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-display font-bold uppercase tracking-tight text-xl">Share2Me</span>
          <div className="label-caps text-surface/70">© 2026 Share2Me — All Rights Reserved</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">Privacy</Link>
            <Link href="/terms" className="label-caps text-surface/70 hover:text-signal-yellow transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function G2PPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SessionProvider>
        <G2PContent />
      </SessionProvider>
    </Suspense>
  );
}
