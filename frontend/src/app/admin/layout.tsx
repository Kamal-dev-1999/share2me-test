"use client";

export const dynamic = "force-dynamic";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, PlusCircle, History, ScrollText,
  LogOut, ShieldAlert, ShieldCheck, Lock, ExternalLink, Menu, X, ArrowUpRight
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin",             icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/blogs",        icon: FileText,        label: "Blogs" },
  { href: "/admin/blogs/editor", icon: PlusCircle,      label: "Create Blog" },
  { href: "/admin/revisions",    icon: History,         label: "Revisions" },
  { href: "/admin/logs",         icon: ScrollText,      label: "Publishing Logs" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Skip layout wrap for login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e4daf7] via-[#f3e8fa] to-[#e8d5f5] flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[32px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#0f1015] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-[#0f1015]">Authenticating Admin Session...</span>
        </div>
      </div>
    );
  }

  const isAuthorized = (session?.user as any)?.adminAuthorized ?? true;

  // Unauthenticated guard
  if (status === "unauthenticated" || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e4daf7] via-[#f3e8fa] to-[#e8d5f5] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-8 text-center space-y-6 shadow-[0_30px_90px_rgba(31,18,60,0.12)]">
          <div className="w-16 h-16 bg-[#0f1015] text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-[#0f1015]">Authentication Required</h2>
            <p className="text-sm text-[#5c6578]">
              Log in with an authorized Google account to access the Share2Me Admin Portal.
            </p>
          </div>
          <Link
            href="/admin/login"
            className="block w-full bg-[#0f1015] text-white font-extrabold py-4 px-6 rounded-full hover:bg-[#1f232c] transition-all shadow-xl text-sm"
          >
            Go to Admin Login
          </Link>
        </div>
      </div>
    );
  }

  // Unauthorized guard
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e4daf7] via-[#f3e8fa] to-[#e8d5f5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-3xl border border-rose-200 rounded-[36px] p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-[#0f1015]">Access Denied</h2>
            <p className="text-sm text-rose-600 font-bold">
              You are not authorized to access the Admin Portal.
            </p>
            <p className="text-xs text-[#5c6578]">
              Account: <strong className="text-[#0f1015]">{session.user?.email}</strong> is not on the admin allowlist.
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full bg-[#0f1015] text-white font-extrabold py-3.5 px-6 rounded-full hover:bg-[#1f232c] transition-all flex items-center justify-center gap-2 text-sm shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout & Switch Account</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e5dbf7] via-[#f4eafc] to-[#e7d7f7] text-[#0f1015] font-sans relative overflow-x-hidden p-3 md:p-6 flex flex-col justify-between">
      
      {/* ── Ambient Fluid Gradient Mesh Blobs ──────────────────────────────── */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-400/25 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[550px] h-[550px] bg-emerald-400/20 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="fixed top-[40%] right-[10%] w-[450px] h-[450px] bg-amber-400/20 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="fixed bottom-[20%] left-[10%] w-[450px] h-[450px] bg-blue-400/20 rounded-full blur-[130px] pointer-events-none z-0" />

      {/* ── Main Glassmorphic App Shell Container ─────────────────────────── */}
      <div className="w-full max-w-[1600px] mx-auto bg-white/70 backdrop-blur-3xl border border-white/80 rounded-[36px] shadow-[0_30px_90px_rgba(31,18,60,0.12)] flex flex-col min-h-[92vh] relative z-10 overflow-hidden">
        
        {/* ── Top Glass Navigation Header ───────────────────────────────────── */}
        <header className="h-20 bg-white/60 backdrop-blur-2xl border-b border-white/60 px-6 md:px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#0f1015] p-2 rounded-2xl bg-white/80 shadow-sm"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Brand Logo Badge matching main site */}
            <Link href="/admin" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-[#0f1015] text-[#fcd535] font-black flex items-center justify-center text-lg shadow-md group-hover:scale-105 transition-transform">
                <span className="tracking-tighter">S2M</span>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tight text-[#0f1015] leading-none">
                  Share2Me
                </span>
                <span className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">
                  Admin Portal
                </span>
              </div>
            </Link>
          </div>

          {/* User Profile & Quick Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-white/90 shadow-sm text-xs font-bold text-[#0f1015]">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="truncate max-w-[200px]">{session.user?.email}</span>
            </div>

            <a
              href="https://share2.me"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 border border-white/90 text-xs font-bold text-[#0f1015] hover:bg-white transition-all shadow-sm"
            >
              <span>Live Site</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0f1015] text-white hover:bg-rose-600 transition-all text-xs font-bold shadow-md"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex relative">

          {/* ── Left Sidebar Glass Rail (Matching SideRail) ───────────────── */}
          <aside className={`
            fixed md:static inset-y-0 left-0 z-30 w-64 bg-white/80 backdrop-blur-2xl border-r border-white/60 flex flex-col justify-between py-6 px-4 transition-transform duration-200 ease-in-out
            ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}>
            <div className="space-y-6">
              <div className="px-3 text-[11px] font-extrabold text-[#64748b] uppercase tracking-wider">
                Admin Control
              </div>

              <nav className="space-y-2">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all
                        ${active
                          ? "bg-[#0f1015] text-white shadow-xl scale-[1.02]"
                          : "text-[#475569] hover:text-[#0f1015] hover:bg-white/80 shadow-none"
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-[#fcd535]" : ""}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Target Destinations Card */}
            <div className="p-4 bg-white/70 backdrop-blur-md border border-white/90 rounded-3xl space-y-2.5 shadow-sm text-xs">
              <div className="text-[#64748b] font-extrabold uppercase tracking-wider text-[10px]">
                Target Domains
              </div>
              <div className="flex items-center justify-between text-[#0f1015] font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  share2.me
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-[#0f1015] font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  share2me.in
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            </div>
          </aside>

          {/* Overlay for mobile sidebar */}
          {mobileMenuOpen && (
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs z-20 md:hidden"
            />
          )}

          {/* ── Main Viewport Content ──────────────────────────────────────── */}
          <main className="flex-1 min-w-0 bg-transparent overflow-y-auto">
            {children}
          </main>
        </div>

      </div>
    </div>
  );
}
