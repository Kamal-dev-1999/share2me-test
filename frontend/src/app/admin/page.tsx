"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileText, PlusCircle, Globe, History, CheckCircle2,
  Clock, ArrowUpRight, Sparkles, Send, HardDrive,
  Layers, IndianRupee, ShieldCheck, Activity, FileSpreadsheet,
  FileCode, Image as ImageIcon, Store
} from "lucide-react";

function formatBytes(bytes: number | string | null | undefined): string {
  const num = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!num || isNaN(num) || num <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mime: string = "") {
  if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-rose-500" />;
  if (mime.includes("word") || mime.includes("doc")) return <FileText className="w-4 h-4 text-blue-500" />;
  if (mime.includes("image")) return <ImageIcon className="w-4 h-4 text-purple-500" />;
  if (mime.includes("csv") || mime.includes("excel") || mime.includes("sheet")) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  return <FileCode className="w-4 h-4 text-slate-500" />;
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streamTab, setStreamTab] = useState<"g2p" | "p2p">("g2p");

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const userEmail = session?.user?.email || "";
        const headers = { "X-Admin-Email": userEmail };

        const [blogsRes, logsRes, statsRes] = await Promise.all([
          fetch("/api/admin/blogs", { headers }),
          fetch("/api/admin/logs", { headers }),
          fetch("/api/admin/dashboard/stats", { headers }),
        ]);

        if (blogsRes.ok) {
          const data = await blogsRes.json();
          setBlogs(data.blogs || []);
        }
        if (logsRes.ok) {
          const data = await logsRes.json();
          setLogs((data.logs || []).slice(0, 5));
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setPlatformStats(data);
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.email) {
      fetchDashboardData();
    }
  }, [session]);

  const totalBlogs = blogs.length;
  const publishedBlogs = blogs.filter((b) => b.status === "published").length;
  const draftBlogs = blogs.filter((b) => b.status === "draft").length;

  const transfers = platformStats?.transfers || {};
  const p2p = platformStats?.p2p || {};
  const g2p = platformStats?.g2p || {};
  const summary = platformStats?.summary || {};
  const recentTransfers = platformStats?.recentTransfers || [];
  const fileTypes = platformStats?.fileTypes || [];
  const p2pRecent = p2p.recent || [];
  const p2pCategories = p2p.categories || [];

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-7xl mx-auto font-sans">
      
      {/* ── 1. Welcome Banner Card ────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-8 md:p-10 shadow-[0_20px_60px_rgba(31,18,60,0.08)] relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-3 z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0f1015] text-[#fcd535] text-xs font-black uppercase tracking-wider shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Control Center</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-[#0f1015] tracking-tight">
            Welcome back, <span className="text-purple-600">{session?.user?.name || "Admin"}</span>
          </h1>
          <p className="text-sm font-medium text-[#5c6578] max-w-xl leading-relaxed">
            Real-time telemetry across direct WebRTC peer-to-peer transfers, print shop orders, and automated SEO blog publishing.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Link
            href="/admin/blogs/editor"
            className="bg-[#0f1015] text-white font-extrabold px-7 py-4 rounded-full hover:bg-[#1f232c] transition-all flex items-center gap-2 shadow-xl hover:scale-[1.02] text-sm shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-[#fcd535]" />
            <span>Create New Blog</span>
          </Link>
        </div>

        {/* Ambient Gradient Glow */}
        <div className="absolute right-[-10%] top-[-20%] w-80 h-80 bg-purple-300/30 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* ── 2. Platform File Transfers & Storage Telemetry ─────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-black uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live Platform Telemetry</span>
            </div>
            <h2 className="text-2xl font-black text-[#0f1015] tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-purple-600" />
              <span>End-to-End File Transfers & Volume</span>
            </h2>
          </div>
          <p className="text-xs font-semibold text-[#64748b]">
            Direct WebRTC P2P + G2P Print Shop Database Records
          </p>
        </div>

        {/* 4 Transfer KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Total Files Transferred (All Channels) */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Total Files Transferred</span>
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Send className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-[#0f1015]">
              {loading ? "..." : (summary.platformTotalFiles ?? transfers.totalCount ?? 0).toLocaleString()}
            </div>
            <div className="text-xs font-medium text-[#64748b] flex items-center gap-2">
              <span className="inline-flex items-center text-indigo-700 font-bold">
                {(transfers.p2pCount ?? 0).toLocaleString()} P2P
              </span>
              <span>·</span>
              <span className="text-purple-700 font-bold">
                {(transfers.g2pCount ?? 0).toLocaleString()} Print Shop
              </span>
            </div>
          </div>

          {/* Total Data Volume */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Total Volume Moved</span>
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <HardDrive className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-purple-700">
              {loading ? "..." : formatBytes(summary.platformTotalBytes ?? transfers.totalBytes ?? 0)}
            </div>
            <div className="text-xs font-medium text-[#64748b] flex items-center gap-2">
              <span className="text-indigo-700 font-bold">
                {formatBytes(transfers.p2pBytes ?? 0)} P2P
              </span>
              <span>·</span>
              <span className="text-purple-700 font-bold">
                {formatBytes(transfers.g2pBytes ?? 0)} R2
              </span>
            </div>
          </div>

          {/* Direct P2P Network */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Direct P2P Transfers</span>
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-blue-700">
              {loading ? "..." : (transfers.p2pCount ?? 0).toLocaleString()}
            </div>
            <div className="text-xs font-medium text-[#64748b]">
              {formatBytes(transfers.p2pBytes ?? 0)} · Zero-Knowledge WebRTC
            </div>
          </div>

          {/* Revenue & Print Shops */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Print Shop Revenue</span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-emerald-600">
              {loading ? "..." : `₹${(transfers.totalRevenue ?? 0).toFixed(2)}`}
            </div>
            <div className="text-xs font-medium text-[#64748b] flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>{(transfers.totalPages ?? 0).toLocaleString()} pages · {transfers.totalVendors ?? 0} shops</span>
            </div>
          </div>

        </div>

        {/* Channel Breakdown Overview Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-[#0f1015]">P2P Direct Network</div>
                <div className="text-[11px] text-[#64748b]">Browser-to-browser WebRTC encrypted transfers</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-indigo-700">{(transfers.p2pCount ?? 0).toLocaleString()} files</div>
              <div className="text-[11px] font-mono text-slate-500">{formatBytes(transfers.p2pBytes ?? 0)}</div>
            </div>
          </div>

          <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-[#0f1015]">Print Shop (G2P) Ecosystem</div>
                <div className="text-[11px] text-[#64748b]">{transfers.activeShops ?? 0} active shops · {transfers.printedJobs ?? 0} printed</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-purple-700">{(transfers.g2pCount ?? 0).toLocaleString()} jobs</div>
              <div className="text-[11px] font-mono text-emerald-600 font-bold">₹{(transfers.totalRevenue ?? 0).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* File Format Distribution Breakdown */}
        {fileTypes.length > 0 && (
          <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[28px] p-5 shadow-xs space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#64748b] flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-600" />
              <span>File Types & Formats Processed</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {fileTypes.map((ft: any, i: number) => {
                const label = ft.file_type.split("/")[1]?.toUpperCase() || ft.file_type.toUpperCase();
                return (
                  <div
                    key={i}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-bold text-[#0f1015]"
                  >
                    {getFileIcon(ft.file_type)}
                    <span>{label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-[11px] font-black text-purple-700 shadow-2xs">
                      {ft.count} ({formatBytes(ft.bytes)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live File Transfers Table Feed with Tab Switcher */}
        <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-5 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <h3 className="text-lg font-black text-[#0f1015] flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <span>Recent File Transfers Feed</span>
              </h3>
              <p className="text-xs text-[#64748b] font-medium">
                Real-time activity stream of transferred documents
              </p>
            </div>
            <div className="inline-flex items-center p-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setStreamTab("g2p")}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  streamTab === "g2p"
                    ? "bg-[#0f1015] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Print Shop Orders ({(transfers.g2pCount ?? 0)})
              </button>
              <button
                onClick={() => setStreamTab("p2p")}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  streamTab === "p2p"
                    ? "bg-[#0f1015] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Direct P2P Transfers ({(transfers.p2pCount ?? 0)})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-[#64748b] text-sm font-medium">Loading transfer telemetry...</div>
          ) : streamTab === "g2p" ? (
            recentTransfers.length === 0 ? (
              <div className="py-10 text-center text-[#64748b] text-sm font-medium">No print shop transfer records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="border-b border-slate-200/60 text-[#64748b] text-[11px] font-extrabold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Document Name</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Size</th>
                      <th className="pb-3">Pages</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 pr-2 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {recentTransfers.map((job: any) => (
                      <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-[#0f1015] max-w-[220px] truncate">
                          <div className="flex items-center gap-2">
                            {getFileIcon(job.file_type)}
                            <span className="truncate">{job.document_name || "Document"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 font-mono text-slate-600">
                          {job.file_type ? job.file_type.split("/")[1] || job.file_type : "raw"}
                        </td>
                        <td className="py-3.5 font-mono font-bold text-slate-700">
                          {formatBytes(job.file_size_bytes)}
                        </td>
                        <td className="py-3.5 font-bold text-slate-800">
                          {job.pages ?? 1} pg
                        </td>
                        <td className="py-3.5 font-bold text-emerald-700">
                          ₹{parseFloat(job.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            job.job_status === "printed"
                              ? "bg-emerald-100 text-emerald-800"
                              : job.job_status === "failed"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {job.job_status || "queued"}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2 text-right text-slate-500 font-mono text-[11px]">
                          {job.created_at ? new Date(job.created_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            p2pRecent.length === 0 ? (
              <div className="py-10 text-center text-[#64748b] text-sm font-medium">
                No direct P2P transfers logged yet. Newly completed P2P transfers will appear here in real-time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="border-b border-slate-200/60 text-[#64748b] text-[11px] font-extrabold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Transfer ID</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Size</th>
                      <th className="pb-3">Mode</th>
                      <th className="pb-3">Security</th>
                      <th className="pb-3 pr-2 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {p2pRecent.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pl-2 font-mono font-bold text-[#0f1015]">
                          {p.id.slice(0, 8)}…
                        </td>
                        <td className="py-3.5 font-bold uppercase text-indigo-700">
                          {p.file_type_category || "file"}
                        </td>
                        <td className="py-3.5 font-mono font-bold text-slate-700">
                          {formatBytes(p.file_size_bytes)}
                        </td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {p.is_text_mode ? "Text Stream" : "Binary File"}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                            AES-GCM-256
                          </span>
                        </td>
                        <td className="py-3.5 pr-2 text-right text-slate-500 font-mono text-[11px]">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() + " " + new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── 3. Content Publishing & CMS Metrics ────────────────────────────── */}
      <div className="space-y-6">
        <div className="border-b border-slate-200/80 pb-4">
          <h2 className="text-xl font-black text-[#0f1015] tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <span>Content Publishing & Editorial Articles</span>
          </h2>
        </div>

        {/* Blog Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Articles */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Total Articles</span>
              <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-[#0f1015]">{totalBlogs}</div>
            <div className="text-xs font-medium text-[#64748b]">Across all target sites</div>
          </div>

          {/* Published */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Published</span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-emerald-600">{publishedBlogs}</div>
            <div className="text-xs font-medium text-[#64748b]">Live on websites</div>
          </div>

          {/* Drafts */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Drafts</span>
              <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-amber-600">{draftBlogs}</div>
            <div className="text-xs font-medium text-[#64748b]">Work in progress</div>
          </div>

          {/* Target Domains */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[32px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-[#64748b]">
              <span className="text-xs font-extrabold uppercase tracking-wider">Publish Targets</span>
              <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Globe className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-[#0f1015]">2 Domains</div>
            <div className="text-xs font-bold text-purple-700 font-mono">share2.me & share2me.in</div>
          </div>
        </div>

        {/* Recent Blogs & Activity Stream Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Blogs Table */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
              <h3 className="text-lg font-extrabold text-[#0f1015] flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Recent Articles</span>
              </h3>
              <Link
                href="/admin/blogs"
                className="text-xs font-extrabold text-[#0f1015] hover:text-purple-600 flex items-center gap-1 bg-white/90 border border-white px-3 py-1.5 rounded-full shadow-xs"
              >
                <span>View All</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[#64748b] text-sm font-medium">Loading articles...</div>
            ) : blogs.length === 0 ? (
              <div className="py-12 text-center text-[#64748b] space-y-3">
                <p className="text-sm font-medium">No blog articles created yet.</p>
                <Link
                  href="/admin/blogs/editor"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0f1015] text-white font-extrabold text-xs shadow-md"
                >
                  Create First Blog
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {blogs.slice(0, 5).map((blog) => (
                  <div
                    key={blog.id}
                    className="p-4 bg-white/90 border border-white rounded-2xl flex items-center justify-between gap-4 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-sm text-[#0f1015] truncate max-w-md">{blog.title}</span>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          blog.status === "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {blog.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-[#64748b] truncate">
                        /{blog.slug}
                      </div>
                    </div>

                    <Link
                      href={`/admin/blogs/editor?id=${blog.id}`}
                      className="px-4 py-2 rounded-full bg-[#0f1015] text-white hover:bg-[#1f232c] text-xs font-extrabold transition-all shrink-0 shadow-sm"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Activity Stream */}
          <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
              <h3 className="text-lg font-extrabold text-[#0f1015] flex items-center gap-2.5">
                <History className="w-5 h-5 text-blue-600" />
                <span>Activity Log</span>
              </h3>
              <Link
                href="/admin/logs"
                className="text-xs font-extrabold text-[#0f1015] hover:text-blue-600"
              >
                Logs
              </Link>
            </div>

            {logs.length === 0 ? (
              <div className="py-12 text-center text-[#64748b] text-xs font-medium">No activity logged yet.</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-white/90 rounded-2xl border border-white text-xs space-y-1 shadow-xs">
                    <div className="flex items-center justify-between text-[#0f1015] font-extrabold">
                      <span className="truncate max-w-[160px]">{log.action}</span>
                      <span className={`text-[10px] font-black ${log.status === "SUCCESS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-[#64748b] truncate">{log.blog_title || "Blog item"}</div>
                    <div className="text-[10px] text-[#64748b]">
                      {new Date(log.timestamp).toLocaleTimeString()} · {log.admin_email}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
