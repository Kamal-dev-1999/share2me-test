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
      className="bg-white border-2 border-on-surface rounded-none p-5 hover:bg-surface-container-lowest transition-all shadow-[4px_4px_0px_0px_#1a1c1c] overflow-hidden"
    >
      {/* HEADER (Always Visible) */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-none bg-primary border-2 border-on-surface flex items-center justify-center text-lg font-black text-on-primary shrink-0 transition-transform group-hover:scale-105">
            {record.senderName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-on-surface group-hover:text-primary transition-colors font-display">{record.senderName}</span>
              <span className="px-2 py-0.5 rounded-none bg-primary border-2 border-on-surface text-[10px] font-bold text-on-surface uppercase font-mono">
                {record.files.length} file{record.files.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs font-bold text-text-secondary mt-1 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-on-surface" />
              {new Date(record.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-16 sm:ml-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 rounded-none bg-primary text-on-primary hover:bg-[#ffe16d] border-2 border-on-surface text-xs font-black transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download All</span>
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(record.uploadId); }}
            className="p-2.5 rounded-none border-2 border-on-surface text-on-surface hover:text-white hover:bg-error transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <div className="w-0.5 h-6 bg-on-surface mx-1 hidden sm:block" />
          
          <button className="p-2 rounded-none text-on-surface hover:bg-surface-container transition-colors border border-transparent hover:border-on-surface">
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
            <div className="pt-6 mt-5 border-t-2 border-on-surface">
              {record.message && (
                <div className="mb-5 pl-4 border-l-4 border-primary text-sm text-on-surface-variant leading-relaxed italic bg-surface-container-low py-3 rounded-none">
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
                      className="flex items-center justify-between p-3.5 rounded-none border-2 border-on-surface bg-white hover:bg-surface-container-lowest cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-none bg-surface-container border-2 border-on-surface flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-on-surface" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors font-display">{file.name}</span>
                          <span className="text-xs text-text-secondary mt-1 font-mono">{formatSize(file.size)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAction(file, 'preview'); }}
                          title="Preview"
                          className="w-9 h-9 rounded-none bg-white border-2 border-on-surface flex items-center justify-center hover:bg-surface-container transition-colors shadow-sm"
                        >
                          <Eye className="w-4 h-4 text-on-surface" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAction(file, 'download'); }}
                          title="Download"
                          className="w-9 h-9 rounded-none bg-primary border-2 border-on-surface flex items-center justify-center hover:bg-[#ffe16d] transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4 text-on-surface" />
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
  const [vendorCode, setVendorCode] = useState<string>(user.shareCode || "");
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
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-text-primary font-sans relative">
      
      {/* FLOATING NAVIGATION PILL (Horizontal on mobile, vertical sticky on desktop) */}
      <div className="sm:sticky sm:top-24 shrink-0 flex sm:flex-col flex-row items-center justify-around sm:justify-start gap-2 sm:gap-3 bg-white border-2 border-on-surface rounded-none p-2 h-fit z-20 w-full sm:w-auto shadow-[4px_4px_0px_0px_#1a1c1c]">
        
        {/* Inbox Tab */}
        <button
          onClick={() => setActiveTab("inbox")}
          title="Inbox"
          className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-none flex items-center justify-center transition-all duration-200 ${
            activeTab === "inbox" ? "bg-primary text-on-primary border-2 border-on-surface font-black" : "text-on-surface hover:bg-surface-container"
          }`}
        >
          <Inbox className="w-5 h-5 text-on-surface" />
          {uploads.length > 0 && activeTab !== "inbox" && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-primary border border-on-surface rounded-none"></span>
          )}
        </button>

        {/* Share/QR Tab */}
        <button
          onClick={() => setActiveTab("share")}
          title="Share Portal"
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-none flex items-center justify-center transition-all duration-200 ${
            activeTab === "share" ? "bg-primary text-on-primary border-2 border-on-surface font-black" : "text-on-surface hover:bg-surface-container"
          }`}
        >
          <QrCode className="w-5 h-5 text-on-surface" />
        </button>

        <div className="hidden sm:block w-6 h-0.5 bg-on-surface my-1" />
        <div className="sm:hidden w-px h-6 bg-on-surface mx-1" />

        {/* Settings / Utilities */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Mute Alerts" : "Enable Alerts"}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-none flex items-center justify-center transition-all duration-200 text-on-surface hover:bg-surface-container"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5 text-on-surface" /> : <VolumeX className="w-5 h-5 text-on-surface" />}
        </button>

        <button
          onClick={onLogout}
          title="Logout"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-none flex items-center justify-center transition-all duration-200 text-on-surface hover:text-white hover:bg-error border border-transparent hover:border-on-surface"
        >
          <LogOut className="w-4 h-4 ml-0.5" />
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 w-full">
        <AnimatePresence mode="wait">
          
          {/* --- INBOX VIEW --- */}
          {activeTab === "inbox" && (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white border-2 border-on-surface rounded-none flex flex-col overflow-hidden h-full min-h-[calc(100vh-220px)] shadow-[4px_4px_0px_0px_#1a1c1c]"
            >
              <div className="p-4 sm:p-6 border-b-2 border-on-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white">
                <div className="flex items-center gap-3 text-on-surface font-black">
                  <div className="w-10 h-10 rounded-none bg-primary border-2 border-on-surface flex items-center justify-center shrink-0">
                    <Inbox className="w-5 h-5 text-on-surface" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg leading-tight font-display font-black">Received Files</h2>
                    <p className="text-xs text-text-secondary font-mono mt-0.5">{uploads.length} active requests</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-on-surface absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search sender or message..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border-2 border-on-surface rounded-none pl-9 pr-4 py-2 text-xs sm:text-sm text-on-surface placeholder-text-secondary focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => setSortOrder(prev => prev === "latest" ? "oldest" : "latest")}
                    className="bg-white border-2 border-on-surface hover:bg-primary text-xs sm:text-sm font-black text-on-surface px-3 sm:px-4 py-2 sm:py-2.5 rounded-none transition-colors flex items-center gap-2 shrink-0"
                  >
                    <ArrowUpDown className="w-4 h-4 text-on-surface" />
                    <span className="hidden sm:inline font-display">{sortOrder === "latest" ? "Latest First" : "Oldest First"}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#f9f9f9]">
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
                    <div className="flex flex-col items-center justify-center text-center py-16 sm:py-24 px-4 bg-white border-2 border-on-surface rounded-none shadow-[4px_4px_0px_0px_#1a1c1c]">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-none bg-[#f9f9f9] border-2 border-on-surface flex items-center justify-center mb-6">
                        <Inbox className="w-8 h-8 sm:w-10 sm:h-10 text-on-surface" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-on-surface mb-3 font-display">Your inbox is empty</h3>
                      <p className="text-xs sm:text-sm text-text-secondary max-w-sm leading-relaxed">
                        No one has sent you files yet. Share your portal code with others so they can drop files securely into your inbox.
                      </p>
                      <button 
                        onClick={() => setActiveTab("share")}
                        className="mt-6 text-on-surface font-black hover:bg-[#ffe16d] flex items-center gap-2 border-2 border-on-surface px-4 py-2 rounded-none bg-primary text-xs sm:text-sm transition-all"
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
              className="bg-white border-2 border-on-surface rounded-none p-4 sm:p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden h-full min-h-[500px] justify-center shadow-[4px_4px_0px_0px_#1a1c1c]"
            >
              {/* Settings Toggle Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-none bg-white border-2 border-on-surface text-on-surface hover:bg-primary transition-colors group z-10"
                title="Portal Settings"
              >
                <Settings className="w-5 h-5 text-on-surface group-hover:rotate-90 transition-transform duration-300" />
              </button>

              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary border-2 border-on-surface rounded-none flex items-center justify-center mb-6 sm:mb-8 relative z-10 shrink-0 shadow-[4px_4px_0px_0px_#1a1c1c]">
                <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-on-surface" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-on-surface mb-2 sm:mb-3 relative z-10 font-display">Your Share Portal</h2>
              <p className="text-xs sm:text-sm text-text-secondary mb-6 sm:mb-8 max-w-md relative z-10 leading-relaxed px-2 font-body">
                Scan the QR code or share your unique code. Anyone with this code can upload files directly to your inbox, even if you are offline.
              </p>

              {/* Display Name Setting Box */}
              <div className="w-full max-w-sm bg-white border-2 border-on-surface rounded-none p-3.5 sm:p-4 mb-6 relative z-10 flex flex-col items-start gap-2 text-left shadow-[4px_4px_0px_0px_#1a1c1c]">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">Your Display Name</label>
                <div className="flex gap-2 w-full items-center">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 min-w-0 bg-white border-2 border-on-surface rounded-none px-3 py-2 text-xs text-on-surface focus:outline-none focus:bg-surface-container transition-colors"
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={isUpdatingName || !displayName.trim()}
                    className="bg-primary hover:bg-[#ffe16d] text-on-primary border-2 border-on-surface px-3 sm:px-4 py-2 rounded-none text-xs font-black transition-all disabled:opacity-50 shrink-0"
                  >
                    {isUpdatingName ? "Saving..." : "Save"}
                  </button>
                </div>
                {nameUpdateStatus && (
                  <p className={`text-[10px] font-bold mt-0.5 font-mono ${
                    nameUpdateStatus.includes("successfully") ? "text-status-success" : "text-status-error"
                  }`}>
                    {nameUpdateStatus}
                  </p>
                )}
              </div>

              {/* QR Code Container */}
              <div className="w-full max-w-xs sm:max-w-sm bg-white rounded-none border-2 border-on-surface p-4 sm:p-6 flex justify-center mb-6 sm:mb-8 relative z-10 shadow-[4px_4px_0px_0px_#1a1c1c]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt="QR Code" className="w-44 h-44 sm:w-56 sm:h-56 rounded-none border-2 border-on-surface" />
              </div>
              
              {/* Share Code Bar */}
              <div className="w-full max-w-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-0 bg-white border-2 border-on-surface rounded-none p-2 sm:p-0 relative z-10 transition-colors shadow-[4px_4px_0px_0px_#1a1c1c]">
                <span className="w-full sm:flex-1 text-center sm:text-left text-base sm:text-lg font-black tracking-[0.15em] sm:tracking-[0.2em] text-on-surface uppercase font-mono py-2 sm:pl-5">
                  {user.shareCode || activeShareCode || "LOADING..."}
                </span>
                <button
                  onClick={copyToClipboard}
                  disabled={!user.shareCode && !activeShareCode}
                  className="w-full sm:w-auto bg-primary text-on-primary hover:bg-[#ffe16d] px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-none text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 border-t-2 sm:border-t-0 sm:border-l-2 border-on-surface disabled:opacity-50 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy Code"}
                </button>
              </div>
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
                      className="absolute top-0 right-0 w-full md:w-[400px] h-full bg-white border-l-2 border-on-surface shadow-2xl z-30 flex flex-col"
                    >
                      {/* Drawer Header */}
                      <div className="flex items-center justify-between p-6 border-b-2 border-on-surface bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary border-2 border-on-surface rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1c1c]">
                            <QrCode className="w-5 h-5 text-on-surface" />
                          </div>
                          <div>
                            <h2 className="text-lg font-black text-on-surface font-display">Portal Settings</h2>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-mono">Customize your page</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsSettingsOpen(false)}
                          className="p-2 rounded-none text-on-surface hover:bg-surface-container border border-transparent hover:border-on-surface transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Drawer Content */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#f9f9f9]">
                        
                        {/* Profile Section */}
                        <div>
                          <h3 className="text-sm font-black text-on-surface mb-3 flex items-center gap-2 font-display">
                            <span className="w-2.5 h-2.5 bg-primary border border-on-surface rounded-none" /> Profile Info
                          </h3>
                          <div className="bg-white border-2 border-on-surface rounded-none p-4 shadow-[4px_4px_0px_0px_#1a1c1c] flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">Display Name</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Enter your name"
                                className="flex-1 bg-white border-2 border-on-surface focus:bg-surface-container rounded-none px-3 py-2 text-sm text-on-surface focus:outline-none transition-colors"
                              />
                              <button
                                onClick={handleUpdateName}
                                disabled={isUpdatingName || !displayName.trim()}
                                className="bg-primary hover:bg-[#ffe16d] text-on-primary border-2 border-on-surface px-4 py-2 rounded-none text-sm font-black transition-all disabled:opacity-50 shrink-0"
                              >
                                {isUpdatingName ? "Saving..." : "Save"}
                              </button>
                            </div>
                            {nameUpdateStatus && (
                              <p className={`text-[10px] font-bold mt-1 font-mono ${
                                nameUpdateStatus.includes("successfully") ? "text-status-success" : "text-status-error"
                              }`}>
                                {nameUpdateStatus}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* QR Customization Section */}
                        <div>
                          <h3 className="text-sm font-black text-on-surface mb-3 flex items-center gap-2 font-display">
                            <span className="w-2.5 h-2.5 bg-primary border border-on-surface rounded-none" /> QR Customization
                          </h3>
                          <div className="bg-white border-2 border-on-surface rounded-none p-4 shadow-[4px_4px_0px_0px_#1a1c1c] flex flex-col gap-4">
                            
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5 font-mono">Color</label>
                                <div className="flex items-center gap-2 bg-white border-2 border-on-surface rounded-none p-1.5">
                                  <input
                                    type="color"
                                    value={qrFgColor}
                                    onChange={(e) => setQrFgColor(e.target.value)}
                                    className="w-7 h-7 rounded-none cursor-pointer bg-transparent border-0 p-0"
                                  />
                                  <span className="text-xs text-on-surface font-mono">{qrFgColor.toUpperCase()}</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5 font-mono">Background</label>
                                <div className="flex items-center gap-2 bg-white border-2 border-on-surface rounded-none p-1.5">
                                  <input
                                    type="color"
                                    value={qrBgColor}
                                    onChange={(e) => setQrBgColor(e.target.value)}
                                    className="w-7 h-7 rounded-none cursor-pointer bg-transparent border-0 p-0"
                                  />
                                  <span className="text-xs text-on-surface font-mono">{qrBgColor.toUpperCase()}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5 font-mono">Center Logo URL (Optional)</label>
                              <input
                                type="text"
                                value={qrLogoUrl}
                                onChange={(e) => setQrLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="w-full bg-white border-2 border-on-surface focus:bg-surface-container rounded-none px-3 py-2 text-sm text-on-surface focus:outline-none transition-colors"
                              />
                              <p className="text-[9px] text-text-secondary mt-1.5 leading-relaxed font-mono">
                                Note: Must be a <strong className="text-on-surface">direct link</strong> to an image file (ends in .png or .jpg).
                              </p>
                            </div>
                          </div>
                        </div>

                      </div>
                      
                      {/* Drawer Footer */}
                      <div className="p-6 border-t-2 border-on-surface bg-white">
                        <button
                          onClick={saveQrSettings}
                          className="w-full bg-primary hover:bg-[#ffe16d] text-on-primary py-3 border-2 border-on-surface rounded-none text-sm font-black transition-all flex items-center justify-center gap-2"
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
