"use client";
import { Suspense } from "react";
import { TopNav }       from "@/components/TopNav";
import G2pDashboard    from "@/components/G2pDashboard";
import Link from "next/link";
import { ArrowLeft, UserCheck, Send, AlertCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn, signOut, useSession, SessionProvider } from "next-auth/react";

function G2PContent() {
  const { data: session, status } = useSession();
  
  const handleLogout = () => {
    signOut();
  };

  const isLoading = status === "loading";
  
  // Map the NextAuth session to the expected UserProfile interface
  const g2pUser = session?.user ? {
    userId: (session.user as any).id as string,
    email: session.user.email as string,
    username: session.user.name as string,
    shareCode: (session.user as any).shareCode as string,
    profilePhoto: session.user.image as string,
    googleId: "", 
    createdAt: new Date().toISOString()
  } : null;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-sans selection:bg-primary/20">
      <div>
        <TopNav />
        
        <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-background-elevated border border-primary/40 hover:bg-background-card text-xs font-semibold text-text-secondary hover:text-primary transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">Receive Portal</h1>
            <p className="text-text-tertiary text-xs md:text-sm leading-relaxed">
              Create a permanent inbox to receive files from anyone using your unique Share Code.
            </p>
          </div>

          {isLoading ? (
            <div className="w-full flex items-center justify-center p-12">
               <div className="animate-pulse flex flex-col items-center gap-4 text-text-tertiary">
                 <div className="w-8 h-8 rounded-full border-2 border-primary/50 border-t-transparent animate-spin"></div>
                 <span className="text-sm font-medium">Authenticating securely...</span>
               </div>
            </div>
          ) : g2pUser ? (
            <G2pDashboard user={g2pUser} onLogout={handleLogout} />
          ) : (
            <div className="w-full">
              <AnimatePresence mode="wait">
                <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                  {/* Login Card */}
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full lg:w-1/2 bg-background-card border-2 border-primary rounded-2xl p-8"
                  >
                    <div className="space-y-2 mb-8">
                      <h2 className="text-xl font-semibold text-text-primary">Create your portal</h2>
                      <p className="text-sm text-text-secondary">
                        Sign in to claim your permanent Share Code and start receiving files.
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                      <button
                        onClick={() => signIn("google")}
                        className="w-full py-3.5 px-4 rounded-xl border-2 border-primary bg-background-elevated hover:bg-primary/10 text-sm font-bold text-text-primary hover:text-primary transition-colors flex items-center justify-center gap-3"
                      >
                        <UserCheck className="w-5 h-5 text-primary" />
                        <span>Continue with Google</span>
                      </button>
                    </div>
                  </motion.div>

                  {/* Send Files Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: 0.1 }}
                    className="w-full lg:w-1/2 bg-background-elevated border-2 border-primary rounded-2xl p-8"
                  >
                    <div className="flex flex-col mb-6">
                      <div className="w-10 h-10 bg-primary/10 border-2 border-primary rounded-xl flex items-center justify-center mb-4">
                        <Send className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-text-primary text-lg">Send files instead?</h3>
                      <p className="text-sm text-text-secondary mt-1">Enter a receiver&apos;s Share Code to open their portal.</p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const target = e.currentTarget.elements.namedItem("shareCodeInput") as HTMLInputElement;
                        const entered = target.value.trim();
                        if (entered) window.location.href = `/g2p/${entered.toUpperCase()}`;
                      }}
                      className="flex flex-col sm:flex-row gap-3"
                    >
                      <input
                        type="text"
                        name="shareCodeInput"
                        required
                        placeholder="e.g. STY392"
                        className="bg-background border-2 border-primary rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors w-full uppercase tracking-wider font-mono font-bold"
                      />
                      <button
                        type="submit"
                        className="bg-primary text-background hover:bg-primary-hover font-bold rounded-xl px-6 py-3 text-sm transition-colors shrink-0 border-2 border-primary"
                      >
                        Open
                      </button>
                    </form>
                  </motion.div>
                </div>
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
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
