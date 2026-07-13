"use client";
import { Suspense, useEffect, useState } from "react";
import { TopNav }       from "@/components/TopNav";
import G2pDashboard    from "@/components/G2pDashboard";
import Link from "next/link";
import { ArrowLeft, UserCheck, Sparkles, Send, User, AlertCircle, ArrowRight } from "lucide-react";
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => setGoogleInitialized(true);
      document.body.appendChild(script);
    }
  }, []);

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
          { theme: "filled_black", size: "large", width: 280 }
        );
      } catch (err) {
        console.warn("Google button failed to render:", err);
      }
    }
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
      matched = {
        userId: "usr_" + Math.random().toString(36).substr(2, 9),
        googleId,
        email,
        username: "", 
        shareCode: generateShareCode(),
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
      const newUser: UserProfile = {
        userId: "usr_" + Math.random().toString(36).substr(2, 9),
        googleId: "g_" + Math.random().toString(36).substr(2, 9),
        email: `tester-${Math.floor(Math.random() * 900) + 100}@share2me.dev`,
        username: "",
        shareCode: generateShareCode(),
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
    if (!trimmed) return setUsernameError("Username cannot be empty");
    if (trimmed.length < 3) return setUsernameError("Must be at least 3 characters");

    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    if (users.some(u => u.username.toLowerCase() === trimmed.toLowerCase() && u.userId !== g2pUser?.userId)) {
      return setUsernameError("Username is already taken");
    }

    if (g2pUser) {
      const updatedUser = { ...g2pUser, username: trimmed };
      const updatedUsers = users.map(u => u.userId === g2pUser.userId ? updatedUser : u);
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

          {g2pUser && g2pUser.username ? (
            <G2pDashboard user={g2pUser} onLogout={handleLogout} />
          ) : (
            <div className="w-full">
              <AnimatePresence mode="wait">
                
                {/* 1. AUTHENTICATION VIEW */}
                {!g2pUser && (
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
                        <div id="googleSignInDiv" className="min-h-[44px]" />

                        <div className="w-full flex items-center gap-4 my-2">
                          <div className="flex-1 h-px bg-border"></div>
                          <span className="text-xs text-text-tertiary font-medium">DEVELOPER TOOLS</span>
                          <div className="flex-1 h-px bg-border"></div>
                        </div>

                        <button
                          onClick={() => handleMockLogin(false)}
                          className="w-full py-3 px-4 rounded-xl border border-border bg-background-elevated hover:bg-background hover:border-primary/50 text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Login as Mock User</span>
                        </button>
                        
                        <button
                          onClick={() => handleMockLogin(true)}
                          className="w-full py-3 px-4 rounded-xl border border-border bg-background-elevated hover:bg-background hover:border-primary/50 text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Create Fresh Mock Account</span>
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
                        <p className="text-sm text-text-secondary mt-1">Enter a receiver's Share Code to open their portal.</p>
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
                )}

                {/* 2. ONBOARDING: CHOOSE USERNAME */}
                {g2pUser && !g2pUser.username && (
                  <motion.div
                    key="onboarding"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="max-w-md mx-auto bg-background-card border border-border rounded-2xl p-8 shadow-xl"
                  >
                    <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-6">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    
                    <div className="space-y-2 mb-8">
                      <h2 className="text-xl font-semibold text-text-primary">Choose your Username</h2>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        This name will be visible to senders when they enter your Share Code.
                      </p>
                    </div>

                    <form onSubmit={handleSaveUsername} className="space-y-4">
                      <div className="space-y-2">
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Doe"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          className="w-full bg-background border border-border focus:border-primary/50 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors"
                        />
                        {usernameError && (
                          <div className="flex items-center gap-1.5 text-xs text-status-error font-medium mt-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{usernameError}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-primary text-background hover:bg-primary-hover font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4 shadow-glow"
                      >
                        <span>Complete Setup</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </motion.div>
                )}
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
      <G2PContent />
    </Suspense>
  );
}
