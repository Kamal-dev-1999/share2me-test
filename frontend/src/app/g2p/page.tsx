"use client";
import { Suspense, useEffect, useState } from "react";
import G2pDashboard from "@/components/G2pDashboard";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UserCheck, Send, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn, signOut, useSession, SessionProvider } from "next-auth/react";
import { RoleSelectModal } from "@/components/printshop/RoleSelectModal";
import { getRole, type UserRole } from "@/lib/printShop";

function G2PContent() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  // Role gate — each Google ACCOUNT gets asked Shopkeeper/Student/Assistant
  // once; the choice is stored per email, so switching accounts asks again.
  const email = session?.user?.email ?? null;
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  useEffect(() => {
    if (status === "loading") return;
    setRoleState(email ? getRole(email) : null);
    setRoleChecked(true);
  }, [email, status]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
        <main className="w-full max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 pt-6 pb-16 flex-1">
          <div className="card-brutalist p-12 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-ink border-t-transparent animate-spin" />
              <span className="label-caps text-ink">Authenticating…</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (g2pUser) {
    // Render the new full-page app layout for the Dashboard
    return (
      <div className="min-h-screen bg-background text-on-surface font-body p-4 sm:p-6 md:overflow-hidden flex flex-col">
        {/* One-time role picker after Google sign-in */}
        {roleChecked && !role && (
          <RoleSelectModal account={email} onSelected={(r) => setRoleState(r)} />
        )}
        <G2pDashboard user={g2pUser} onLogout={() => signOut()} userRole={role} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface font-body">
      <main className="w-full max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 pt-6 pb-16 flex-1">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Back to Home
          </Link>
        </div>

        {/* Section header — compact */}
        <div className="mb-6">
          <h1 className="text-[22px] md:text-[26px] font-semibold text-on-surface leading-tight tracking-tight">
            Receive Portal
          </h1>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-[560px]">
            Create a permanent inbox to receive files from anyone using your Share Code.
          </p>
        </div>

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
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 bg-surface-muted rounded-xl flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-on-surface" strokeWidth={1.75} />
                  </div>
                  <span className="chip-outline">Free · Google auth</span>
                </div>
                <h2 className="text-[20px] md:text-[22px] font-semibold text-on-surface mb-1.5 leading-tight">
                  Create your portal
                </h2>
                <p className="text-[13px] text-on-surface-variant mb-6">
                  Sign in to claim your permanent Share Code and start receiving files.
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
                className="card-mint p-8 flex flex-col"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <Send className="w-6 h-6 text-on-surface" strokeWidth={1.75} />
                  </div>
                  <span className="chip-outline">Sender path</span>
                </div>
                <h3 className="text-[20px] md:text-[22px] font-semibold text-on-surface mb-1.5 leading-tight">
                  Send files instead?
                </h3>
                <p className="text-[13px] text-on-surface-variant mb-6">
                  Enter a receiver&apos;s Share Code to open their portal.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget.elements.namedItem("shareCodeInput") as HTMLInputElement;
                    const entered = target.value.trim();
                    if (entered) window.location.href = `/g2p/${entered.toUpperCase()}`;
                  }}
                  className="mt-auto flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    name="shareCodeInput"
                    required
                    placeholder="STY392"
                    className="input-brutalist font-mono uppercase tracking-[0.18em] text-[14px] font-semibold"
                  />
                  <button
                    type="submit"
                    className="btn-brutalist shrink-0"
                  >
                    Open
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </form>
              </motion.div>
            </div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="w-full border-t border-hairline bg-surface py-6 mt-auto">
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="font-semibold text-on-surface">Share2Me</span>
          <span>© 2026 Share2Me — All rights reserved</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
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
