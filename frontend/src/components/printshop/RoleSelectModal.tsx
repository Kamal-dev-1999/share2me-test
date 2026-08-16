"use client";

/**
 * One-time role picker shown right after Google sign-in.
 * Shopkeeper unlocks the printing/payment feature set; Student and
 * Assistant get the standard portal. Choice persists via printShop lib
 * (localStorage in Phase 1; backend column in Phase 2).
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Store, GraduationCap, Users, ArrowRight } from "lucide-react";
import { setRole, type UserRole } from "@/lib/printShop";

const ROLES: {
  role: UserRole;
  icon: typeof Store;
  title: string;
  desc: string;
  grad: [string, string];
}[] = [
  {
    role: "shopkeeper",
    icon: Store,
    title: "Shopkeeper",
    desc: "I run a print shop — I want to receive documents, set printing prices, and collect payments.",
    grad: ["#fcd34d", "#f59e0b"],
  },
  {
    role: "student",
    icon: GraduationCap,
    title: "Student",
    desc: "I want to share and receive files with my personal portal.",
    grad: ["#60a5fa", "#2563eb"],
  },
  {
    role: "assistant",
    icon: Users,
    title: "Assistant",
    desc: "I help manage someone else's portal and incoming files.",
    grad: ["#4ade80", "#059669"],
  },
];

export function RoleSelectModal({ onSelected, account }: {
  onSelected: (role: UserRole) => void;
  /** Google account email — the choice is remembered per account. */
  account?: string | null;
}) {
  const [picked, setPicked] = useState<UserRole | null>(null);

  const confirm = () => {
    if (!picked) return;
    setRole(picked, account);
    onSelected(picked);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#111827]/40 backdrop-blur-sm" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
        className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[28px] p-6 sm:p-8 shadow-[0_32px_80px_rgba(0,0,0,0.3)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
      >
        <h2 id="role-modal-title" className="text-[22px] sm:text-[26px] font-bold text-[#111827] tracking-tight">
          How will you use Share2Me?
        </h2>
        <p className="text-[13px] text-[#111827]/60 mt-1 mb-6">
          This tailors your dashboard. You can change it later in Settings.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          {ROLES.map(({ role, icon: Icon, title, desc, grad }) => {
            const active = picked === role;
            return (
              <button
                key={role}
                onClick={() => setPicked(role)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  active
                    ? "bg-white border-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.12)] scale-[1.02]"
                    : "bg-white/50 border-white/70 hover:bg-white/80"
                }`}
              >
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}
                >
                  <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                </span>
                <div className="font-bold text-[15px] text-[#111827]">{title}</div>
                <p className="text-[12px] text-[#111827]/60 mt-1 leading-relaxed">{desc}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={confirm}
          disabled={!picked}
          className="mt-6 w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 h-11 px-8 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}
