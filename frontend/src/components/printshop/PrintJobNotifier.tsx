"use client";

/**
 * Shopkeeper-side live notifications. Mounted once in the G2P dashboard
 * (shopkeeper role only), independent of which tab is open.
 *
 * Watches the print-jobs store and, whenever a NEW job arrives:
 *   - online:  "Rishabh paid ₹25"  (student says they paid — verify & confirm)
 *   - cash:    "Rishabh will pay ₹25 in cash"
 * plus a two-tone chime (Web Audio — no asset file needed).
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IndianRupee, Banknote, X } from "lucide-react";
import { getPrintJobs, inr, type PrintJob } from "@/lib/printShop";

interface Toast {
  id: string;
  job: PrintJob;
}

function playChime() {
  try {
    type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Audio blocked (no user gesture yet) — the visual toast still shows.
  }
}

export function PrintJobNotifier({ soundEnabled = true, token }: { soundEnabled?: boolean; token: string | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!token) return;
    const check = async () => {
      try {
        const jobs = await getPrintJobs(token);
        // First run: remember what already exists, don't announce old jobs.
        if (!knownIds.current) {
          knownIds.current = new Set(jobs.map((j) => j.id));
          return;
        }
        const fresh = jobs.filter((j) => !knownIds.current!.has(j.id));
      if (fresh.length === 0) return;
      fresh.forEach((j) => knownIds.current!.add(j.id));
      setToasts((t) => [...fresh.map((job) => ({ id: job.id, job })), ...t].slice(0, 4));
      if (soundEnabled) playChime();
      fresh.forEach((job) => {
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== job.id)), 8000);
      });
      } catch {
        // ignore polling errors
      }
    };
    check();
    const t = setInterval(check, 2500);
    return () => clearInterval(t);
  }, [soundEnabled, token]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="fixed top-4 right-4 z-[95] flex flex-col gap-2 w-[min(340px,calc(100vw-2rem))] pointer-events-none">
      <AnimatePresence>
        {toasts.map(({ id, job }) => {
          const cash = job.paymentMethod === "cash";
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                cash ? "bg-gradient-to-br from-[#fbbf24] to-[#d97706]" : "bg-gradient-to-br from-[#34d399] to-[#059669]"
              }`}>
                {cash ? <Banknote className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-[#111827] leading-tight">
                  {cash
                    ? `${job.senderName} will pay ${inr(job.totalAmount)} in cash`
                    : `${job.senderName} paid ${inr(job.totalAmount)}`}
                </p>
                <p className="text-[11px] text-[#111827]/60 mt-0.5 truncate">
                  {job.documentName} · {job.pages} pages · {job.printType === "color" ? "Color" : "B&W"}
                </p>
                <p className="text-[10px] text-[#111827]/45 mt-0.5">
                  {cash ? "Collect cash at pickup, then confirm." : "Check your UPI app, then confirm in Print Shop."}
                </p>
              </div>
              <button onClick={() => dismiss(id)} className="p-1 rounded-lg hover:bg-[#111827]/5 text-[#111827]/40 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
