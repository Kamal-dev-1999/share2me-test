"use client";

export const dynamic = "force-dynamic";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, PlusCircle, History, ScrollText,
  LogOut, ShieldAlert, Lock, Menu, X, ArrowUpRight
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
    <div className="min-h-screen bg-gradient-to-br from-[#e4daf7] via-[#f3e8fa] to-[#e8d5f5] text-[#0f1015] flex flex-col md:flex-row relative">
      
      {/* ── Desktop Glass Sidebar ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-72 bg-white/70 backdrop-blur-3xl border-r border-white/80 p-6 shrink-0 min-h-screen sticky top-0 justify-between shadow-[10px_0_30px_rgba(0,0,0,0.02)] z-30">
        <div className="space-y-8">
          
          {/* Portal Brand Badge */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-[#0f1015] text-[#fcd535] font-black flex items-center justify-center text-lg shadow-md">
              S2M
            </div>
            <div>
              <div className="font-black text-lg tracking-tight text-[#0f1015]">Share2Me</div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full w-max">
                Admin Portal
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-extrabold text-xs transition-all
                    ${isActive
                      ? "bg-[#0f1015] text-white shadow-lg shadow-black/10 scale-[1.02]"
                      : "text-[#5c6578] hover:bg-white/80 hover:text-[#0f1015]"
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#fcd535]" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

        </div>

        {/* User Profile & Signout */}
        <div className="space-y-4 pt-6 border-t border-slate-200/80">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-2xl bg-purple-200 text-purple-800 font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
              {session.user?.name?.[0] || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-[#0f1015] truncate">{session.user?.name || "Admin"}</div>
              <div className="text-[10px] font-semibold text-[#5c6578] truncate">{session.user?.email}</div>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full bg-white/80 border border-white text-rose-600 hover:bg-rose-50 font-extrabold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Navigation ────────────────────────────────────────── */}
      <div className="md:hidden bg-white/80 backdrop-blur-2xl border-b border-white/90 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0f1015] text-[#fcd535] font-black flex items-center justify-center text-xs shadow-xs">
            S2M
          </div>
          <span className="font-black text-base text-[#0f1015]">Admin Portal</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-white border border-slate-200 text-[#0f1015]"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[65px] bg-white/95 backdrop-blur-3xl border-b border-slate-200 p-6 space-y-4 z-40 shadow-2xl">
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-extrabold text-xs transition-all
                    ${isActive
                      ? "bg-[#0f1015] text-white"
                      : "text-[#5c6578] hover:bg-slate-100 text-[#0f1015]"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full bg-rose-50 text-rose-600 font-extrabold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out ({session.user?.email})</span>
          </button>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        {children}
      </main>

    </div>
  );
}
