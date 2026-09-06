"use client";

/**
 * Shopkeeper-side live notifications. Mounted once in the G2P dashboard
 * (shopkeeper role only), independent of which tab is open.
 *
 * Consolidated notifications for single or multi-file batches (Requirement 6):
 *   - Shows Sender Name, Number of files sent, Total amount
 *   - Triggers exactly ONE audio chime per batch / submission
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IndianRupee, Banknote, Files, FileText, X } from "lucide-react";
import { getPrintJobs, inr, type PrintJob } from "@/lib/printShop";
import { io as socketIO, Socket } from "socket.io-client";

interface BatchToast {
  id: string;
  senderName: string;
  fileCount: number;
  totalAmount: number;
  paymentMethod: "online" | "cash";
  documentNames: string[];
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
    // Audio blocked (no user gesture yet) — visual toast still shows.
  }
}

export function PrintJobNotifier({ soundEnabled = true, token }: { soundEnabled?: boolean; token: string | null }) {
  const [toasts, setToasts] = useState<BatchToast[]>([]);
  const knownJobIds = useRef<Set<string> | null>(null);
  const knownBatchIds = useRef<Set<string>>(new Set());

  const addBatchToast = (toast: BatchToast) => {
    if (knownBatchIds.current.has(toast.id)) return;
    knownBatchIds.current.add(toast.id);

    setToasts(prev => [toast, ...prev].slice(0, 4));
    if (soundEnabled) playChime();

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 9000);
  };

  // Socket-driven real-time notifications
  useEffect(() => {
    if (!token) return;

    const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || process.env.NEXT_PUBLIC_SIGNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://share2me-version-2-0.onrender.com";

    const socket: Socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || EXPRESS_BACKEND_URL,
      { transports: ["websocket", "polling"] }
    );

    socket.on("connect", () => {
      socket.emit("g2p:join_vendor_room", { authToken: token });
    });

    // Consolidated batch event from backend (Requirement 6)
    socket.on("printshop:new_batch", (batch: {
      batchId: string;
      senderName: string;
      fileCount: number;
      totalAmount: number;
      paymentMethod: "online" | "cash";
      jobs: Array<{ documentName: string }>;
    }) => {
      addBatchToast({
        id: batch.batchId || `batch-${Date.now()}-${Math.random()}`,
        senderName: batch.senderName || "Guest",
        fileCount: batch.fileCount || (batch.jobs ? batch.jobs.length : 1),
        totalAmount: batch.totalAmount,
        paymentMethod: batch.paymentMethod,
        documentNames: batch.jobs ? batch.jobs.map(j => j.documentName) : []
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [token, soundEnabled]);

  // Polling fallback (consolidates any new jobs by batch/sender)
  useEffect(() => {
    if (!token) return;

    const check = async () => {
      try {
        const jobs = await getPrintJobs(token);
        if (!knownJobIds.current) {
          knownJobIds.current = new Set(jobs.map((j) => j.id));
          return;
        }

        const fresh = jobs.filter((j) => !knownJobIds.current!.has(j.id));
        if (fresh.length === 0) return;

        fresh.forEach((j) => knownJobIds.current!.add(j.id));

        // Group fresh jobs by batchId or senderName to avoid duplicate notifications
        const grouped = new Map<string, PrintJob[]>();
        for (const j of fresh) {
          const key = j.batchId || `${j.senderName}-${j.paymentMethod}-${Math.floor(new Date(j.createdAt).getTime() / 15000)}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(j);
        }

        for (const [key, groupJobs] of Array.from(grouped.entries())) {
          if (knownBatchIds.current.has(key)) continue;
          const first = groupJobs[0];
          const totalAmt = groupJobs.reduce((sum, j) => sum + j.totalAmount, 0);

          addBatchToast({
            id: key,
            senderName: first.senderName || "Guest",
            fileCount: groupJobs.length,
            totalAmount: totalAmt,
            paymentMethod: first.paymentMethod,
            documentNames: groupJobs.map(j => j.documentName)
          });
        }
      } catch {
        // ignore polling errors
      }
    };

    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, [soundEnabled, token]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="fixed top-4 right-4 z-[95] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
      <AnimatePresence>
        {toasts.map(({ id, senderName, fileCount, totalAmount, paymentMethod, documentNames }) => {
          const cash = paymentMethod === "cash";
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-[#111827]/5"
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                cash ? "bg-gradient-to-br from-[#fbbf24] to-[#d97706]" : "bg-gradient-to-br from-[#34d399] to-[#059669]"
              }`}>
                {fileCount > 1 ? <Files className="w-5 h-5" /> : (cash ? <Banknote className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-[#111827] leading-tight">
                  {cash
                    ? `${senderName} will pay ${inr(totalAmount)} cash`
                    : `${senderName} sent payment of ${inr(totalAmount)}`}
                </p>
                <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                  {fileCount} {fileCount === 1 ? "document" : "documents"} sent
                  {documentNames.length > 0 && ` (${documentNames.slice(0, 2).join(", ")}${documentNames.length > 2 ? "..." : ""})`}
                </p>
                <p className="text-[10px] text-[#111827]/50 mt-0.5">
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
