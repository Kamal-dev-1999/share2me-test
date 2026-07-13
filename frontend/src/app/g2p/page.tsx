"use client";
import { Suspense, useEffect, useState } from "react";
import { TopNav }       from "@/components/TopNav";
import G2pDashboard    from "@/components/G2pDashboard";
import Link from "next/link";
import { ArrowLeft, UserCheck, Lock, Sparkles, Send, User, AlertCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GoogleGSI {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement | null, options: { theme: string; size: string; width: number }) => void;
    };
  };
}

interface UserProfile {
  userId: string;
  googleId: string;
  email: string;
  username: string;
  shareCode: string;
  profilePhoto: string;
  createdAt: string;
}

function generateShareCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function G2PContent() {
  const [g2pUser, setG2pUser] = useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [googleInitialized, setGoogleInitialized] = useState(false);

  const loadG2pSession = () => {
    if (typeof window !== "undefined") {
      const session = localStorage.getItem("share2me_current_user");
      if (session) {
        setG2pUser(JSON.parse(session));
      } else {
        setG2pUser(null);
      }
    }
  };

  useEffect(() => {
    loadG2pSession();
    window.addEventListener("share2me_user_updated", loadG2pSession);
    return () => window.removeEventListener("share2me_user_updated", loadG2pSession);
  }, []);

  // Load Google client script
  useEffect(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGoogleInitialized(true);
      };
      document.body.appendChild(script);
    }
  }, []);

  // Render Google Button when auth view is active
  useEffect(() => {
    const google = typeof window !== "undefined" ? (window as unknown as { google: GoogleGSI }).google : null;
    if (googleInitialized && google && !g2pUser) {
      try {
        google.accounts.id.initialize({
          client_id: "782038472910-mockid.apps.googleusercontent.com",
          callback: handleGoogleLoginResponse
        });
        google.accounts.id.renderButton(
          document.getElementById("googleSignInDiv"),
          { theme: "outline", size: "large", width: 280 }
        );
      } catch (err) {
        console.warn("Google button failed to render:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleInitialized, g2pUser]);

  const decodeJwt = (token: string) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("JWT Decode error:", e);
      return null;
    }
  };

  const handleGoogleLoginResponse = (response: { credential: string }) => {
    const payload = decodeJwt(response.credential);
    if (!payload) return;

    const googleId = payload.sub;
    const email = payload.email;
    const picture = payload.picture;

    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    let matched = users.find(u => u.googleId === googleId);

    if (!matched) {
      const shareCode = generateShareCode();
      matched = {
        userId: "usr_" + Math.random().toString(36).substr(2, 9),
        googleId,
        email,
        username: "", 
        shareCode,
        profilePhoto: picture,
        createdAt: new Date().toISOString()
      };
      users.push(matched);
      localStorage.setItem("share2me_mock_users", JSON.stringify(users));
    }

    localStorage.setItem("share2me_current_user", JSON.stringify(matched));
    setG2pUser(matched);
  };

  const handleMockLogin = (createFresh = false) => {
    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    
    if (users.length > 0 && !createFresh) {
      localStorage.setItem("share2me_current_user", JSON.stringify(users[0]));
      setG2pUser(users[0]);
    } else {
      const mockUserId = "usr_" + Math.random().toString(36).substr(2, 9);
      const mockGoogleId = "g_" + Math.random().toString(36).substr(2, 9);
      const mockEmail = `tester-${Math.floor(Math.random() * 900) + 100}@share2me.dev`;
      const shareCode = generateShareCode();

      const newUser: UserProfile = {
        userId: mockUserId,
        googleId: mockGoogleId,
        email: mockEmail,
        username: "",
        shareCode,
        profilePhoto: "",
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem("share2me_mock_users", JSON.stringify(users));
      localStorage.setItem("share2me_current_user", JSON.stringify(newUser));
      setG2pUser(newUser);
    }
  };

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError("");

    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setUsernameError("Username cannot be empty");
      return;
    }
    if (trimmed.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }

    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    const taken = users.some(u => u.username.toLowerCase() === trimmed.toLowerCase() && u.userId !== g2pUser?.userId);
    
    if (taken) {
      setUsernameError("Username is already taken");
      return;
    }

    if (g2pUser) {
      const updatedUser = { ...g2pUser, username: trimmed };
      const updatedUsers = users.map(u => {
        if (u.userId === g2pUser.userId) {
          return updatedUser;
        }
        return u;
      });

      localStorage.setItem("share2me_mock_users", JSON.stringify(updatedUsers));
      localStorage.setItem("share2me_current_user", JSON.stringify(updatedUser));
      setG2pUser(updatedUser);
      setUsernameInput("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("share2me_current_user");
    setG2pUser(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <TopNav />
        
        <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24">
          {/* Refined Back Button */}
          <div className="mb-6">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border bg-background-elevated hover:bg-border/30 hover:border-primary/30 text-xs sm:text-sm font-bold text-text-secondary hover:text-text-primary transition-all duration-200 shadow-sm active:scale-95 group"
            >
              <ArrowLeft className="w-4 h-4 text-text-tertiary group-hover:text-primary transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Refined Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">Group-to-Person (G2P) Transfer</h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-[650px] leading-relaxed">
              Set up a permanent sharing portal. Senders can use your Share Code or scan your QR code to send files.
            </p>
          </div>

          {/* Dashboard view directly at top-level; Onboarding views within elevated card wrapper */}
          {g2pUser && g2pUser.username ? (
            <G2pDashboard
              user={g2pUser}
              onLogout={handleLogout}
            />
          ) : (
            <div className="bg-background-elevated rounded-[32px] border border-border p-5 sm:p-8 md:p-10 shadow-soft relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#B967FF]/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="w-full">
                <AnimatePresence mode="wait">
                  
                  {/* 1. AUTHENTICATION VIEW */}
                  {!g2pUser && (
                    <div className="flex flex-col gap-6 max-w-[460px] mx-auto w-full">
                      <motion.div
                        key="auth"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="w-full bg-background-elevated border border-border rounded-[32px] p-6 sm:p-8 shadow-2xl text-center space-y-6"
                      >
                        <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-[20px] flex items-center justify-center mx-auto shadow-sm">
                          <Lock className="w-8 h-8 text-primary" />
                        </div>
                        
                        <div className="space-y-2">
                          <h2 className="text-2xl font-bold text-text-primary">G2P Portal Login</h2>
                          <p className="text-sm text-text-secondary">
                            Sign in using your Google account to claim your permanent Share Code and start receiving files.
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-3.5 pt-4 w-full border-t border-border/60">
                          {/* Google Login container */}
                          <div id="googleSignInDiv" className="min-h-[44px]" />

                          {/* Developer Mock bypass */}
                          <div className="flex flex-col gap-2 w-full pt-2">
                            <button
                              onClick={() => handleMockLogin(false)}
                              className="w-full py-3.5 px-6 rounded-xl border border-border bg-background hover:bg-background-elevated hover:border-primary/40 font-bold text-xs text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                              <UserCheck className="w-4 h-4 text-primary" />
                              <span>Demo Bypass Login (Mock)</span>
                            </button>
                            
                            <button
                              onClick={() => handleMockLogin(true)}
                              className="w-full py-3.5 px-6 rounded-xl border border-border bg-background hover:bg-background-elevated hover:border-[#B967FF]/40 font-bold text-xs text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                              <Sparkles className="w-4 h-4 text-[#B967FF]" />
                              <span>Create New Tester Account</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>

                      {/* Manual Share Code Entry for Senders */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="w-full bg-background-elevated border border-border rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shrink-0">
                            <Send className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-bold text-text-primary text-base">Send files using a Share Code</h3>
                            <p className="text-xs text-text-secondary mt-0.5">Enter the receiver&apos;s custom code below</p>
                          </div>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const target = e.currentTarget.elements.namedItem("shareCodeInput") as HTMLInputElement;
                            const entered = target.value.trim();
                            if (entered) window.location.href = `/g2p/${entered.toUpperCase()}`;
                          }}
                          className="flex gap-2 pt-4 border-t border-border/60"
                        >
                          <input
                            type="text"
                            name="shareCodeInput"
                            required
                            placeholder="e.g. STY392"
                            className="bg-background border border-border focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors w-full uppercase font-mono tracking-wider"
                          />
                          <button
                            type="submit"
                            className="bg-primary text-background hover:bg-opacity-95 font-bold rounded-xl px-6 py-3 text-sm transition-colors shrink-0"
                          >
                            Go
                          </button>
                        </form>
                      </motion.div>
                    </div>
                  )}

                  {/* 2. ONBOARDING: CHOOSE USERNAME */}
                  {g2pUser && !g2pUser.username && (
                    <motion.div
                      key="onboarding"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="max-w-[460px] mx-auto bg-background-elevated border border-border rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6"
                    >
                      <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-[20px] flex items-center justify-center mx-auto shadow-sm">
                        <User className="w-8 h-8 text-primary" />
                      </div>
                      
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-text-primary">Choose your Username</h2>
                        <p className="text-sm text-text-secondary">
                          This username will be visible to other senders when they enter your Share Code or scan your QR.
                        </p>
                      </div>

                      <form onSubmit={handleSaveUsername} className="space-y-4 pt-4 border-t border-border/60">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Username</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Rishabh"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            className="w-full bg-background border border-border focus:border-primary/50 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors"
                          />
                          {usernameError && (
                            <div className="flex items-center gap-1 text-xs text-status-error font-semibold mt-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{usernameError}</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-primary text-background hover:bg-opacity-95 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-md"
                        >
                          <span>Claim Username & Open Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-12">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
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

export default function G2PPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <G2PContent />
    </Suspense>
  );
}
