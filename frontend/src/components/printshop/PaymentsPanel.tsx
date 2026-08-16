"use client";

/**
 * Dashboard → Payments — searchable/filterable payment history for the
 * shopkeeper, with CSV export. Data comes from the shared print-jobs store.
 */

import { useMemo, useState } from "react";
import { Search, Download, Filter } from "lucide-react";
import { inr, type PaymentStatus, type PrintType, type PaymentMethod } from "@/lib/printShop";
import { useJobs, StatusPill } from "./PrintShopPanel";

type StatusFilter = "all" | PaymentStatus;
type TypeFilter = "all" | PrintType;
type MethodFilter = "all" | PaymentMethod;

export function PaymentsPanel({ token }: { token: string | null }) {
  const [jobs] = useJobs(token || undefined);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (status !== "all" && j.paymentStatus !== status) return false;
      if (type !== "all" && j.printType !== type) return false;
      if (method !== "all" && j.paymentMethod !== method) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!j.senderName.toLowerCase().includes(q) &&
            !j.documentName.toLowerCase().includes(q) &&
            !(j.paymentId ?? "").toLowerCase().includes(q)) return false;
      }
      const t = new Date(j.createdAt).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime() + 86_399_000) return false;
      return true;
    });
  }, [jobs, query, status, type, method, from, to]);

  const exportCsv = () => {
    const header = ["User", "Document", "Pages", "Print Type", "Method", "Price/Page", "Amount", "Status", "Payment ID", "Date"];
    const rows = filtered.map((j) => [
      j.senderName, j.documentName, j.pages,
      j.printType === "color" ? "Color" : "B&W",
      j.paymentMethod === "cash" ? "Cash" : "Online (UPI)",
      j.pricePerPage, j.totalAmount, j.paymentStatus,
      j.paymentId ?? "", new Date(j.createdAt).toLocaleString("en-IN"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `share2me-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
      active ? "bg-[#111827] text-white" : "bg-white/60 border border-white/80 text-[#111827]/60 hover:text-[#111827]"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-white/50 border border-white/70 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111827]/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user, document, payment ID…"
              className="w-full bg-white/70 border border-white/80 rounded-full pl-10 pr-4 py-2.5 text-[13px] text-[#111827] focus:outline-none focus:border-[#111827]/30"
            />
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#111827] text-white text-[12px] font-semibold hover:bg-black transition-colors shrink-0"
          >
            <Download className="w-4 h-4" /> Export Payments
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-[#111827]/40" />
          {(["all", "paid", "pending", "failed"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="w-px h-5 bg-[#111827]/10 mx-1" />
          {(["all", "color", "bw"] as TypeFilter[]).map((t) => (
            <button key={t} onClick={() => setType(t)} className={chip(type === t)}>
              {t === "all" ? "All types" : t === "color" ? "Color" : "B&W"}
            </button>
          ))}
          <span className="w-px h-5 bg-[#111827]/10 mx-1" />
          {(["all", "online", "cash"] as MethodFilter[]).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={chip(method === m)}>
              {m === "all" ? "All methods" : m === "online" ? "Online (UPI)" : "Cash"}
            </button>
          ))}
          <span className="w-px h-5 bg-[#111827]/10 mx-1" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-white/70 border border-white/80 rounded-full px-3 py-1.5 text-[11px] text-[#111827]/70 focus:outline-none" aria-label="From date" />
          <span className="text-[11px] text-[#111827]/40">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-white/70 border border-white/80 rounded-full px-3 py-1.5 text-[11px] text-[#111827]/70 focus:outline-none" aria-label="To date" />
        </div>
      </div>

      {/* Table (cards on mobile) */}
      <div className="bg-white/50 border border-white/70 rounded-2xl overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[1.2fr_1.6fr_0.6fr_0.8fr_0.8fr_1fr_1.1fr_1.2fr] gap-3 px-4 py-3 border-b border-[#111827]/10 text-[11px] font-bold text-[#111827]/50 uppercase tracking-wide">
          <span>User</span><span>Document</span><span>Pages</span><span>Type</span>
          <span>Amount</span><span>Status</span><span>Payment ID</span><span>Date</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[#111827]/50">No payments match these filters.</div>
        ) : (
          <div className="divide-y divide-[#111827]/5">
            {filtered.map((j) => (
              <div key={j.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[1.2fr_1.6fr_0.6fr_0.8fr_0.8fr_1fr_1.1fr_1.2fr] gap-1.5 md:gap-3 md:items-center text-[13px]">
                <span className="font-bold text-[#111827]">{j.senderName}</span>
                <span className="text-[#111827]/70 truncate">{j.documentName}</span>
                <span className="text-[#111827]/70"><span className="md:hidden text-[#111827]/40">Pages: </span>{j.pages}</span>
                <span className="text-[#111827]/70">
                  {j.printType === "color" ? "Color" : "B&W"}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    j.paymentMethod === "cash" ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"
                  }`}>{j.paymentMethod === "cash" ? "CASH" : "UPI"}</span>
                </span>
                <span className="font-bold text-[#111827]">{inr(j.totalAmount)}</span>
                <span><StatusPill job={j} /></span>
                <span className="font-mono text-[11px] text-[#111827]/60 truncate">{j.paymentId ?? "—"}</span>
                <span className="text-[12px] text-[#111827]/60">
                  {new Date(j.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
