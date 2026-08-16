"use client";

/**
 * Shopkeeper's "Print Shop" dashboard tab:
 *  - 6 KPI cards (docs, paid, pending, revenue, color, b&w)
 *  - Revenue chart (daily / weekly / monthly) — recharts
 *  - Job list with payment status pills + "Confirm payment received"
 *  - Details drawer with document/printing/payment info + status timeline
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  FileText, CheckCircle2, Clock, XCircle, IndianRupee, Palette, Printer,
  X, ChevronRight, User, CalendarDays, BadgeCheck,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getPrintJobs, confirmJobPayment, markJobFailed, computeKpis, revenueSeries,
  inr, formatBytes,
  type PrintJob, type RevenueRange,
} from "@/lib/printShop";
import { io as socketIO, Socket } from "socket.io-client";

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

export function useJobs(token?: string): [PrintJob[], () => void, boolean] {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await getPrintJobs(token);
      setJobs(fresh);
    } catch { /* ignore, keep stale data */ } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => { refresh(); }, [refresh]);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!token) return;
    const socket: Socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
      { transports: ["websocket", "polling"] }
    );
    socket.on("printshop:new_job", () => { refresh(); });
    socket.on("printshop:job_updated", (payload: { jobId: string; paymentStatus: string; paymentId?: string; paidAt?: string }) => {
      setJobs((prev) => prev.map((j) => j.id === payload.jobId
        ? { ...j, paymentStatus: payload.paymentStatus as PrintJob["paymentStatus"], paymentId: payload.paymentId ?? j.paymentId, paidAt: payload.paidAt ?? j.paidAt }
        : j
      ));
    });
    return () => { socket.disconnect(); };
  }, [token, refresh]);

  return [jobs, refresh, loading];
}

export function StatusPill({ job }: { job: PrintJob }) {
  if (job.paymentStatus === "paid")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-500" /> {inr(job.totalAmount)} Paid
      </span>
    );
  if (job.paymentStatus === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-700 text-[11px] font-bold whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-red-500" /> Payment Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-700 text-[11px] font-bold whitespace-nowrap">
      <span className="w-2 h-2 rounded-full bg-orange-500" /> {inr(job.totalAmount)} Pending
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI cards
// ─────────────────────────────────────────────────────────────

function Kpis({ jobs }: { jobs: PrintJob[] }) {
  const k = computeKpis(jobs);
  const cards = [
    { label: "Total Documents",  value: String(k.totalDocuments),  icon: FileText,     grad: ["#60a5fa", "#2563eb"] },
    { label: "Paid Documents",   value: String(k.paidDocuments),   icon: CheckCircle2, grad: ["#4ade80", "#059669"] },
    { label: "Pending Payments", value: String(k.pendingPayments), icon: Clock,        grad: ["#fcd34d", "#f59e0b"] },
    { label: "Total Revenue",    value: inr(k.totalRevenue),       icon: IndianRupee,  grad: ["#a78bfa", "#7c3aed"] },
    { label: "Color Prints",     value: String(k.colorPrints),     icon: Palette,      grad: ["#f472b6", "#db2777"] },
    { label: "B&W Prints",       value: String(k.bwPrints),        icon: Printer,      grad: ["#94a3b8", "#475569"] },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map(({ label, value, icon: Icon, grad }) => (
        <div key={label} className="bg-white/50 border border-white/70 rounded-2xl p-3.5 flex flex-col gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
            <Icon className="w-4 h-4 text-white" />
          </span>
          <div className="text-[19px] font-extrabold text-[#111827] leading-none">{value}</div>
          <div className="text-[11px] font-semibold text-[#111827]/55">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Revenue chart
// ─────────────────────────────────────────────────────────────

function RevenueChart({ jobs }: { jobs: PrintJob[] }) {
  const [range, setRange] = useState<RevenueRange>("daily");
  const data = useMemo(() => revenueSeries(jobs, range), [jobs, range]);
  return (
    <div className="bg-white/50 border border-white/70 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-[14px] font-bold text-[#111827]">Revenue</h3>
        <div className="inline-flex bg-white/60 rounded-full p-0.5 border border-white/80">
          {(["daily", "weekly", "monthly"] as RevenueRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
                range === r ? "bg-[#111827] text-white" : "text-[#111827]/60 hover:text-[#111827]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(17,24,39,0.5)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(17,24,39,0.5)" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [inr(Number(v ?? 0)), "Revenue"]}
              contentStyle={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.95)", fontSize: 12 }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5} fill="url(#rev-fill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Details drawer
// ─────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  "Document Uploaded",
  "Pages Calculated",
  "Print Type Selected",
  "Payment Initiated",
  "Payment Successful",
  "Ready for Printing",
];

function JobDrawer({ job, onClose, onConfirm, onFail }: {
  job: PrintJob; onClose: () => void;
  onConfirm: (id: string) => void; onFail: (id: string) => void;
}) {
  // First 4 steps complete on submission; 5–6 complete once paid.
  const doneCount = job.paymentStatus === "paid" ? 6 : 4;

  const Section = ({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) => (
    <div className="bg-white/60 border border-white/80 rounded-2xl p-4">
      <h4 className="text-[12px] font-bold text-[#111827]/60 uppercase tracking-wide mb-2">{title}</h4>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-1 text-[13px]">
          <span className="text-[#111827]/60">{k}</span>
          <span className="font-semibold text-[#111827] text-right">{v}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#111827]/30 backdrop-blur-sm z-[80]" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-full sm:w-[420px] z-[81] bg-white/80 backdrop-blur-2xl border-l border-white/70 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-[#111827]/10">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-[#111827] truncate">{job.documentName}</h3>
            <StatusPill job={job} />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/70 text-[#111827]/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Section title="Document Information" rows={[
            ["Document", job.documentName],
            ["File type", job.fileType.split("/").pop()?.toUpperCase() ?? "—"],
            ["File size", formatBytes(job.fileSizeBytes)],
            ["Pages", String(job.pages)],
            ["Uploaded by", job.senderName],
            ["Uploaded", new Date(job.createdAt).toLocaleString("en-IN")],
          ]} />

          <Section title="Printing Information" rows={[
            ["Print type", job.printType === "color" ? "Color" : "Black & White"],
            ["Price per page", inr(job.pricePerPage)],
            ["Total pages", String(job.pages)],
            ["Total amount", <b key="t">{inr(job.totalAmount)}</b>],
          ]} />

          <Section title="Payment Information" rows={[
            ["Status", job.paymentStatus.toUpperCase()],
            ["Amount", inr(job.totalAmount)],
            ["Payment ID", job.paymentId ?? "—"],
            ["Method", job.paymentMethod === "cash" ? "Cash at counter" : "UPI QR"],
            ["Timestamp", job.paidAt ? new Date(job.paidAt).toLocaleString("en-IN") : "—"],
          ]} />

          {/* Timeline */}
          <div className="bg-white/60 border border-white/80 rounded-2xl p-4">
            <h4 className="text-[12px] font-bold text-[#111827]/60 uppercase tracking-wide mb-3">Status Timeline</h4>
            <div className="flex flex-col">
              {TIMELINE_STEPS.map((label, i) => {
                const done = i < doneCount;
                return (
                  <div key={label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        done ? "bg-emerald-500 text-white" : "bg-[#111827]/10 text-[#111827]/40"
                      }`}>
                        {done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </span>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <span className={`w-px h-5 ${i < doneCount - 1 ? "bg-emerald-400" : "bg-[#111827]/10"}`} />
                      )}
                    </div>
                    <span className={`text-[13px] pb-3 ${done ? "font-semibold text-[#111827]" : "text-[#111827]/40"}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {job.paymentStatus === "pending" && (
          <div className="p-5 border-t border-[#111827]/10 flex gap-2">
            <button
              onClick={() => onConfirm(job.id)}
              className="flex-1 h-11 rounded-full bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              <BadgeCheck className="w-4 h-4" /> Confirm payment received
            </button>
            <button
              onClick={() => onFail(job.id)}
              className="h-11 px-4 rounded-full bg-red-500/10 text-red-600 text-[13px] font-bold hover:bg-red-500 hover:text-white transition-colors"
            >
              Failed
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────

export function PrintShopPanel() {
  const { data: session } = useSession();
  const token = (session as { backendToken?: string })?.backendToken;
  const [jobs, refresh, loading] = useJobs(token);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  const confirm = async (id: string) => {
    if (!token) return;
    try { await confirmJobPayment(id, token); } catch { /* real-time update via socket handles UI */ }
  };
  const fail = async (id: string) => {
    if (!token) return;
    try { await markJobFailed(id, token); } catch { /* real-time update via socket handles UI */ }
  };

  return (
    <div className="flex flex-col gap-4">
      <Kpis jobs={jobs} />
      <RevenueChart jobs={jobs} />

      {/* Shared documents list */}
      <div className="bg-white/50 border border-white/70 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#111827]/10">
          <h3 className="text-[14px] font-bold text-[#111827]">Shared Documents</h3>
        </div>

        {jobs.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[#111827]/50">
            No print jobs yet — documents submitted through your portal QR will appear here.
          </div>
        ) : (
          <div className="divide-y divide-[#111827]/5">
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setOpenJobId(job.id)}
                className="w-full text-left px-4 py-3.5 hover:bg-white/40 transition-colors flex items-center gap-3"
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  job.printType === "color"
                    ? "bg-gradient-to-br from-[#f472b6] to-[#8b5cf6]"
                    : "bg-gradient-to-br from-[#4b5563] to-[#111827]"
                }`}>
                  {job.printType === "color" ? <Palette className="w-5 h-5 text-white" /> : <Printer className="w-5 h-5 text-white" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#111827] truncate">{job.documentName}</p>
                  <p className="text-[12px] text-[#111827]/55 flex items-center gap-1.5 flex-wrap">
                    <User className="w-3 h-3" /> {job.senderName}
                    <span>·</span> {job.pages} pages · {job.printType === "color" ? "Color" : "B&W"} · {inr(job.pricePerPage)}/page
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      job.paymentMethod === "cash" ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"
                    }`}>{job.paymentMethod === "cash" ? "CASH" : "UPI"}</span>
                    <span className="hidden sm:inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />
                      {new Date(job.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill job={job} />
                  {job.paymentStatus === "pending" && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); confirm(job.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); confirm(job.id); } }}
                      className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" /> Confirm
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#111827]/30" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {openJob && (
          <JobDrawer
            job={openJob}
            onClose={() => setOpenJobId(null)}
            onConfirm={(id) => { confirm(id); }}
            onFail={(id) => { fail(id); }}
          />
        )}
      </AnimatePresence>

      {/* Failed marker icon kept for a11y completeness */}
      <span className="sr-only"><XCircle className="w-0 h-0" /></span>
    </div>
  );
}
