"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { History, FileText, RotateCcw, Clock, RefreshCw, Check } from "lucide-react";

export default function AdminRevisionsPage() {
  const { data: session } = useSession();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string>("");
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Fetch all blogs to populate selector
  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/admin/blogs", {
        headers: { "X-Admin-Email": session.user.email },
      })
        .then((res) => res.json())
        .then((data) => {
          const bList = data.blogs || [];
          setBlogs(bList);
          if (bList.length > 0) setSelectedBlogId(bList[0].id);
        })
        .catch((err) => console.error("Error fetching blogs:", err));
    }
  }, [session]);

  // Fetch revisions when selected blog changes
  useEffect(() => {
    if (selectedBlogId && session?.user?.email) {
      setLoading(true);
      fetch(`/api/admin/blogs/${selectedBlogId}/revisions`, {
        headers: { "X-Admin-Email": session.user.email },
      })
        .then((res) => res.json())
        .then((data) => setRevisions(data.revisions || []))
        .catch((err) => console.error("Error fetching revisions:", err))
        .finally(() => setLoading(false));
    }
  }, [selectedBlogId, session]);

  const handleRestore = async (version: number) => {
    if (!confirm(`Are you sure you want to restore Revision #${version}? This will overwrite the current blog HTML and metadata.`)) return;

    try {
      const res = await fetch(`/api/admin/blogs/${selectedBlogId}/revisions/${version}/restore`, {
        method: "POST",
        headers: { "X-Admin-Email": session?.user?.email || "" },
      });

      if (res.ok) {
        setActionMsg(`Successfully restored Revision #${version}`);
        setTimeout(() => setActionMsg(""), 4000);
      }
    } catch (err) {
      alert("Failed to restore revision.");
    }
  };

  const selectedBlog = blogs.find((b) => b.id === selectedBlogId);

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-[#0f1015] tracking-tight flex items-center gap-3">
          <History className="w-8 h-8 text-purple-600" />
          <span>Blog Revision History</span>
        </h1>
        <p className="text-sm font-medium text-[#64748b] mt-1">
          Review previous snapshots and rollback HTML/metadata versions safely
        </p>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl text-emerald-800 text-xs font-extrabold flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Blog Selector Dropdown */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[32px] p-6 space-y-2 shadow-sm">
        <label className="text-xs font-extrabold text-[#64748b] uppercase tracking-wider">
          Select Article to Inspect Revisions
        </label>
        <select
          value={selectedBlogId}
          onChange={(e) => setSelectedBlogId(e.target.value)}
          className="w-full bg-white border border-slate-200/80 focus:border-[#0f1015] rounded-2xl px-5 py-3.5 text-sm text-[#0f1015] outline-none font-extrabold shadow-xs"
        >
          {blogs.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} (/{b.slug}) — {b.status}
            </option>
          ))}
        </select>
      </div>

      {/* Revisions List */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] p-7 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <h2 className="text-xl font-extrabold text-[#0f1015] flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-purple-600" />
            <span>Revisions for {selectedBlog?.title || "Article"}</span>
          </h2>
          <span className="text-xs font-mono font-bold text-[#64748b] bg-white border border-slate-200/80 px-4 py-1.5 rounded-full shadow-xs">
            {revisions.length} Revision{revisions.length !== 1 ? "s" : ""} Saved
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#64748b] text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
            <span>Loading revisions...</span>
          </div>
        ) : revisions.length === 0 ? (
          <div className="py-16 text-center text-[#64748b] text-sm font-medium">
            No revisions saved for this article yet. Revisions are created automatically whenever a blog is published or saved.
          </div>
        ) : (
          <div className="space-y-4">
            {revisions.map((rev) => (
              <div
                key={rev.id}
                className="p-5 bg-white border border-slate-200/80 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-xs font-mono font-extrabold">
                      Version #{rev.version}
                    </span>
                    <span className="text-xs text-[#64748b] font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(rev.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-[#64748b] font-medium">
                    Saved by: <strong className="text-[#0f1015]">{rev.created_by}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleRestore(rev.version)}
                    className="px-5 py-2.5 rounded-full bg-[#0f1015] text-white hover:bg-[#1f232c] text-xs font-extrabold transition-all flex items-center gap-2 shadow-md hover:scale-[1.02]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#fcd535]" />
                    <span>Restore Version</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
