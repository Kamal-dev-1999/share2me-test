"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy, Check, Search, Download, Trash2, Calendar,
  ArrowUpDown, FileText, FileImage, Film,
  FolderArchive, LogOut, Volume2, VolumeX,
  Inbox, QrCode, ChevronDown, Eye, Settings, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";

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

type TabMode = "inbox" | "share";

const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return Film;
  if (type.includes("zip") || type.includes("rar")) return FolderArchive;
  return FileText;
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
function UploadRecordItem({
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-background-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors shadow-sm overflow-hidden"
    >
      {/* HEADER (Always Visible) */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shadow-glow shrink-0 transition-transform group-hover:scale-105">
            {record.senderName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors">{record.senderName}</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-bold text-text-secondary tracking-wider uppercase">
                {record.files.length} file{record.files.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs font-medium text-text-tertiary mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(record.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-16 sm:ml-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-background border border-primary/20 hover:border-primary text-sm font-bold transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download All</span>
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(record.uploadId); }}
            className="p-2.5 rounded-xl border border-border text-text-tertiary hover:text-status-error hover:bg-status-error/10 hover:border-status-error/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
          
          <button className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-elevated transition-colors">
             <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* EXPANDED CONTENT (Message & File List) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-5 border-t border-border">
              {record.message && (
                <div className="mb-5 pl-4 border-l-2 border-primary/40 text-sm text-text-secondary leading-relaxed italic bg-background/50 py-2 rounded-r-lg">
                  &quot;{record.message}&quot;
                </div>
              )}

              <div className="space-y-2">
                {record.files.map((file, idx) => {
                  const Icon = getFileIcon(file.type);
                  return (
                    <div
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); onAction(file, 'preview'); }}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background hover:bg-background-elevated hover:border-primary/40 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-background-elevated border border-border flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                          <Icon className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">{file.name}</span>
                          <span className="text-xs text-text-tertiary mt-1">{formatSize(file.size)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAction(file, 'preview'); }}
                          title="Preview"
                          className="w-9 h-9 rounded-full bg-background-elevated border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-colors shadow-sm"
                        >
                          <Eye className="w-4 h-4 text-text-secondary hover:text-primary transition-colors" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAction(file, 'download'); }}
                          title="Download"
                          className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary group/btn transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4 text-primary group-hover/btn:text-background transition-colors" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// -------------------------------------------------------------
// Main Dashboard Component
// -------------------------------------------------------------
export default function G2pDashboard({
  user,
  onLogout
}: {
  user: UserProfile;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabMode>("inbox");
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user.username);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameUpdateStatus, setNameUpdateStatus] = useState<string | null>(null);
  
  // QR Customization State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
        }
      })
      .catch(err => console.error("Failed to get token:", err));

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [connectSocket, loadUploads]);

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
    ? `${window.location.origin}/g2p/${user.shareCode}`
    : `https://share2.me/g2p/${user.shareCode}`;

  const cleanFg = qrFgColor.replace('#', '');
  const cleanBg = qrBgColor.replace('#', '');
  
  // Only append centerImageUrl if it looks somewhat like a valid URL
  const isValidLogo = debouncedLogoUrl.startsWith("http");
  const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(shareLink)}&size=300&margin=1&dark=${cleanFg}&light=${cleanBg}${isValidLogo ? `&centerImageUrl=${encodeURIComponent(debouncedLogoUrl)}` : ''}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(user.shareCode);
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
    <div className="flex gap-4 sm:gap-6 text-text-primary font-sans relative">
      
      {/* LEFT FLOATING NAVIGATION PILL */}
      <div className="sticky top-24 shrink-0 flex flex-col items-center gap-3 bg-background-elevated/90 backdrop-blur-md border border-border rounded-full p-2.5 shadow-xl h-fit z-20">
        
        {/* Inbox Tab */}
        <button
          onClick={() => setActiveTab("inbox")}
          title="Inbox"
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === "inbox" ? "bg-primary text-background shadow-glow" : "text-text-tertiary hover:bg-background-card hover:text-primary"
          }`}
        >
          <Inbox className="w-5 h-5" />
          {uploads.length > 0 && activeTab !== "inbox" && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-primary border-2 border-background-elevated rounded-full"></span>
          )}
        </button>

        {/* Share/QR Tab */}
        <button
          onClick={() => setActiveTab("share")}
          title="Share Portal"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === "share" ? "bg-primary text-background shadow-glow" : "text-text-tertiary hover:bg-background-card hover:text-primary"
          }`}
        >
          <QrCode className="w-5 h-5" />
        </button>

        <div className="w-6 h-px bg-border my-1" />

        {/* Settings / Utilities */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Mute Alerts" : "Enable Alerts"}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 text-text-tertiary hover:bg-background-card hover:text-primary"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        <button
          onClick={onLogout}
          title="Logout"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 text-status-error hover:bg-status-error/10 hover:shadow-[0_0_15px_rgba(246,70,93,0.2)]"
        >
          <LogOut className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          
          {/* --- INBOX VIEW --- */}
          {activeTab === "inbox" && (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-background-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm h-full min-h-[500px]"
            >
              <div className="p-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background-card">
                <div className="flex items-center gap-3 text-text-primary font-semibold">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg leading-tight">Received Files</h2>
                    <p className="text-xs text-text-tertiary font-normal mt-0.5">{uploads.length} active requests</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search sender or message..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => setSortOrder(prev => prev === "latest" ? "oldest" : "latest")}
                    className="bg-background border border-border hover:bg-background-elevated hover:text-primary text-sm font-medium text-text-secondary px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="hidden sm:inline">{sortOrder === "latest" ? "Latest First" : "Oldest First"}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {processedUploads.map((record) => (
                      <UploadRecordItem 
                        key={record.uploadId} 
                        record={record} 
                        onDelete={handleDeleteUpload} 
                        onAction={handleAction}
                      />
                    ))}
                  </AnimatePresence>

                  {processedUploads.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
                      <div className="w-20 h-20 rounded-3xl bg-background-elevated border border-border flex items-center justify-center mb-6">
                        <Inbox className="w-10 h-10 text-text-tertiary" />
                      </div>
                      <h3 className="text-xl font-semibold text-text-primary mb-3">Your inbox is empty</h3>
                      <p className="text-sm text-text-tertiary max-w-sm leading-relaxed">
                        No one has sent you files yet. Share your portal code with others so they can drop files securely into your inbox.
                      </p>
                      <button 
                        onClick={() => setActiveTab("share")}
                        className="mt-8 text-primary font-medium hover:text-primary-hover flex items-center gap-2"
                      >
                        View your Share Portal <ArrowUpDown className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* --- SHARE PORTAL VIEW --- */}
          {activeTab === "share" && (
            <motion.div
              key="share"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-background-card border border-border rounded-2xl shadow-sm relative overflow-hidden h-full min-h-[500px] flex"
            >
              <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
              
              {/* MAIN CONTENT: PREVIEW */}
              <div className="w-full h-full p-8 relative z-10 flex flex-col items-center justify-center text-center">
                
                {/* Settings Toggle Button */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="absolute top-6 right-6 p-2.5 rounded-xl bg-background-elevated border border-border text-text-tertiary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors shadow-sm group"
                  title="Portal Settings"
                >
                  <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                </button>

                <h3 className="text-2xl font-semibold text-text-primary mb-3">Your Share Portal</h3>
                <p className="text-sm text-text-tertiary max-w-md mb-10 leading-relaxed">
                  Anyone scanning this QR can securely drop files directly into your inbox.
                </p>

                <div className="w-full max-w-[280px] aspect-square bg-background rounded-2xl border border-border p-4 flex items-center justify-center mb-10 shadow-2xl relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImageUrl} alt="Custom QR Code" className="w-full h-full rounded-xl object-contain" />
                </div>
                
                <div className="w-full max-w-[280px] flex items-center bg-background border border-border focus-within:border-primary/50 rounded-xl p-1.5 pl-5 relative transition-colors shadow-sm">
                  <span className="flex-1 text-base font-bold tracking-[0.2em] text-primary text-left uppercase">{user.shareCode}</span>
                  <button
                    onClick={copyToClipboard}
                    className="bg-primary text-background hover:bg-primary-hover px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-glow shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* SLIDING SETTINGS DRAWER */}
              <AnimatePresence>
                {isSettingsOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20"
                      onClick={() => setIsSettingsOpen(false)}
                    />
                    
                    {/* Drawer */}
                    <motion.div
                      initial={{ x: "100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="absolute top-0 right-0 w-full md:w-[400px] h-full bg-background-card border-l border-border shadow-2xl z-30 flex flex-col"
                    >
                      {/* Drawer Header */}
                      <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shadow-glow">
                            <QrCode className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-text-primary">Portal Settings</h2>
                            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Customize your page</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsSettingsOpen(false)}
                          className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-elevated transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Drawer Content */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        
                        {/* Profile Section */}
                        <div>
                          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Profile Info
                          </h3>
                          <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Display Name</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Enter your name"
                                className="flex-1 bg-background-elevated border border-border focus:border-primary/50 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors"
                              />
                              <button
                                onClick={handleUpdateName}
                                disabled={isUpdatingName || !displayName.trim()}
                                className="bg-primary hover:bg-primary-hover text-background px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shrink-0 shadow-glow"
                              >
                                {isUpdatingName ? "Saving..." : "Save"}
                              </button>
                            </div>
                            {nameUpdateStatus && (
                              <p className={`text-[10px] font-medium mt-1 ${
                                nameUpdateStatus.includes("successfully") ? "text-status-success" : "text-status-error"
                              }`}>
                                {nameUpdateStatus}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* QR Customization Section */}
                        <div>
                          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> QR Customization
                          </h3>
                          <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col gap-4">
                            
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block mb-1.5">Color</label>
                                <div className="flex items-center gap-2 bg-background-elevated border border-border rounded-lg p-1.5">
                                  <input
                                    type="color"
                                    value={qrFgColor}
                                    onChange={(e) => setQrFgColor(e.target.value)}
                                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                                  />
                                  <span className="text-xs text-text-secondary font-mono">{qrFgColor.toUpperCase()}</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block mb-1.5">Background</label>
                                <div className="flex items-center gap-2 bg-background-elevated border border-border rounded-lg p-1.5">
                                  <input
                                    type="color"
                                    value={qrBgColor}
                                    onChange={(e) => setQrBgColor(e.target.value)}
                                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                                  />
                                  <span className="text-xs text-text-secondary font-mono">{qrBgColor.toUpperCase()}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block mb-1.5">Center Logo URL (Optional)</label>
                              <input
                                type="text"
                                value={qrLogoUrl}
                                onChange={(e) => setQrLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="w-full bg-background-elevated border border-border focus:border-primary/50 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors"
                              />
                              <p className="text-[9px] text-text-tertiary mt-1.5 leading-relaxed">
                                Note: Must be a <strong className="text-text-secondary">direct link</strong> to an image file (ends in .png or .jpg). Webpage links will not work.
                              </p>
                            </div>
                          </div>
                        </div>

                      </div>
                      
                      {/* Drawer Footer */}
                      <div className="p-6 border-t border-border bg-background-elevated">
                        <button
                          onClick={saveQrSettings}
                          className="w-full bg-primary hover:bg-primary-hover text-background py-3 rounded-xl text-sm font-bold transition-all shadow-glow flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Save Preferences
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
