"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileText, Search, PlusCircle, Edit3, Copy, Trash2,
  AlertCircle, RefreshCw
} from "lucide-react";

export default function AdminBlogsPage() {
  const { data: session } = useSession();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionMessage, setActionMessage] = useState("");

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const userEmail = session?.user?.email || "";
      const query = new URLSearchParams();
      if (statusFilter !== "all") query.append("status", statusFilter);
      if (search.trim()) query.append("search", search.trim());

      const res = await fetch(`/api/admin/blogs?${query.toString()}`, {
        headers: { "X-Admin-Email": userEmail },
      });
      if (res.ok) {
        const data = await res.json();
        setBlogs(data.blogs || []);
      }
    } catch (err) {
      console.error("Failed to fetch blogs:", err);
    } fontally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      fetchBlogs();
    }
  }, [session, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBlogs();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/blogs/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Email": session?.user?.email || "" },
      });
      if (res.ok) {
        setActionMessage(`Deleted "${title}"`);
        fetchBlogs();
        setTimeout(() => setActionMessage(""), 3000);
      }
    } catch (err) {
      alert("Failed to delete blog.");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blogs/${id}/duplicate`, {
        method: "POST",
        headers: { "X-Admin-Email": session?.user?.email || "" },
      });
      if (res.ok) {
        setActionMessage("Blog duplicated successfully");
        fetchBlogs();
        setTimeout(() => setActionMessage(""), 3000);
      }
    } catch (err) {
      alert("Failed to duplicate blog.");
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#0f1015] tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-purple-600" />
            <span>Blog Articles</span>
          </h1>
          <p className="text-sm font-medium text-[#64748b] mt-1">
            Manage, edit, and publish blogs across share2.me and share2me.in
          </p>
        </div>

        <Link
          href="/admin/blogs/editor"
          className="bg-[#0f1015] text-white font-extrabold px-6 py-3.5 rounded-full hover:bg-[#1f232c] transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] text-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4 text-[#fcd535]" />
          <span>Create New Blog</span>
        </Link>
      </div>

      {/* Notification Toast */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl text-emerald-800 text-xs font-extrabold shadow-sm">
          {actionMessage}
        </div>
      )}

      {/* ── Filter & Search Bar ───────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[32px] p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-full border border-slate-200/80 w-full md:w-auto">
          {[
            { id: "all", label: "All" },
            { id: "draft", label: "Drafts" },
            { id: "published", label: "Published" },
            { id: "failed", label: "Failed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`
                px-5 py-2 rounded-full text-xs font-extrabold transition-all capitalize flex-1 md:flex-none text-center
                ${statusFilter === tab.id
                  ? "bg-[#0f1015] text-white shadow-md"
                  : "text-[#64748b] hover:text-[#0f1015]"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748b] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, slug, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/90 border border-slate-200/80 focus:border-[#0f1015] rounded-full pl-11 pr-4 py-2.5 text-xs text-[#0f1015] placeholder-[#64748b] outline-none transition-colors font-medium shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full bg-[#0f1015] text-white text-xs font-extrabold hover:bg-[#1f232c] transition-all shadow-md"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Blogs Glass Table ─────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center text-[#64748b] text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
            <span>Loading articles...</span>
          </div>
        ) : blogs.length === 0 ? (
          <div className="py-24 text-center text-[#64748b] space-y-3">
            <AlertCircle className="w-9 h-9 text-[#64748b] mx-auto opacity-40" />
            <p className="text-sm font-medium">No blog articles match the current filter.</p>
            <Link
              href="/admin/blogs/editor"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0f1015] text-white font-extrabold text-xs shadow-md"
            >
              Create New Article
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#5c6578]">
              <thead className="bg-slate-100/80 text-xs font-black uppercase tracking-wider text-[#64748b] border-b border-slate-200/80">
                <tr>
                  <th className="py-4 px-6">Title & Details</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Target Domains</th>
                  <th className="py-4 px-4">Last Updated</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {blogs.map((blog) => {
                  const records = Array.isArray(blog.records) ? blog.records : [];

                  return (
                    <tr key={blog.id} className="hover:bg-white/90 transition-colors">
                      
                      {/* Title & Slug */}
                      <td className="py-4 px-6 min-w-[280px]">
                        <div className="space-y-1">
                          <Link
                            href={`/admin/blogs/editor?id=${blog.id}`}
                            className="font-extrabold text-[#0f1015] hover:text-purple-600 transition-colors block text-base"
                          >
                            {blog.title}
                          </Link>
                          <div className="flex items-center gap-2 text-xs font-mono text-[#64748b]">
                            <span>/{blog.slug}</span>
                            <span className="text-[10px] bg-slate-200/80 text-[#0f1015] font-sans font-bold px-2 py-0.5 rounded-full">
                              {blog.category || "General"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          blog.status === "published"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : blog.status === "failed"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            blog.status === "published" ? "bg-emerald-500" : blog.status === "failed" ? "bg-rose-500" : "bg-amber-500"
                          }`} />
                          {blog.status}
                        </span>
                      </td>

                      {/* Destinations */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {records.length === 0 ? (
                            <span className="text-xs text-[#64748b] italic font-medium">Not Published</span>
                          ) : (
                            records.map((r: any, idx: number) => (
                              <span
                                key={idx}
                                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                  r.status === "published"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {r.destination === "share2me_in" ? "share2me.in" : "share2.me"}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-xs whitespace-nowrap text-[#64748b] font-medium">
                        {new Date(blog.updated_at || blog.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/blogs/editor?id=${blog.id}`}
                            className="p-2.5 rounded-2xl bg-white border border-slate-200/80 text-[#0f1015] hover:bg-[#0f1015] hover:text-white transition-colors shadow-xs"
                            title="Edit Article"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleDuplicate(blog.id)}
                            className="p-2.5 rounded-2xl bg-white border border-slate-200/80 text-[#64748b] hover:text-[#0f1015] transition-colors shadow-xs"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(blog.id, blog.title)}
                            className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-colors shadow-xs"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
