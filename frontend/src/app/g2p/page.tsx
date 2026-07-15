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
        
        <main className="w-full max-w-6xl mx-auto px-6 pt-12 pb-24">
          <div className="mb-10">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-background-elevated border border-border hover:bg-background-card text-sm font-medium text-text-secondary hover:text-primary transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="mb-12 space-y-3">
            <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">Receive Portal</h1>
            <p className="text-text-tertiary max-w-2xl text-sm md:text-base leading-relaxed">
              Create a permanent inbox to receive files from anyone. Senders can use your unique Share Code to securely upload files directly to you.
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
                    className="w-full lg:w-1/2 bg-background-card border border-border rounded-2xl p-8 shadow-xl"
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
                        className="w-full py-3 px-4 rounded-xl border border-border bg-background-elevated hover:bg-background hover:border-primary/50 text-sm font-medium text-text-primary hover:text-primary transition-colors flex items-center justify-center gap-3 shadow-glow"
                      >
                        <UserCheck className="w-5 h-5" />
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
                    className="w-full lg:w-1/2 bg-background-elevated border border-border rounded-2xl p-8"
                  >
                    <div className="flex flex-col mb-6">
                      <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-4">
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
                        className="bg-background border border-border focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors w-full uppercase tracking-wider"
                      />
                      <button
                        type="submit"
                        className="bg-primary text-background hover:bg-primary-hover font-bold rounded-xl px-6 py-3 text-sm transition-colors shrink-0 shadow-glow hover:shadow-glow-active"
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
