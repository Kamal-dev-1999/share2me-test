"use client";

/**
 * Shopkeeper's "Print Shop" dashboard tab:
 *  - 6 KPI cards
 *  - Revenue chart
 *  - Job list with payment & print status pills
 *  - Details drawer with document/printing/payment info + status timeline + print config
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle2, Clock, XCircle, IndianRupee, Palette, Printer,
  X, ChevronRight, User, CalendarDays, BadgeCheck, CheckSquare, Printer as PrinterIcon, Download, Key, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getPrintJobs, confirmJobPayment, markJobFailed, markJobPrinted, computeKpis, revenueSeries,
  getAgentPrinters, batchPrint, getAgentToken, updatePrintConfig, filterJobsByRange,
  inr, formatBytes,
  type PrintJob, type RevenueRange, type PrintConfig,
} from "@/lib/printShop";
import { io as socketIO, Socket } from "socket.io-client";

const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || process.env.NEXT_PUBLIC_SIGNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://share2me-version-2-0.onrender.com";

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

export function useJobs(token?: string): [PrintJob[], () => void, boolean, string[], boolean] {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentPrinters, setAgentPrinters] = useState<string[]>([]);
  const [agentOnline, setAgentOnline] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await getPrintJobs(token);
      setJobs(fresh);
      const agentState = await getAgentPrinters(token);
      setAgentPrinters(agentState.printers);
      setAgentOnline(agentState.online);
    } catch (err) { console.error('useJobs ERROR:', err); } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
      { transports: ["websocket", "polling"] }
    );

    socket.on("connect", () => {
      socket.emit("g2p:join_vendor_room", { authToken: token });
    });
    socket.on("printshop:new_job", () => { refresh(); });
    socket.on("printshop:job_updated", (payload: { jobId: string; paymentStatus?: string; paymentId?: string; paidAt?: string; jobStatus?: string; printedAt?: string }) => {
      setJobs((prev) => prev.map((j) => j.id === payload.jobId
        ? {
          ...j,
          paymentStatus: (payload.paymentStatus || j.paymentStatus) as PrintJob["paymentStatus"],
          paymentId: payload.paymentId || j.paymentId,
          paidAt: payload.paidAt || j.paidAt,
          jobStatus: (payload.jobStatus || j.jobStatus) as PrintJob["jobStatus"],
          printedAt: payload.printedAt || j.printedAt
        }
        : j
      ));
    });
    socket.on("printshop:printers_updated", (payload: { printers: string[] }) => {
      setAgentPrinters(payload.printers);
      setAgentOnline(payload.printers.length > 0);
    });
    return () => { socket.disconnect(); };
  }, [token, refresh]);

  return [jobs, refresh, loading, agentPrinters, agentOnline];
}

export function StatusPill({ job }: { job: PrintJob }) {
  if (job.paymentStatus === "failed" || job.jobStatus === "cancelled")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-700 text-[11px] font-bold whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-red-500" /> Failed / Cancelled
      </span>
    );

  if (job.paymentStatus === "paid") {
    if (job.jobStatus === "printed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-700 text-[11px] font-bold whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-indigo-500" /> Printed & Paid
        </span>
      );
    }
    if (job.jobStatus === "queued" || job.jobStatus === "printing") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-700 text-[11px] font-bold whitespace-nowrap">
          <RefreshCw className="w-3 h-3 animate-spin" /> {job.jobStatus === "printing" ? "Printing..." : "Queued"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ready to Print
      </span>
    );
  }

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
    { label: "Total Documents", value: String(k.totalDocuments), icon: FileText, grad: ["#60a5fa", "#2563eb"] },
    { label: "Paid Documents", value: String(k.paidDocuments), icon: CheckCircle2, grad: ["#4ade80", "#059669"] },
    { label: "Pending Payments", value: String(k.pendingPayments), icon: Clock, grad: ["#fcd34d", "#f59e0b"] },
    { label: "Total Revenue", value: inr(k.totalRevenue), icon: IndianRupee, grad: ["#a78bfa", "#7c3aed"] },
    { label: "Color Prints", value: String(k.colorPrints), icon: Palette, grad: ["#f472b6", "#db2777"] },
    { label: "B&W Prints", value: String(k.bwPrints), icon: PrinterIcon, grad: ["#94a3b8", "#475569"] },
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

function RevenueChart({ jobs, range, setRange }: { jobs: PrintJob[], range: RevenueRange, setRange: (r: RevenueRange) => void }) {
  const data = useMemo(() => revenueSeries(jobs, range), [jobs, range]);
  return (
    <div className="bg-white/50 border border-white/70 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-[14px] font-bold text-[#111827]">Revenue</h3>
        <div className="inline-flex bg-white/60 rounded-full p-0.5 border border-white/80">
          {(["daily", "weekly", "monthly", "all_time"] as RevenueRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${range === r ? "bg-[#111827] text-white" : "text-[#111827]/60 hover:text-[#111827]"
                }`}
            >
              {r.replace("_", " ")}
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
  "Print Configured",
  "Payment Initiated",
  "Payment Successful",
  "Printed & Completed",
];

function JobDrawer({ job, onClose, onConfirm, onFail, onPrint, onUpdateConfig }: {
  job: PrintJob; onClose: () => void;
  onConfirm: (id: string) => void; onFail: (id: string) => void;
  onPrint: (id: string) => void;
  onUpdateConfig: (id: string, config: Partial<PrintConfig>) => Promise<void>;
}) {
  let doneCount = 2; // initial
  if (job.printConfig) doneCount = 3;
  if (job.paymentStatus === "pending") doneCount = 4;
  if (job.paymentStatus === "paid") doneCount = 5;
  if (job.jobStatus === "printed") doneCount = 6;

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

  const [editingConfig, setEditingConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState<Partial<PrintConfig>>(job.printConfig || { copies: 1, doubleSided: false, stapling: false, paperSize: 'A4' });
  const [savingConfig, setSavingConfig] = useState(false);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    await onUpdateConfig(job.id, draftConfig);
    setSavingConfig(false);
    setEditingConfig(false);
  };

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

          {job.fileUrl && (
            <a href={job.fileUrl} target="_blank" rel="noreferrer" className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 text-indigo-600 text-[13px] font-bold hover:bg-indigo-100 transition-colors">
              <Download className="w-4 h-4" /> Download Document
            </a>
          )}

          <div className="bg-white/60 border border-white/80 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[12px] font-bold text-[#111827]/60 uppercase tracking-wide">Printing Config</h4>
              {job.jobStatus !== "printed" && (
                <button 
                  onClick={() => editingConfig ? handleSaveConfig() : setEditingConfig(true)}
                  disabled={savingConfig}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded"
                >
                  {savingConfig ? "Saving..." : editingConfig ? "Save" : "Edit"}
                </button>
              )}
            </div>
            
            {editingConfig ? (
              <div className="space-y-2 mt-2">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-[#111827]/60">Copies</span>
                  <input type="number" min={1} max={50} value={draftConfig.copies || 1} onChange={(e) => setDraftConfig(p => ({...p, copies: parseInt(e.target.value)}))} className="w-16 border rounded px-1 py-0.5 text-right" />
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-[#111827]/60">Paper Size</span>
                  <select value={draftConfig.paperSize || 'A4'} onChange={(e) => setDraftConfig(p => ({...p, paperSize: e.target.value as 'A4'|'A3'}))} className="border rounded px-1 py-0.5 text-right bg-white">
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </select>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-[#111827]/60">Double Sided</span>
                  <input type="checkbox" checked={draftConfig.doubleSided || false} onChange={(e) => setDraftConfig(p => ({...p, doubleSided: e.target.checked}))} />
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-[#111827]/60">Stapling</span>
                  <input type="checkbox" checked={draftConfig.stapling || false} onChange={(e) => setDraftConfig(p => ({...p, stapling: e.target.checked}))} />
                </div>
              </div>
            ) : (
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-[13px]"><span className="text-[#111827]/60">Print type</span><span className="font-semibold">{job.printType === "color" ? "Color" : "Black & White"}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-[#111827]/60">Paper Size</span><span className="font-semibold">{job.printConfig?.paperSize ?? "A4"}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-[#111827]/60">Copies</span><span className="font-semibold">{job.printConfig?.copies ?? 1}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-[#111827]/60">Double Sided</span><span className="font-semibold">{job.printConfig?.doubleSided ? "Yes" : "No"}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-[#111827]/60">Stapling</span><span className="font-semibold">{job.printConfig?.stapling ? "Yes" : "No"}</span></div>
              </div>
            )}
          </div>

          <Section title="Payment Information" rows={[
            ["Status", job.paymentStatus.toUpperCase()],
            ["Amount", inr(job.totalAmount)],
            ["Price per page", inr(job.pricePerPage)],
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
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-white" : "bg-[#111827]/10 text-[#111827]/40"
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

        <div className="p-5 border-t border-[#111827]/10 flex flex-col gap-2">
          {job.paymentStatus === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => onConfirm(job.id)} className="flex-1 h-11 rounded-full bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2">
                <BadgeCheck className="w-4 h-4" /> Confirm Payment
              </button>
              <button onClick={() => onFail(job.id)} className="h-11 px-4 rounded-full bg-red-500/10 text-red-600 text-[13px] font-bold hover:bg-red-500 hover:text-white transition-colors">
                Failed
              </button>
            </div>
          )}

          {job.paymentStatus === "paid" && job.jobStatus !== "printed" && (
            <button onClick={() => onPrint(job.id)} className="w-full h-11 rounded-full bg-[#111827] text-white text-[13px] font-bold hover:bg-black transition-colors inline-flex items-center justify-center gap-2">
              <PrinterIcon className="w-4 h-4" /> Mark as Printed
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────

export function PrintShopPanel({ token }: { token: string | null }) {
  const [jobs, refresh, loading, agentPrinters, agentOnline] = useJobs(token || undefined);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState<"Active" | "Completed">("Active");
  const [analyticsRange, setAnalyticsRange] = useState<RevenueRange>("daily");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const toggleBatch = (key: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const displayedJobs = useMemo(() => {
    // Only display jobs that haven't been soft deleted by the 12-hour janitor
    const visibleJobs = jobs.filter(j => !j.deletedAt);
    if (activeTab === "Active") {
      return visibleJobs.filter(j => j.jobStatus !== "printed");
    } else {
      return visibleJobs.filter(j => j.jobStatus === "printed");
    }
  }, [jobs, activeTab]);

  useEffect(() => {
    if (agentPrinters.length > 0 && !selectedPrinter) {
      setSelectedPrinter(agentPrinters[0]);
    }
  }, [agentPrinters, selectedPrinter]);

  const onConfirm = async (id: string) => {
    if (!token) return;
    try { await confirmJobPayment(id, token); refresh(); } catch { }
  };
  const onFail = async (id: string) => {
    if (!token) return;
    try { await markJobFailed(id, token); refresh(); } catch { }
  };
  const onPrint = async (id: string) => {
    if (!token) return;
    try { await markJobPrinted(id, token); refresh(); } catch { }
  };

  const onConfirmBatch = async (ids: string[]) => {
    if (!token) return;
    try {
      await Promise.all(ids.map(id => confirmJobPayment(id, token)));
      refresh();
    } catch { }
  };
  const onPrintBatch = async (ids: string[]) => {
    if (!token) return;
    try {
      await Promise.all(ids.map(id => markJobPrinted(id, token)));
      refresh();
    } catch { }
  };

  const groupedJobs = useMemo(() => {
    const groups: { key: string; jobs: PrintJob[] }[] = [];
    for (const job of displayedJobs) {
      // Use exact timestamp to only group files from the exact same transaction (batch)
      const dateKey = job.createdAt;
      const key = `${job.senderName}_${dateKey}_${job.paymentStatus}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.jobs.push(job);
      } else {
        groups.push({ key, jobs: [job] });
      }
    }
    return groups;
  }, [displayedJobs]);

  const handleSelectJob = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateConfig = async (id: string, config: Partial<PrintConfig>) => {
    if (!token) return;
    try {
      await updatePrintConfig(id, config, token);
      refresh();
    } catch (err) {
      alert("Failed to update config");
    }
  };

  const toggleSelectAll = () => {
    const pendingJobs = displayedJobs.filter(j => j.paymentStatus === 'paid' && j.jobStatus !== 'printed');
    if (selectedJobIds.size === pendingJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(pendingJobs.map(j => j.id)));
    }
  };

  const handleBatchPrint = async () => {
    if (!token || selectedJobIds.size === 0 || !selectedPrinter) return;
    setBatchPrinting(true);
    try {
      await batchPrint(Array.from(selectedJobIds), selectedPrinter, token);
      setSelectedJobIds(new Set());
      refresh();
    } catch (err) {
      alert("Failed to send jobs to printer. Make sure the agent is running.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const fetchAgentToken = async () => {
    if (!token) return;
    try {
      const res = await getAgentToken(token);
      setAgentToken(res.token);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Agent Status Bar */}
      <div className="bg-white/50 border border-white/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full ${agentOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <h3 className="text-[14px] font-bold text-[#111827]">Local Print Agent</h3>
          </div>
          <p className="text-[12px] text-[#111827]/60">
            {agentOnline ? `Connected • ${agentPrinters.length} printers found` : "Offline • Run the agent on your PC to auto-print"}
          </p>
        </div>
        <button
          onClick={() => {
            if (!isAgentMenuOpen) fetchAgentToken();
            setIsAgentMenuOpen(!isAgentMenuOpen);
          }}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 text-[13px] font-bold rounded-xl hover:bg-indigo-100 transition-colors"
        >
          {isAgentMenuOpen ? "Hide Setup" : "Agent Setup"}
        </button>
      </div>

      <AnimatePresence>
        {isAgentMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111827] text-white p-5 rounded-2xl flex flex-col gap-4">
              <h4 className="font-bold text-[14px] flex items-center gap-2"><Key className="w-4 h-4 text-emerald-400" /> Link Print Agent</h4>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[12px] font-bold">1</div>
                <div>
                  <p className="text-[13px] font-medium mb-1">Download & Open the Print Agent</p>
                  <p className="text-[12px] text-white/60 mb-2">Run the agent application on this computer. It will wait for your connection.</p>
                  <a href="/Share2Me-PrintAgent.exe" download className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[13px] font-medium transition-colors border border-white/10">
                    <Download className="w-3.5 h-3.5" /> Download Agent (.exe)
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[12px] font-bold">2</div>
                <div>
                  <p className="text-[13px] font-medium mb-1">Link to Website</p>
                  <p className="text-[12px] text-white/60 mb-3">Once the agent is open, click below to securely connect it.</p>

                  <button
                    onClick={async () => {
                      if (!agentToken) return;
                      try {
                        const res = await fetch('http://127.0.0.1:13337/auth', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ token: agentToken, serverUrl: EXPRESS_BACKEND_URL })
                        });
                        if (res.ok) alert('Agent linked successfully! The terminal should now say Connected.');
                        else alert('Failed to link agent. Make sure it is running!');
                      } catch (err) {
                        alert('Could not connect to the agent. Make sure you opened the .exe first!');
                      }
                    }}
                    disabled={!agentToken}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50"
                  >
                    Connect Agent
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Kpis jobs={filterJobsByRange(jobs, analyticsRange)} />
      <RevenueChart jobs={jobs} range={analyticsRange} setRange={setAnalyticsRange} />

      {/* Shared documents list */}
      <div className="bg-white/50 border border-white/70 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#111827]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[14px] font-bold text-[#111827]">Print Jobs</h3>
            
            <div className="flex bg-[#111827]/5 rounded-lg p-1 ml-4">
              <button 
                onClick={() => setActiveTab("Active")}
                className={`px-3 py-1 text-[12px] font-bold rounded-md transition-colors ${activeTab === "Active" ? "bg-white shadow-sm text-[#111827]" : "text-[#111827]/60 hover:text-[#111827]"}`}
              >
                Active
              </button>
              <button 
                onClick={() => setActiveTab("Completed")}
                className={`px-3 py-1 text-[12px] font-bold rounded-md transition-colors ${activeTab === "Completed" ? "bg-white shadow-sm text-[#111827]" : "text-[#111827]/60 hover:text-[#111827]"}`}
              >
                Completed
              </button>
            </div>
          </div>
          {activeTab === "Active" && (
            <button onClick={toggleSelectAll} className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-800">
              Select All Ready
            </button>
          )}
        </div>
        {selectedJobIds.size > 0 && activeTab === "Active" && (
            <div className="flex items-center gap-2 p-3 border-b border-[#111827]/5 bg-white/40">
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="bg-white border border-[#111827]/10 rounded-lg px-2 py-1.5 text-[12px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[150px]"
              >
                {agentPrinters.map(p => <option key={p} value={p}>{p}</option>)}
                {agentPrinters.length === 0 && <option value="">No printers found</option>}
              </select>
              <button
                onClick={handleBatchPrint}
                disabled={batchPrinting || !selectedPrinter || !agentOnline}
                className="bg-[#111827] text-white text-[12px] font-bold px-4 py-1.5 rounded-lg hover:bg-black disabled:opacity-50 flex items-center gap-2"
              >
                {batchPrinting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PrinterIcon className="w-3.5 h-3.5" />}
                Print Selected ({selectedJobIds.size})
              </button>
            </div>
          )}

        {loading ? (
          <div className="p-10 text-center text-[13px] text-[#111827]/50">
            Loading...
          </div>
        ) : displayedJobs.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[#111827]/50">
            No {activeTab.toLowerCase()} print jobs.
          </div>
        ) : (
          <div className="divide-y divide-[#111827]/5">
            {groupedJobs.map((group) => {
              if (group.jobs.length === 1) {
                const job = group.jobs[0];
                return (
                  <button
                    key={job.id}
                    className={`w-full text-left px-4 py-3.5 transition-colors flex items-center gap-3 ${selectedJobIds.has(job.id) ? 'bg-indigo-50/50' : 'hover:bg-white/40'}`}
                  >
                    {job.paymentStatus === 'paid' && job.jobStatus !== 'printed' && (
                      <div className="shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedJobIds.has(job.id)}
                          onChange={() => handleSelectJob(job.id)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                      </div>
                    )}
                    <div onClick={() => setOpenJobId(job.id)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${job.printType === "color"
                        ? "bg-gradient-to-br from-[#f472b6] to-[#8b5cf6]"
                        : "bg-gradient-to-br from-[#4b5563] to-[#111827]"
                        }`}>
                        {job.printType === "color" ? <Palette className="w-5 h-5 text-white" /> : <PrinterIcon className="w-5 h-5 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-[#111827] truncate">{job.documentName}</p>
                        <p className="text-[12px] text-[#111827]/55 flex items-center gap-1.5 flex-wrap">
                          <User className="w-3 h-3" /> {job.senderName}
                          <span>·</span> {job.pages} pages · {job.printType === "color" ? "Color" : "B&W"} · {inr(job.pricePerPage)}/page
                          {job.printConfig?.copies && job.printConfig.copies > 1 && <span className="font-semibold text-[#111827]">· {job.printConfig.copies} copies</span>}
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${job.paymentMethod === "cash" ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"
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
                            role="button" tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onConfirm(job.id); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onConfirm(job.id); } }}
                            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            <BadgeCheck className="w-3.5 h-3.5" /> Confirm
                          </span>
                        )}
                        {job.paymentStatus === "paid" && job.jobStatus !== "printed" && (
                          <span
                            role="button" tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onPrint(job.id); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onPrint(job.id); } }}
                            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] text-white text-[11px] font-bold hover:bg-black transition-colors cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5" /> Mark Printed
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-[#111827]/30" onClick={() => setOpenJobId(job.id)} />
                      </div>
                    </div>
                  </button>
                );
              }

              // Batch Group
              const firstJob = group.jobs[0];
              const batchTotalAmount = group.jobs.reduce((sum, j) => sum + j.totalAmount, 0);
              
              const isExpanded = expandedBatches.has(group.key);
              
              return (
                <div key={group.key} className="w-full flex flex-col border-b border-[#111827]/5 last:border-b-0 hover:bg-white/20 transition-colors">
                  <div 
                    onClick={() => toggleBatch(group.key)}
                    className="px-4 py-3 bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#111827]/5 cursor-pointer hover:bg-white/60"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                        Batch of {group.jobs.length}
                      </span>
                      <span className="text-[13px] font-bold text-[#111827] flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> {firstJob.senderName}
                      </span>
                      <span className="text-[12px] text-[#111827]/60 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(firstJob.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${firstJob.paymentMethod === "cash" ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"}`}>
                        {firstJob.paymentMethod === "cash" ? "CASH" : "UPI"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                      <span className="text-[13px] font-bold text-[#111827]">
                        Total: {inr(batchTotalAmount)}
                      </span>
                      {firstJob.paymentStatus === "pending" && (
                        <button
                          onClick={() => onConfirmBatch(group.jobs.map(j => j.id))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" /> Confirm All
                        </button>
                      )}
                      {firstJob.paymentStatus === "paid" && firstJob.jobStatus !== "printed" && (
                        <button
                          onClick={() => onPrintBatch(group.jobs.map(j => j.id))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] text-white text-[11px] font-bold hover:bg-black transition-colors"
                        >
                          <CheckSquare className="w-3.5 h-3.5" /> Print All
                        </button>
                      )}
                      <div className="w-px h-5 bg-[#111827]/10 mx-1 hidden sm:block" />
                      <button className="p-1 rounded-md hover:bg-white/50 transition-colors" onClick={() => toggleBatch(group.key)}>
                        <ChevronRight className={`w-5 h-5 text-[#111827]/40 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col divide-y divide-[#111827]/5">
                    {group.jobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => setOpenJobId(job.id)}
                        className={`w-full text-left pl-6 pr-4 py-2.5 transition-colors flex items-center gap-3 ${selectedJobIds.has(job.id) ? 'bg-indigo-50/50' : 'hover:bg-white/60'}`}
                      >
                        {job.paymentStatus === 'paid' && job.jobStatus !== 'printed' && (
                          <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(job.id)}
                              onChange={() => handleSelectJob(job.id)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            />
                          </div>
                        )}
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${job.printType === "color"
                          ? "bg-gradient-to-br from-[#f472b6] to-[#8b5cf6]"
                          : "bg-gradient-to-br from-[#4b5563] to-[#111827]"
                          }`}>
                          {job.printType === "color" ? <Palette className="w-4 h-4 text-white" /> : <PrinterIcon className="w-4 h-4 text-white" />}
                        </span>
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <p className="text-[13px] font-bold text-[#111827] truncate leading-tight">{job.documentName}</p>
                          <p className="text-[11px] text-[#111827]/60 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {job.pages} pages · {job.printType === "color" ? "Color" : "B&W"} · {inr(job.pricePerPage)}/page
                            {job.printConfig?.copies && job.printConfig.copies > 1 && <span className="font-semibold text-[#111827]">· {job.printConfig.copies} copies</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusPill job={job} />
                          <ChevronRight className="w-3 h-3 text-[#111827]/30" />
                        </div>
                      </button>
                    ))}
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>


      <AnimatePresence>
        {openJob && (
          <JobDrawer
            job={openJob}
            onClose={() => setOpenJobId(null)}
            onConfirm={onConfirm}
            onFail={onFail}
            onPrint={onPrint}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </AnimatePresence>

      <span className="sr-only"><XCircle className="w-0 h-0" /></span>
    </div>
  );
}
