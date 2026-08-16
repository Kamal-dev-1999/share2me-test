"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy, Check, Search, Download, Trash2, Calendar,
  ArrowUpDown, FileText, FileImage, Film,
  FolderArchive, LogOut, Volume2, VolumeX,
  Inbox, QrCode, ChevronDown, Eye, Settings, X, HardDrive, ArrowRight, BarChart, User, Loader2,
  CloudDownload, Share2, Activity, Bell, BellOff, CheckCircle2,
  FileCode, FileSpreadsheet, FileAudio, FileQuestion,
  Printer, IndianRupee
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { PrintingSettings } from "@/components/printshop/PrintingSettings";
import { PrintShopPanel } from "@/components/printshop/PrintShopPanel";
import { PaymentsPanel } from "@/components/printshop/PaymentsPanel";
import { PrintJobNotifier } from "@/components/printshop/PrintJobNotifier";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface UserProfile {
  userId: string;
  googleId: string;
  email: string;
  username: string;
  shareCode: string;
  profilePhoto: string;
  createdAt: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: string;
}

interface UploadRecord {
  uploadId: string;
  senderName: string;
  message: string;
  files: UploadedFile[];
  uploadedAt: string;
}

type TabMode = "inbox" | "share" | "settings" | "analytics" | "printshop" | "payments";

const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || process.env.NEXT_PUBLIC_SIGNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://share2me-version-2-0.onrender.com";

function getIconMetadata(mimeType: string, filename: string) {
  const name = filename.toLowerCase();

  if (name.endsWith(".pdf") || mimeType === "application/pdf") {
    return { Icon: FileText, grad: "grad-pdf", label: "PDF" };
  }
  if (name.match(/\.(doc|docx)$/) || mimeType.includes("word")) {
    return { Icon: FileText, grad: "grad-word", label: "DOC" };
  }
  if (name.match(/\.(xls|xlsx|csv)$/) || mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
    return { Icon: FileSpreadsheet, grad: "grad-excel", label: "XLS" };
  }
  if (name.match(/\.(ppt|pptx)$/) || mimeType.includes("presentation")) {
    return { Icon: FileText, grad: "grad-ppt", label: "PPT" };
  }
  if (name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/) || mimeType.startsWith("image/")) {
    const ext = name.split('.').pop()?.toUpperCase().substring(0, 3) || "IMG";
    return { Icon: FileImage, grad: "grad-image", label: ext };
  }
  if (name.match(/\.(mp4|mov|avi|mkv|webm)$/) || mimeType.startsWith("video/")) {
    return { Icon: Film, grad: "grad-video", label: "VID" };
  }
  if (name.match(/\.(mp3|wav|ogg)$/) || mimeType.startsWith("audio/")) {
    return { Icon: FileAudio, grad: "grad-audio", label: "AUD" };
  }
  if (name.match(/\.(zip|rar|7z|tar|gz)$/) || mimeType.includes("zip") || mimeType.includes("compressed")) {
    return { Icon: FolderArchive, grad: "grad-archive", label: "ZIP" };
  }
  if (name.match(/\.(js|ts|html|css|json|jsx|tsx|py|cpp|c|go|rs)$/) || mimeType.includes("json") || mimeType.includes("javascript")) {
    return { Icon: FileCode, grad: "grad-code", label: "CODE" };
  }

  return { Icon: FileQuestion, grad: "grad-default", label: "FILE" };
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// -------------------------------------------------------------
// Expandable Upload Record Component
// -------------------------------------------------------------
function UploadRecordRow({
  record,
  onDelete,
  onAction
}: {
  record: UploadRecord;
  onDelete: (id: string) => void;
  onAction: (file: UploadedFile, action: 'preview' | 'download') => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    for (let i = 0; i < record.files.length; i++) {
      await onAction(record.files[i], 'download');
      if (i < record.files.length - 1) {
        await new Promise(res => setTimeout(res, 600)); // 600ms delay to prevent browser blocking
      }
    }
  };

  const totalSize = record.files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="border-b border-white/20 last:border-0 group/row">
      {/* Row Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1.5fr_2fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center p-3.5 md:p-4 hover:bg-white/10 transition-colors cursor-pointer text-sm"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-xs font-bold text-white shrink-0">
            {record.senderName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[#111827] truncate font-display">{record.senderName}</span>
            {/* Mobile: date tucks under the name instead of its own column */}
            <span className="md:hidden text-[10px] text-[#111827]/60 font-mono">
              {new Date(record.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        </div>

        <div className="hidden md:block text-[#111827]/70 truncate italic text-xs">{record.message || "—"}</div>

        <div>
          <span className="px-2.5 py-1 rounded-full bg-[#111827]/5 border border-[#111827]/10 text-xs font-bold text-[#111827] whitespace-nowrap">
            {record.files.length} file{record.files.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="hidden md:block text-[#111827]/70 font-mono text-xs">{formatSize(totalSize)}</div>

        <div className="hidden md:block text-[#111827]/70 text-xs font-mono">
          {new Date(record.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>

        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleDownloadAll}
            title="Download All"
            className="w-8 h-8 rounded-lg bg-[#111827] text-white flex items-center justify-center hover:bg-black transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(record.uploadId)}
            title="Delete Request"
            className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-[#111827]/50 hover:text-[#111827] transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#111827]/5 border-t border-white/10"
          >
            <div className="p-4 space-y-2">
              {record.files.map((file, idx) => {
                const { Icon, grad, label } = getIconMetadata(file.type, file.name);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/40 border border-white/60 hover:bg-white/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl bg-white/60 flex flex-col items-center shrink-0 shadow-sm border border-white/80 overflow-hidden group/icon">
                        <div className="flex-1 flex items-center justify-center w-full pt-0.5">
                          <Icon
                            className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover/icon:scale-110 group-hover/icon:-translate-y-0.5"
                            style={{ stroke: `url(#${grad})`, filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.15))" }}
                            strokeWidth={2.5}
                          />
                        </div>
                        <div className="w-full h-3.5 bg-[#111827]/[0.03] flex items-center justify-center backdrop-blur-md border-t border-white/60 rounded-b-xl">
                          <span className="text-[8px] font-black text-[#111827]/60 font-mono tracking-wider translate-y-[0.5px]">{label}</span>
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#111827] truncate">{file.name}</span>
                          {file.status === 'downloaded' && (
                            <span title="Viewed / Downloaded">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#111827]/60 font-mono mt-0.5">{formatSize(file.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onAction(file, 'preview'); }} className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center hover:bg-white text-[#111827] shadow-sm">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onAction(file, 'download'); }} className="w-8 h-8 rounded-lg bg-[#111827] flex items-center justify-center hover:bg-black text-white shadow-sm">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------
// Main Dashboard Component
// -------------------------------------------------------------
export default function G2pDashboard({
  user,
  onLogout,
  userRole = null,
}: {
  user: UserProfile;
  onLogout: () => void;
  /** Selected at first login — "shopkeeper" unlocks print/payment features. */
  userRole?: import("@/lib/printShop").UserRole | null;
}) {
  const isShopkeeper = userRole === "shopkeeper";
  const [activeTab, setActiveTab] = useState<TabMode>("inbox");
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vendorCode, setVendorCode] = useState<string>(user.shareCode || "");
  const [displayName, setDisplayName] = useState(user.username);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameUpdateStatus, setNameUpdateStatus] = useState<string | null>(null);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // QR Customization State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Stripe Checkout — creates a subscription session on the backend and
  // redirects the browser to Stripe's hosted payment page.
  const handleUpgradeCheckout = async () => {
    if (!token) {
      alert("Please sign in again to upgrade.");
      return;
    }
    setIsCheckoutLoading(true);
    try {
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // → Stripe hosted checkout
      } else {
        alert(data.error || "Could not start checkout. Please try again.");
        setIsCheckoutLoading(false);
      }
    } catch (err) {
      console.error("[Billing] checkout error:", err);
      alert("Network error while starting checkout.");
      setIsCheckoutLoading(false);
    }
  };
  const [qrFgColor, setQrFgColor] = useState("#fcd535"); // Primary color
  const [qrBgColor, setQrBgColor] = useState("#1e2329"); // Background
  const [qrLogoUrl, setQrLogoUrl] = useState("");
  const [debouncedLogoUrl, setDebouncedLogoUrl] = useState("");

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedFg = localStorage.getItem('g2p_qrFgColor');
    const savedBg = localStorage.getItem('g2p_qrBgColor');
    const savedLogo = localStorage.getItem('g2p_qrLogoUrl');
    if (savedFg) setQrFgColor(savedFg);
    if (savedBg) setQrBgColor(savedBg);
    if (savedLogo) {
      setQrLogoUrl(savedLogo);
      setDebouncedLogoUrl(savedLogo);
    }
  }, []);

  const saveQrSettings = () => {
    localStorage.setItem('g2p_qrFgColor', qrFgColor);
    localStorage.setItem('g2p_qrBgColor', qrBgColor);
    localStorage.setItem('g2p_qrLogoUrl', qrLogoUrl);
    setIsSettingsOpen(false);
  };

  // Debounce the logo URL so we don't spam the QR API while the user is typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLogoUrl(qrLogoUrl);
    }, 800);
    return () => clearTimeout(timer);
  }, [qrLogoUrl]);

  const activeShareCode = vendorCode || user.shareCode || "";

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Chime failed", e);
    }
  }, [soundEnabled]);

  const loadUploads = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/requests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUploads(prev => {
          if (prev.length > 0 && data.length > prev.length) playChime();
          return data;
        });
      }
    } catch (e) {
      console.error("Failed to load uploads", e);
    }
  }, [playChime]);

  const loadAnalytics = useCallback(async (authToken: string) => {
    setIsAnalyticsLoading(true);
    try {
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/analytics`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (e) {
      console.error("Failed to load analytics", e);
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, []);

  const handleUpdateName = async () => {
    if (!token || !displayName.trim()) return;
    setIsUpdatingName(true);
    setNameUpdateStatus(null);
    try {
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/name`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: displayName.trim() })
      });
      if (res.ok) {
        setNameUpdateStatus("Name updated successfully!");
        user.username = displayName.trim();
        setTimeout(() => setNameUpdateStatus(null), 3000);
      } else {
        const data = await res.json();
        setNameUpdateStatus(data.error || "Failed to update name.");
      }
    } catch (e) {
      console.error("Failed to update name", e);
      setNameUpdateStatus("Network error occurred.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const connectSocket = useCallback((authToken: string) => {
    const socket = io(EXPRESS_BACKEND_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("g2p:join_vendor_room", { vendorId: user.userId, authToken });
    });

    socket.on("g2p:new_submission", () => {
      loadUploads(authToken);
      playChime();
    });

    socket.on("g2p:request_removed", ({ requestId }) => {
      setUploads(prev => prev.filter(u => u.uploadId !== requestId));
    });

    socket.on("g2p:file_downloaded", ({ fileId }) => {
      setUploads(prev => prev.map(u => ({
        ...u,
        files: u.files.map(f => f.id === fileId ? { ...f, status: 'downloaded' } : f)
      })));
    });

    socketRef.current = socket;
  }, [user.userId, loadUploads, playChime]);

  useEffect(() => {
    let mounted = true;

    // Fetch token for API and Sockets
    fetch("/api/g2p-token")
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        if (data.token) {
          setToken(data.token);
          loadUploads(data.token);
          connectSocket(data.token);

          // Fetch current vendor profile details to ensure shareCode is always present
          fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/me`, {
            headers: { Authorization: `Bearer ${data.token}` }
          })
            .then(res => res.ok ? res.json() : null)
            .then(profile => {
              if (mounted && profile) {
                if (profile.share2me_id) setVendorCode(profile.share2me_id);
                if (profile.name) setDisplayName(profile.name);
              }
            })
            .catch(err => console.error("Failed to load vendor profile:", err));
        }
      })
      .catch(err => console.error("Failed to get token:", err));

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [connectSocket, loadUploads]);

  useEffect(() => {
    if (activeTab === 'analytics' && token && !analyticsData) {
      loadAnalytics(token);
    }
  }, [activeTab, token, analyticsData, loadAnalytics]);

  const handleDeleteUpload = async (uploadId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/requests/${uploadId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
      }
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleAction = async (file: UploadedFile, action: 'preview' | 'download' = 'download') => {
    if (!token) return;
    try {
      const res = await fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/files/${file.id}/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error(`${action} failed`);
      const data = await res.json();

      const link = document.createElement("a");
      link.href = data.url;

      // If download, the backend already set ResponseContentDisposition=attachment.
      if (action === 'download') {
        link.download = file.name;
      } else {
        link.target = "_blank";
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(`Error ${action}ing file:`, err);
      alert(`Could not ${action} file.`);
    }
  };

  const shareLink = typeof window !== "undefined"
    ? `${window.location.origin}/g2p/${activeShareCode}`
    : `https://share2.me/g2p/${activeShareCode}`;

  const cleanFg = qrFgColor.replace('#', '');
  const cleanBg = qrBgColor.replace('#', '');

  // Only append centerImageUrl if it looks somewhat like a valid URL
  const isValidLogo = debouncedLogoUrl.startsWith("http");
  const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(shareLink)}&size=300&margin=1&dark=${cleanFg}&light=${cleanBg}${isValidLogo ? `&centerImageUrl=${encodeURIComponent(debouncedLogoUrl)}` : ''}`;

  const copyToClipboard = () => {
    if (!activeShareCode) return;
    navigator.clipboard.writeText(activeShareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const processedUploads = uploads
    .filter(u => u.senderName.toLowerCase().includes(searchQuery.toLowerCase()) || (u.message && u.message.toLowerCase().includes(searchQuery.toLowerCase())))
    .sort((a, b) => {
      const timeA = new Date(a.uploadedAt).getTime();
      const timeB = new Date(b.uploadedAt).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

  return (
    <div className="flex flex-col md:flex-row w-full md:h-[calc(100vh-3rem)] text-[#111827] font-sans gap-4 md:gap-6">

      {/* SVG Defs for gradient icons */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          {/* Main Layout Gradients */}
          <linearGradient id="g2p-dash" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#38bdf8" offset="0%" />
            <stop stopColor="#3b82f6" offset="100%" />
          </linearGradient>
          <linearGradient id="g2p-share" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#fde047" offset="0%" />
            <stop stopColor="#f59e0b" offset="100%" />
          </linearGradient>
          <linearGradient id="g2p-settings" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#c084fc" offset="0%" />
            <stop stopColor="#9333ea" offset="100%" />
          </linearGradient>

          {/* File Type Gradients */}
          <linearGradient id="grad-pdf" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#ef4444" offset="0%" /><stop stopColor="#b91c1c" offset="100%" /></linearGradient>
          <linearGradient id="grad-word" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#3b82f6" offset="0%" /><stop stopColor="#1d4ed8" offset="100%" /></linearGradient>
          <linearGradient id="grad-excel" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#22c55e" offset="0%" /><stop stopColor="#15803d" offset="100%" /></linearGradient>
          <linearGradient id="grad-ppt" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#f97316" offset="0%" /><stop stopColor="#c2410c" offset="100%" /></linearGradient>
          <linearGradient id="grad-image" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#a855f7" offset="0%" /><stop stopColor="#7e22ce" offset="100%" /></linearGradient>
          <linearGradient id="grad-video" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#ec4899" offset="0%" /><stop stopColor="#be185d" offset="100%" /></linearGradient>
          <linearGradient id="grad-audio" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#eab308" offset="0%" /><stop stopColor="#a16207" offset="100%" /></linearGradient>
          <linearGradient id="grad-archive" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#f59e0b" offset="0%" /><stop stopColor="#b45309" offset="100%" /></linearGradient>
          <linearGradient id="grad-code" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#06b6d4" offset="0%" /><stop stopColor="#0369a1" offset="100%" /></linearGradient>
          <linearGradient id="grad-default" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#9ca3af" offset="0%" /><stop stopColor="#4b5563" offset="100%" /></linearGradient>
          <linearGradient id="g2p-analytics" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#f472b6" offset="0%" />
            <stop stopColor="#ec4899" offset="100%" />
          </linearGradient>
          <linearGradient id="g2p-alerts" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#f87171" offset="0%" />
            <stop stopColor="#ef4444" offset="100%" />
          </linearGradient>
        </defs>
      </svg>

      {/* Live "X paid ₹Y" toasts + chime for the shopkeeper, on any tab */}
      {isShopkeeper && <PrintJobNotifier soundEnabled={soundEnabled} />}

      {/* SIDEBAR */}
      <aside className="w-full md:w-[280px] shrink-0 flex flex-col gap-3 md:gap-6">
        {/* Profile Info */}
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white/20 backdrop-blur-[32px] border border-white/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
          <img src={user.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="Profile" className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[15px] truncate text-[#111827] leading-tight">{displayName}</span>
            <span className="text-[13px] text-[#111827]/60">Admin</span>
          </div>
          <button
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="ml-auto shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[#111827]/50 hover:text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={2.25} />
          </button>
        </div>

        {/* MOBILE — compact horizontal tab pill (same colors, old-UX layout) */}
        <div className="flex md:hidden items-center justify-around gap-1 p-2 bg-white/20 backdrop-blur-[32px] border border-white/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
          {([
            { tab: "inbox" as TabMode, icon: CloudDownload, grad: "g2p-dash" },
            { tab: "share" as TabMode, icon: Share2, grad: "g2p-share" },
            { tab: "settings" as TabMode, icon: Settings, grad: "g2p-settings" },
            { tab: "analytics" as TabMode, icon: Activity, grad: "g2p-analytics" },
            ...(isShopkeeper
              ? [
                  { tab: "printshop" as TabMode, icon: Printer, grad: "g2p-share" },
                  { tab: "payments" as TabMode, icon: IndianRupee, grad: "g2p-analytics" },
                ]
              : []),
          ]).map(({ tab, icon: TabIcon, grad }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-label={tab}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${activeTab === tab
                  ? "bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)]"
                  : "hover:bg-white/40"
                }`}
            >
              <TabIcon
                className="w-5 h-5"
                style={activeTab === tab ? { stroke: `url(#${grad})`, filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
                strokeWidth={activeTab === tab ? 2.5 : 2}
              />
              {tab === "inbox" && uploads.length > 0 && activeTab !== "inbox" && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          ))}
          <div className="w-px h-6 bg-white/40 mx-0.5" />
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle alerts"
            className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-white/40 transition-all"
          >
            {soundEnabled ? (
              <Bell className="w-5 h-5" style={{ stroke: "url(#g2p-alerts)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" }} strokeWidth={2.5} />
            ) : (
              <BellOff className="w-5 h-5" strokeWidth={2} />
            )}
          </button>
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            aria-label="Pro plan"
            className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-white/40 transition-all"
          >
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#9333ea] text-white text-[10px] font-black flex items-center justify-center">LL</span>
          </button>
        </div>

        {/* Dashboard Button (desktop) */}
        <button
          onClick={() => setActiveTab("inbox")}
          className={`w-full hidden md:flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] ${activeTab === "inbox"
              ? "bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#111827]"
              : "bg-white/20 hover:bg-white/40 text-[#111827] border border-white/30"
            }`}
        >
          <CloudDownload
            className="w-5 h-5 transition-transform duration-300"
            style={activeTab === "inbox" ? { stroke: "url(#g2p-dash)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
            strokeWidth={activeTab === "inbox" ? 2.5 : 2}
          />
          <span>Dashboard</span>
          {uploads.length > 0 && activeTab !== "inbox" && (
            <span className="ml-auto w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm"></span>
          )}
        </button>

        {/* 4-Grid Secondary Menu (desktop) */}
        <div className="hidden md:grid grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => setActiveTab("share")}
            className={`flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] group ${activeTab === "share"
                ? "bg-white/70 border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#111827]"
                : "bg-white/20 hover:bg-white/40 border-white/30 text-[#111827]"
              }`}
          >
            <Share2
              className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
              style={activeTab === "share" ? { stroke: "url(#g2p-share)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
              strokeWidth={activeTab === "share" ? 2.5 : 2}
            />
            <span className="text-[13px] font-bold">Share Portal</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] group ${activeTab === "settings"
                ? "bg-white/70 border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#111827]"
                : "bg-white/20 hover:bg-white/40 border-white/30 text-[#111827]"
              }`}
          >
            <Settings
              className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
              style={activeTab === "settings" ? { stroke: "url(#g2p-settings)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
              strokeWidth={activeTab === "settings" ? 2.5 : 2}
            />
            <span className="text-[13px] font-bold">Settings</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] group ${activeTab === "analytics"
                ? "bg-white/70 border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#111827]"
                : "bg-white/20 hover:bg-white/40 border-white/30 text-[#111827]"
              }`}
          >
            <Activity
              className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
              style={activeTab === "analytics" ? { stroke: "url(#g2p-analytics)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
              strokeWidth={activeTab === "analytics" ? 2.5 : 2}
            />
            <span className="text-[13px] font-bold">Analytics</span>
          </button>

          {isShopkeeper && (
            <>
              <button
                onClick={() => setActiveTab("printshop")}
                className={`flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] group ${activeTab === "printshop"
                    ? "bg-white/70 border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#111827]"
                    : "bg-white/20 hover:bg-white/40 border-white/30 text-[#111827]"
                  }`}
              >
                <Printer
                  className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
                  style={activeTab === "printshop" ? { stroke: "url(#g2p-share)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
                  strokeWidth={activeTab === "printshop" ? 2.5 : 2}
                />
                <span className="text-[13px] font-bold">Print Shop</span>
              </button>

              <button
                onClick={() => setActiveTab("payments")}
                className={`flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] group ${activeTab === "payments"
                    ? "bg-white/70 border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#111827]"
                    : "bg-white/20 hover:bg-white/40 border-white/30 text-[#111827]"
                  }`}
              >
                <IndianRupee
                  className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
                  style={activeTab === "payments" ? { stroke: "url(#g2p-analytics)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" } : undefined}
                  strokeWidth={activeTab === "payments" ? 2.5 : 2}
                />
                <span className="text-[13px] font-bold">Payments</span>
              </button>
            </>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)] bg-white/20 hover:bg-white/40 border-white/30 text-[#111827] group"
          >
            {soundEnabled ? (
              <Bell
                className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
                style={{ stroke: "url(#g2p-alerts)", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.2))" }}
                strokeWidth={2.5}
              />
            ) : (
              <BellOff className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
            )}
            <span className="text-[13px] font-bold">Alerts</span>
          </button>
        </div>

        {/* Pro Plan Banner (desktop — mobile reaches it via the LL pill button) */}
        <div className="mt-auto hidden md:block">
          <button onClick={() => setIsUpgradeModalOpen(true)} className="w-full text-left bg-gradient-to-br from-[#c084fc] to-[#9333ea] text-white rounded-[24px] p-5 relative overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.25)] flex flex-col group hover:scale-[1.02] transition-transform">
            {/* Minimal truck graphic / decoration */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-sm border border-white/30 shrink-0">
                <span className="font-black text-white text-base leading-none">LL</span>
              </div>
              <h4 className="font-bold text-[19px] tracking-tight text-white leading-none">Pro Plan</h4>
            </div>

            <p className="text-xs text-white/90 mb-4 leading-relaxed relative z-10">
              Expedite cargo fleet with real-time tracking
            </p>

            <div className="bg-white/20 backdrop-blur-md text-white px-4 py-2.5 text-xs rounded-xl border border-white/30 font-bold flex items-center justify-between group-hover:bg-white group-hover:text-[#9333ea] transition-colors relative z-10 shadow-inner">
              ₹199/month <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </div>

      </aside>

      {/* MAIN CONTENT AREA */}
      {/* Mobile: no outer shell — the inner card is the single box.
          Desktop: full glass panel as before. */}
      <main className="flex-1 min-w-0 md:bg-white/20 md:backdrop-blur-[32px] md:border md:border-white/30 md:rounded-[32px] p-0 md:p-6 md:shadow-[0_8px_32px_rgba(0,0,0,0.08)] md:overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">

          {/* --- INBOX VIEW --- */}
          {activeTab === "inbox" && (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4 md:gap-6 md:h-full md:min-h-0"
            >
              {/* TOP METRICS BENTO BOXES — desktop only; mobile goes straight to uploads */}
              <div className="hidden md:grid md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white/40 backdrop-blur-[32px] border border-white/60 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[120px]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#111827]/70 font-display">Active Requests</span>
                    <div className="w-8 h-8 rounded-full bg-[#111827]/5 flex items-center justify-center">
                      <Inbox className="w-4 h-4 text-[#111827]" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-[#111827]">{uploads.length}</div>
                </div>

                <div className="bg-white/40 backdrop-blur-[32px] border border-white/60 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[120px]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#111827]/70 font-display">Files Received</span>
                    <div className="w-8 h-8 rounded-full bg-[#111827]/5 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-[#111827]" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-[#111827]">
                    {uploads.reduce((acc, u) => acc + u.files.length, 0)}
                  </div>
                </div>

                <div className="bg-white/40 backdrop-blur-[32px] border border-white/60 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[120px]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#111827]/70 font-display">Storage Used</span>
                    <div className="w-8 h-8 rounded-full bg-[#111827]/5 flex items-center justify-center">
                      <HardDrive className="w-4 h-4 text-[#111827]" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-[#111827]">
                    {formatSize(uploads.reduce((acc, u) => acc + u.files.reduce((sum, f) => sum + f.size, 0), 0))}
                  </div>
                </div>
              </div>

              {/* MAIN DATA TABLE */}
              <div className="bg-white/40 backdrop-blur-[32px] border border-white/60 rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col flex-1 min-h-[calc(100dvh-190px)] md:min-h-0 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                  <h2 className="text-lg font-bold text-[#111827] font-display">Uploads</h2>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-[#111827]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search sender or message..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/50 border border-white/60 rounded-full pl-9 pr-4 py-2 text-sm text-[#111827] placeholder-[#111827]/50 focus:outline-none focus:ring-2 focus:ring-[#111827]/20 transition-all shadow-sm"
                      />
                    </div>
                    <button
                      onClick={() => setSortOrder(prev => prev === "latest" ? "oldest" : "latest")}
                      className="bg-white/50 border border-white/60 hover:bg-white/70 text-sm font-bold text-[#111827] px-4 py-2 rounded-full transition-colors flex items-center gap-2 shrink-0 shadow-sm"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      <span className="hidden sm:inline font-display">{sortOrder === "latest" ? "Latest" : "Oldest"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col flex-1 md:overflow-x-auto md:min-h-0">
                  <div className="md:min-w-[800px] flex flex-col flex-1 md:min-h-0">
                    {/* Table Header — desktop only; mobile rows carry their own labels */}
                    <div className="hidden md:grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr_auto] gap-4 items-center p-4 border-b border-white/30 bg-[#111827]/5 text-xs font-bold text-[#111827]/60 uppercase tracking-wider font-mono">
                      <div>Sender</div>
                      <div>Message</div>
                      <div>Files</div>
                      <div>Total Size</div>
                      <div>Date</div>
                      <div className="text-right pr-2">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex flex-col flex-1 bg-white/20 md:overflow-y-auto md:min-h-0 md:relative">
                      <AnimatePresence mode="popLayout">
                        {processedUploads.map((record) => (
                          <UploadRecordRow
                            key={record.uploadId}
                            record={record}
                            onDelete={handleDeleteUpload}
                            onAction={handleAction}
                          />
                        ))}
                      </AnimatePresence>

                      {processedUploads.length === 0 && (
                        <div className="flex flex-col flex-1 items-center justify-center text-center p-6 md:h-full md:absolute md:inset-0">
                          <div className="w-16 h-16 rounded-2xl bg-white/50 border border-white/60 flex items-center justify-center mb-4 shadow-sm">
                            <Inbox className="w-8 h-8 text-[#111827]/40" />
                          </div>
                          <h3 className="text-lg font-bold text-[#111827] mb-2 font-display">Your inbox is empty</h3>
                          <p className="text-sm text-[#111827]/60 max-w-sm">
                            No one has sent you files yet. Share your portal code with others so they can drop files securely into your inbox.
                          </p>
                          <button
                            onClick={() => setActiveTab("share")}
                            className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#111827] text-white text-[13px] font-semibold hover:bg-black transition-colors shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                          >
                            View your Share Portal
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- SHARE PORTAL VIEW --- */}
          {/* --- SHARE PORTAL VIEW --- */}
          {activeTab === "share" && (
            <motion.div
              key="share"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center gap-6 md:h-full md:min-h-0 md:overflow-y-auto p-4 sm:p-12"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[#111827] font-display">Your Share Portal</h2>
                <p className="text-sm text-[#111827]/60 mt-2 max-w-sm">
                  Scan the QR or share the code — uploads land in your inbox even while you're offline.
                </p>
              </div>

              <div className="bg-white/50 rounded-[32px] border border-white/60 p-6 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt="QR Code" className="w-56 h-56 rounded-2xl border border-white/60" />
              </div>

              <div className="w-full max-w-sm flex items-center bg-white/50 border border-white/60 rounded-2xl p-2 pl-6 shadow-sm">
                <span className="flex-1 text-lg font-bold tracking-[0.2em] text-[#111827] uppercase font-mono">
                  {user.shareCode || activeShareCode || "LOADING..."}
                </span>
                <button
                  onClick={copyToClipboard}
                  disabled={!user.shareCode && !activeShareCode}
                  className="bg-[#111827] text-white hover:bg-black px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </motion.div>
          )}

          {/* --- SETTINGS VIEW --- */}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="md:h-full md:min-h-0 md:overflow-y-auto flex flex-col gap-6"
            >
              <div>
                <h2 className="text-2xl font-bold text-[#111827] font-display">Portal Settings</h2>
                <p className="text-sm text-[#111827]/60">Customize your display name and QR code appearance.</p>
              </div>

              {/* Printing & Payment — shopkeeper role only */}
              {isShopkeeper && <PrintingSettings />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Settings */}
                <div className="bg-white/50 border border-white/60 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-[#111827]">Profile Info</h3>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider font-mono">Display Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        className="flex-1 bg-white/40 border border-white/60 focus:border-[#111827]/50 rounded-xl px-4 py-3 text-sm text-[#111827] outline-none transition-colors"
                      />
                      <button
                        onClick={handleUpdateName}
                        disabled={isUpdatingName || !displayName.trim()}
                        className="bg-[#111827] text-white hover:bg-black px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {isUpdatingName ? "Saving..." : "Save"}
                      </button>
                    </div>
                    {nameUpdateStatus && (
                      <p className={`text-xs font-medium mt-1 ${nameUpdateStatus.includes("successfully") ? "text-green-600" : "text-red-500"}`}>
                        {nameUpdateStatus}
                      </p>
                    )}
                  </div>
                </div>

                {/* QR Settings */}
                <div className="bg-white/50 border border-white/60 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-[#111827]">QR Code Appearance</h3>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider block mb-2 font-mono">Foreground</label>
                      <div className="flex items-center gap-3 bg-white/40 border border-white/60 rounded-xl p-2">
                        <input
                          type="color"
                          value={qrFgColor}
                          onChange={(e) => setQrFgColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-xs text-[#111827]/60 font-mono">{qrFgColor.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider block mb-2 font-mono">Background</label>
                      <div className="flex items-center gap-3 bg-white/40 border border-white/60 rounded-xl p-2">
                        <input
                          type="color"
                          value={qrBgColor}
                          onChange={(e) => setQrBgColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-xs text-[#111827]/60 font-mono">{qrBgColor.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider block mb-2 font-mono">Center Logo URL</label>
                    <input
                      type="text"
                      value={qrLogoUrl}
                      onChange={(e) => setQrLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full bg-white/40 border border-white/60 focus:border-[#111827]/50 rounded-xl px-4 py-3 text-sm text-[#111827] outline-none transition-colors"
                    />
                  </div>

                  <button
                    onClick={saveQrSettings}
                    className="w-full bg-[#111827] hover:bg-black text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm mt-2"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- PRINT SHOP VIEW (shopkeeper only) --- */}
          {activeTab === "printshop" && isShopkeeper && (
            <motion.div
              key="printshop"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6 md:h-full p-4 md:p-6 overflow-y-auto"
            >
              <div>
                <h2 className="text-2xl font-bold text-[#111827] font-display">Print Shop</h2>
                <p className="text-sm text-[#111827]/60">Shared documents, payment status and revenue for your print counter.</p>
              </div>
              <PrintShopPanel />
            </motion.div>
          )}

          {/* --- PAYMENTS VIEW (shopkeeper only) --- */}
          {activeTab === "payments" && isShopkeeper && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6 md:h-full p-4 md:p-6 overflow-y-auto"
            >
              <div>
                <h2 className="text-2xl font-bold text-[#111827] font-display">Payments</h2>
                <p className="text-sm text-[#111827]/60">Every print payment received through your shop QR.</p>
              </div>
              <PaymentsPanel />
            </motion.div>
          )}

          {/* --- ANALYTICS VIEW --- */}
          {activeTab === "analytics" && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6 md:h-full p-4 md:p-6 overflow-y-auto"
            >
              <div>
                <h2 className="text-2xl font-bold text-[#111827] font-display">Analytics Overview</h2>
                <p className="text-sm text-[#111827]/60">Real-time metrics and historical data for your portal.</p>
              </div>

              {isAnalyticsLoading || !analyticsData ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-[#111827] border-t-transparent animate-spin" />
                  <p className="mt-4 text-sm font-bold text-[#111827]/60 font-mono tracking-widest uppercase">Loading Analytics...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* METRIC CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white/50 border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
                      <span className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider font-mono">Total Bandwidth</span>
                      <span className="text-3xl font-black text-[#111827]">{formatSize(analyticsData.overview.totalBandwidth)}</span>
                    </div>
                    <div className="bg-white/50 border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
                      <span className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider font-mono">Total Uploads</span>
                      <span className="text-3xl font-black text-[#111827]">{analyticsData.overview.totalUploads}</span>
                    </div>
                    <div className="bg-white/50 border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
                      <span className="text-xs font-bold text-[#111827]/60 uppercase tracking-wider font-mono">Total Files</span>
                      <span className="text-3xl font-black text-[#111827]">{uploads.reduce((acc, u) => acc + u.files.length, 0)}</span>
                    </div>
                  </div>

                  {/* CHARTS */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[300px]">
                    <div className="lg:col-span-2 bg-white/50 border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col">
                      <h3 className="text-sm font-bold text-[#111827] mb-4 font-display">Uploads Over Time (Last 7 Days)</h3>
                      <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.timeSeries}>
                            <defs>
                              <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#c084fc" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.1)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(str) => str ? new Date(str as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                              stroke="rgba(17,24,39,0.4)"
                              fontSize={12}
                              tickMargin={10}
                            />
                            <YAxis stroke="rgba(17,24,39,0.4)" fontSize={12} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', color: '#111827', fontWeight: 'bold' }}
                              labelFormatter={(label) => label ? new Date(label as string).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''}
                            />
                            <Area type="monotone" dataKey="uploads" stroke="#9333ea" strokeWidth={3} fillOpacity={1} fill="url(#colorUploads)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white/50 border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col">
                      <h3 className="text-sm font-bold text-[#111827] mb-4 font-display">File Types</h3>
                      <div className="flex-1 min-h-[250px] flex items-center justify-center">
                        {analyticsData.fileTypes.length === 0 ? (
                          <span className="text-sm text-[#111827]/50 font-medium">No data available</span>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analyticsData.fileTypes}
                                dataKey="count"
                                nameKey="file_type"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                              >
                                {analyticsData.fileTypes.map((entry: any, index: number) => {
                                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.9)', color: '#111827', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RECENT ACTIVITY */}
                  <div className="bg-white/50 border border-white/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/60">
                      <h3 className="text-sm font-bold text-[#111827] font-display">Recent Activity</h3>
                    </div>
                    <div className="flex flex-col max-h-[300px] overflow-y-auto">
                      {analyticsData.recentActivity.length === 0 ? (
                        <div className="p-8 text-center text-sm text-[#111827]/50">No recent activity found.</div>
                      ) : (
                        analyticsData.recentActivity.map((event: any) => (
                          <div key={event.id} className="flex items-center gap-4 p-4 border-b border-white/30 last:border-0 hover:bg-white/40 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-[#111827]/5 flex items-center justify-center shrink-0">
                              {event.event_type === 'upload_received' ? <CloudDownload className="w-4 h-4 text-[#111827]" /> : <Eye className="w-4 h-4 text-[#111827]" />}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <span className="text-sm font-bold text-[#111827] truncate">
                                {event.sender_name} <span className="text-[#111827]/60 font-medium">{event.event_type === 'upload_received' ? 'sent a file' : 'viewed/downloaded a file'}</span>
                              </span>
                              <span className="text-xs text-[#111827]/60 font-mono mt-0.5 truncate max-w-xs" title={event.file_name || event.file_type}>
                                {event.file_name || event.file_type} • {formatSize(parseInt(event.file_size_bytes, 10))}
                              </span>
                            </div>
                            <div className="text-xs text-[#111827]/50 font-mono shrink-0">
                              {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* --- PRO PLAN UPGRADE MODAL --- */}
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 md:p-8"
          >
            <div className="w-full max-w-4xl relative flex flex-col items-center">
              {/* Close Button */}
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="absolute -top-12 right-0 md:top-0 md:-right-12 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-10">Upgrade Plan</h2>

              <div className="flex flex-col md:flex-row items-stretch gap-6 w-full max-w-3xl">

                {/* Basic Plan */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-8 shadow-2xl flex flex-col relative overflow-hidden"
                >
                  <div className="absolute top-6 right-6">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">Basic</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">$0.00</span>
                  </div>

                  <button className="w-full py-3 px-4 rounded-xl bg-white/10 text-white/50 font-bold mb-8 cursor-not-allowed">
                    Current Plan
                  </button>

                  <div className="flex flex-col gap-4 mt-auto">
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-white/60 shrink-0" />
                      <span className="text-sm text-white/80 leading-relaxed">Standard storage capacity for basic needs.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-white/60 shrink-0" />
                      <span className="text-sm text-white/80 leading-relaxed">Standard file expiration times.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-white/60 shrink-0" />
                      <span className="text-sm text-white/80 leading-relaxed">Basic interface personalization.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-white/60 shrink-0" />
                      <span className="text-sm text-white/80 leading-relaxed">Contains standard advertisements.</span>
                    </div>
                  </div>
                </motion.div>

                {/* Premium Plan */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="flex-1 bg-white/15 backdrop-blur-2xl border border-white/30 rounded-[32px] p-8 shadow-[0_32px_64px_rgba(0,0,0,0.3)] flex flex-col relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#c084fc]/30 to-[#9333ea]/30 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                  <h3 className="text-xl font-bold text-white mb-2 relative z-10">Premium</h3>
                  <div className="mb-6 relative z-10">
                    <span className="text-4xl font-bold text-white">₹199</span>
                    <span className="text-white/60 ml-1">/mo</span>
                  </div>

                  <button
                    onClick={handleUpgradeCheckout}
                    disabled={isCheckoutLoading}
                    className="w-full py-3 px-4 rounded-xl bg-white text-[#111827] hover:bg-white/90 font-bold mb-8 transition-colors shadow-lg relative z-10 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isCheckoutLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isCheckoutLoading ? "Opening Stripe…" : "Upgrade"}
                  </button>

                  <div className="flex flex-col gap-4 mt-auto relative z-10">
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#c084fc] shrink-0" />
                      <span className="text-sm text-white/90 leading-relaxed">No ads for a seamless uninterrupted experience.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#c084fc] shrink-0" />
                      <span className="text-sm text-white/90 leading-relaxed">Significantly more storage capacity for your files.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#c084fc] shrink-0" />
                      <span className="text-sm text-white/90 leading-relaxed">More time before files expire and auto-delete.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#c084fc] shrink-0" />
                      <span className="text-sm text-white/90 leading-relaxed">More personalized options and custom branding.</span>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
