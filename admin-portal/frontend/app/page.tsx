"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileText, PlusCircle, Globe, History, CheckCircle2,
  Clock, ArrowUpRight, Sparkles
} from "lucide-react";

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const userEmail = session?.user?.email || "";
        const [blogsRes, logsRes] = await Promise.all([
          fetch("/api/admin/blogs", { headers: { "X-Admin-Email": userEmail } }),
          fetch("/api/admin/logs", { headers: { "X-Admin-Email": userEmail } }),
        ]);

        if (blogsRes.ok) {
          const data = await blogsRes.json();
          setBlogs(data.blogs || []);
        }
        if (logsRes.ok) {
          const data = await logsRes.json();
          setLogs((data.logs || []).slice(0, 5));
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

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto font-sans">
      
      {/* ── Welcome Banner Card ───────────────────────────────────────────── */}
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
            Publish HTML blogs directly to <strong className="text-[#0f1015]">share2.me</strong> and <strong className="text-[#0f1015]">share2me.in</strong> with live sandboxed preview and automated SEO validation.
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

      {/* ── Metric Cards Grid ─────────────────────────────────────────────── */}
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

      {/* ── Recent Blogs & Activity Stream ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Blogs Table */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
            <h2 className="text-xl font-extrabold text-[#0f1015] flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-purple-600" />
              <span>Recent Articles</span>
            </h2>
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
            <h2 className="text-xl font-extrabold text-[#0f1015] flex items-center gap-2.5">
              <History className="w-5 h-5 text-blue-600" />
              <span>Activity Log</span>
            </h2>
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
  );
}
