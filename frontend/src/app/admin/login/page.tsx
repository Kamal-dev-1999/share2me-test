"use client";

export const dynamic = "force-dynamic";

import { signIn, signOut, useSession } from "next-auth/react";
import { ShieldAlert, ShieldCheck, LogOut, ArrowRight, Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const { data: session, status } = useSession();

  const isAuth = status === "authenticated";
  const userEmail = session?.user?.email;
  const isAuthorized = (session?.user as any)?.adminAuthorized ?? true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e5dbf7] via-[#f4eafc] to-[#e7d7f7] text-[#0f1015] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Ambient Fluid Gradient Mesh Orbs */}
      <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-purple-400/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[15%] w-[500px] h-[500px] bg-emerald-400/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[50%] right-[30%] w-[350px] h-[350px] bg-amber-400/25 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Login Card */}
      <div className="w-full max-w-[460px] bg-white/75 backdrop-blur-3xl border border-white/90 rounded-[40px] p-8 md:p-10 shadow-[0_30px_90px_rgba(31,18,60,0.12)] relative z-10 text-center space-y-7">
        
        {/* Brand Badge */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0f1015] text-[#fcd535] font-black flex items-center justify-center text-xl shadow-lg">
            S2M
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0f1015]/5 border border-[#0f1015]/10 text-[#0f1015] text-xs font-black uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            <span>Private Admin Access</span>
          </div>

          <h1 className="text-3xl font-black text-[#0f1015] tracking-tight pt-2">
            Share2Me <span className="text-purple-600">Admin</span>
          </h1>
          <p className="text-sm text-[#5c6578] font-medium leading-relaxed max-w-sm mx-auto">
            Blog publishing and management portal for share2.me & share2me.in
          </p>
        </div>

        <div className="h-px bg-slate-200/80 w-full my-2" />

        {/* Auth status state */}
        {isAuth ? (
          isAuthorized ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center gap-3.5 text-left shadow-xs">
                <ShieldCheck className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-[#0f1015]">{session.user?.name || "Admin"}</div>
                  <div className="text-xs font-semibold text-[#5c6578]">{userEmail}</div>
                </div>
              </div>

              <Link
                href="/admin"
                className="w-full bg-[#0f1015] text-white font-extrabold py-4 px-6 rounded-full hover:bg-[#1f232c] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] text-sm"
              >
                <span>Enter Admin Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#fcd535]" />
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
                className="w-full bg-white/80 border border-white/90 text-[#5c6578] hover:text-[#0f1015] py-3 px-4 rounded-full text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl text-left space-y-2">
                <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>Access Denied</span>
                </div>
                <p className="text-xs text-[#5c6578] leading-relaxed">
                  Signed in as <strong className="text-[#0f1015]">{userEmail}</strong>, but this Google account is not on the authorized admin allowlist.
                </p>
                <div className="text-xs font-extrabold text-rose-600 pt-1">
                  You are not authorized to access the Admin Portal.
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
                className="w-full bg-rose-600 text-white font-extrabold py-3.5 px-4 rounded-full hover:bg-rose-700 transition-all flex items-center justify-center gap-2 text-xs shadow-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out & Try Another Account</span>
              </button>
            </div>
          )
        ) : (
          <div className="space-y-5">
            <button
              onClick={() => signIn("google", { callbackUrl: "/admin" })}
              className="w-full bg-[#0f1015] text-white font-extrabold py-4 px-6 rounded-full hover:bg-[#1f232c] transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] text-sm group"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <p className="text-xs text-[#5c6578] font-medium leading-relaxed">
              Only authorized Google accounts configured in <code className="text-[#0f1015] font-extrabold bg-white/80 px-2 py-0.5 rounded-full border border-white">AUTHORIZED_ADMIN_EMAILS</code> can access this portal.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200/80 text-center">
          <Link href="/" className="text-xs font-bold text-[#5c6578] hover:text-[#0f1015] transition-colors">
            ← Return to Share2Me Public Website
          </Link>
        </div>

      </div>
    </div>
  );
}
