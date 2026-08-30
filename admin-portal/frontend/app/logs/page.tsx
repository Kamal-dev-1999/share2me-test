"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ScrollText, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export default function AdminLogsPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs", {
        headers: { "X-Admin-Email": session?.user?.email || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      fetchLogs();
    }
  }, [session]);

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#0f1015] tracking-tight flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-purple-600" />
            <span>Audit Activity Logs</span>
          </h1>
          <p className="text-sm font-medium text-[#64748b] mt-1">
            Complete security and audit log tracking admin actions, targets, and results
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-3 rounded-full bg-white border border-slate-200/80 text-[#0f1015] hover:bg-[#0f1015] hover:text-white transition-colors shadow-xs"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white/80 backdrop-blur-3xl border border-white/90 rounded-[36px] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center text-[#64748b] text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
            <span>Loading audit activity log...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center text-[#64748b] text-sm font-medium">
            No admin activity logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#5c6578]">
              <thead className="bg-slate-100/80 text-xs font-black uppercase tracking-wider text-[#64748b] border-b border-slate-200/80">
                <tr>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-4">Admin Email</th>
                  <th className="py-4 px-4">Action</th>
                  <th className="py-4 px-4">Article Title</th>
                  <th className="py-4 px-4">Target Domain</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 font-mono text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/90 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap text-[#64748b]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-[#0f1015] font-sans font-extrabold">
                      {log.admin_email}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-purple-700 font-extrabold">
                      {log.action}
                    </td>
                    <td className="py-4 px-4 text-[#0f1015] font-sans font-bold max-w-[200px] truncate">
                      {log.blog_title || "N/A"}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-blue-700 font-bold">
                      {log.destination || "N/A"}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-rose-100 text-rose-800 border border-rose-200"
                      }`}>
                        {log.status === "SUCCESS" ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
