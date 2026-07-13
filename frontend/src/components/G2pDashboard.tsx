"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy, Check, Search, Download, Trash2, Calendar,
  ArrowUpDown, User, Mail, FileText, FileImage, Film,
  Music, FolderArchive, Settings, LogOut, Volume2, VolumeX,
  FileCheck, Activity, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  name: string;
  size: number;
  type: string;
  dataUrl?: string; // for small images
}

interface UploadRecord {
  uploadId: string;
  receiverUserId: string;
  senderName: string;
  message: string;
  files: UploadedFile[];
  uploadedAt: string;
}

export default function G2pDashboard({
  user,
  onLogout
}: {
  user: UserProfile;
  onLogout: () => void;
}) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [usernameEdit, setUsernameEdit] = useState(user.username);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const [activeTab, setActiveTab] = useState<"portal" | "history" | "settings">("portal");
  const [menuOpen, setMenuOpen] = useState(false);

  // Play synthetic clean notification chime
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(293.66, ctx.currentTime); // D4
      osc2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15); // A4

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("Chime failed:", e);
    }
  }, [soundEnabled]);

  // Load uploads from mock DB in local storage
  const loadUploads = useCallback(() => {
    const allUploads: UploadRecord[] = JSON.parse(localStorage.getItem("share2me_mock_uploads") || "[]");
    const filtered = allUploads.filter(u => u.receiverUserId === user.userId);
    
    setUploads(prev => {
      if (prev.length > 0 && filtered.length > prev.length) {
        playChime();
      }
      return filtered;
    });
  }, [user.userId, playChime]);

  useEffect(() => {
    loadUploads();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "share2me_mock_uploads") {
        loadUploads();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(loadUploads, 1500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [user.userId, loadUploads]);

  const shareLink = typeof window !== "undefined"
    ? `${window.location.origin}/g2p/${user.shareCode}`
    : `https://share2.me/g2p/${user.shareCode}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=fcd535&bgcolor=181a20&data=${encodeURIComponent(shareLink)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(user.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateUsername = () => {
    const trimmed = usernameEdit.trim();
    if (!trimmed) {
      setUsernameError("Username cannot be empty");
      return;
    }
    if (trimmed.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }
    
    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    const updatedUsers = users.map(u => {
      if (u.userId === user.userId) {
        return { ...u, username: trimmed };
      }
      return u;
    });
    localStorage.setItem("share2me_mock_users", JSON.stringify(updatedUsers));
    
    const currentSession = JSON.parse(localStorage.getItem("share2me_current_user") || "{}");
    currentSession.username = trimmed;
    localStorage.setItem("share2me_current_user", JSON.stringify(currentSession));
    
    setIsEditingUsername(false);
    setUsernameError("");
    window.dispatchEvent(new Event("share2me_user_updated"));
  };

  const handleDeleteUpload = (uploadId: string) => {
    const allUploads: UploadRecord[] = JSON.parse(localStorage.getItem("share2me_mock_uploads") || "[]");
    const filtered = allUploads.filter(u => u.uploadId !== uploadId);
    localStorage.setItem("share2me_mock_uploads", JSON.stringify(filtered));
    loadUploads();
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return FileImage;
    if (type.startsWith("video/")) return Film;
    if (type.startsWith("audio/")) return Music;
    if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("compressed")) return FolderArchive;
    return FileText;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const triggerDownload = (file: UploadedFile) => {
    if (file.dataUrl) {
      const link = document.createElement("a");
      link.href = file.dataUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const dummyContent = `Mock file content for: ${file.name}\nSize: ${file.size} bytes\nType: ${file.type}`;
      const blob = new Blob([dummyContent], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const processedUploads = uploads
    .filter(u => {
      const matchQuery = u.senderName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (u.message && u.message.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!dateFilter) return matchQuery;
      
      const uploadDate = new Date(u.uploadedAt).toISOString().split("T")[0];
      return matchQuery && uploadDate === dateFilter;
    })
    .sort((a, b) => {
      const timeA = new Date(a.uploadedAt).getTime();
      const timeB = new Date(b.uploadedAt).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

  const totalBytesReceived = uploads.reduce((acc, curr) => {
    return acc + curr.files.reduce((fAcc, f) => fAcc + f.size, 0);
  }, 0);

  return (
    <div className="space-y-6 text-text-primary font-sans antialiased bg-[#0b0e11] rounded-[24px] border border-[#2f3336] overflow-hidden shadow-2xl p-4 sm:p-6 lg:p-8">
      
      {/* 1. Header / Navigation Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#2f3336] pb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display tracking-tight text-text-primary">G2P Portal Workspace</h2>
            <p className="text-xs text-text-tertiary">Real-time Node: Online</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Sound Preferences */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2f3336] bg-[#181a20] hover:bg-[#20232a] text-xs font-bold text-text-secondary transition-colors"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-primary" />
                <span>Audio Alert On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-text-tertiary" />
                <span>Alert Muted</span>
              </>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-status-error/20 bg-status-error/5 hover:bg-status-error/15 text-xs font-bold text-status-error transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown (Matches User's Screenshot) */}
      <div className="lg:hidden relative z-40 mb-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full bg-[#181a20] border border-[#2f3336] rounded-xl px-4 py-3 flex items-center justify-between text-sm font-bold text-[#eaecef] active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5">
            {activeTab === "portal" && <FileCheck className="w-4 h-4 text-primary" />}
            {activeTab === "history" && <Activity className="w-4 h-4 text-primary" />}
            {activeTab === "settings" && <User className="w-4 h-4 text-primary" />}
            <span className="capitalize">{activeTab === "portal" ? "Deposit Portal" : activeTab === "history" ? "Deposit History" : "Account Settings"}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#848e9c] transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-full left-0 right-0 mt-2 bg-[#181a20] border border-[#2f3336] rounded-xl shadow-xl overflow-hidden py-1 z-50"
            >
              <button
                onClick={() => { setActiveTab("portal"); setMenuOpen(false); }}
                className={`w-full px-4 py-3 flex items-center gap-3 text-xs font-semibold hover:bg-[#20232a] text-left transition-colors ${activeTab === "portal" ? "text-primary bg-[#20232a]/30" : "text-[#848e9c]"}`}
              >
                <FileCheck className="w-4 h-4" />
                <span>Deposit Portal</span>
              </button>

              <button
                onClick={() => { setActiveTab("history"); setMenuOpen(false); }}
                className={`w-full px-4 py-3 flex items-center gap-3 text-xs font-semibold hover:bg-[#20232a] text-left transition-colors ${activeTab === "history" ? "text-primary bg-[#20232a]/30" : "text-[#848e9c]"}`}
              >
                <Activity className="w-4 h-4" />
                <span>Deposit History</span>
              </button>

              <button
                onClick={() => { setActiveTab("settings"); setMenuOpen(false); }}
                className={`w-full px-4 py-3 flex items-center gap-3 text-xs font-semibold hover:bg-[#20232a] text-left transition-colors ${activeTab === "settings" ? "text-primary bg-[#20232a]/30" : "text-[#848e9c]"}`}
              >
                <User className="w-4 h-4" />
                <span>Account Settings</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Top Summary & Sharing Portal Panel */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 pt-2 lg:pt-4">
        
        {/* Left Card: Account Info */}
        <div className={`bg-[#181a20] border border-[#2f3336] rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-sm ${activeTab === "settings" ? "flex" : "hidden"} lg:flex`}>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {user.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  alt={user.username}
                  className="w-14 h-14 rounded-xl object-cover border border-[#2f3336] shadow"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                {isEditingUsername ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={usernameEdit}
                        onChange={(e) => setUsernameEdit(e.target.value)}
                        className="bg-[#0b0e11] border border-[#2f3336] rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary/50 w-full"
                        placeholder="Choose username"
                      />
                      <button
                        onClick={handleUpdateUsername}
                        className="bg-primary text-background hover:bg-opacity-95 font-bold rounded-lg px-2 py-1 text-[10px] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                    {usernameError && <p className="text-status-error text-[10px] font-semibold">{usernameError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <h2 className="text-base font-bold text-text-primary truncate">{user.username}</h2>
                    <button
                      onClick={() => setIsEditingUsername(true)}
                      className="text-text-tertiary hover:text-primary p-0.5 rounded transition-colors"
                      title="Edit username"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                
                <div className="flex items-center gap-1 text-[11px] text-text-tertiary mt-0.5">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-[#2f3336] text-[11px]">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Registered Email</span>
                <span className="text-text-secondary truncate max-w-[150px]">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Account Node ID</span>
                <span className="text-text-secondary font-mono">{user.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Registration Date</span>
                <span className="text-text-secondary">{new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Deposit Portal */}
        <div className={`lg:col-span-2 bg-[#181a20] border border-[#2f3336] rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center shadow-sm relative ${activeTab === "portal" ? "flex" : "hidden"} lg:flex`}>
          
          {/* QR Code */}
          <div className="w-40 h-40 bg-[#0b0e11] border border-[#2f3336] rounded-xl p-2.5 flex items-center justify-center shrink-0 shadow-inner group">
            <img
              src={qrImageUrl}
              alt="Receiver QR Code"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Share links and text */}
          <div className="flex-1 space-y-4 w-full text-center md:text-left">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-primary/20 bg-primary/5 text-[10px] text-primary font-bold tracking-wider uppercase mb-2">
                <FileCheck className="w-3 h-3" />
                Deposit Portal Ready
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1.5">Direct Share Code & QR</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Provide your custom Share Code or QR code. Anyone can deposit documents, images, zip files, or text messages directly to your dashboard.
              </p>
            </div>

            {/* Simulated Coin/Network selectors for Binance authenticity */}
            <div className="grid grid-cols-2 gap-3 text-[11px] bg-[#0b0e11] border border-[#2f3336] rounded-xl p-2.5">
              <div className="space-y-0.5">
                <span className="text-text-tertiary block">Asset Coin</span>
                <span className="text-text-primary font-bold flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  FILE (Data Payload)
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-text-tertiary block font-mono">Network protocol</span>
                <span className="text-text-primary font-bold">WebRTC Signal Tunnel</span>
              </div>
            </div>

            {/* Link Box */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 bg-[#0b0e11] border border-[#2f3336] rounded-xl px-3.5 py-2.5 font-mono text-xs text-text-primary flex items-center justify-between shadow-inner overflow-hidden select-all">
                <span className="truncate mr-2 font-bold tracking-wider">{user.shareCode}</span>
                <span className="text-[9px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded font-sans uppercase tracking-wider shrink-0 select-none">
                  DEPOSIT ADDRESS
                </span>
              </div>
              
              <button
                onClick={copyToClipboard}
                className="bg-primary text-background hover:bg-opacity-90 font-bold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 active:scale-[0.98] text-xs sm:text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Binance Asset Metrics / Status Widgets */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 ${activeTab === "history" ? "grid" : "hidden"} lg:grid`}>
        
        {/* Metric 1 */}
        <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-text-tertiary font-bold tracking-wider uppercase font-mono">Total Deposits</span>
          <div className="text-xl font-bold font-mono text-text-primary">
            {uploads.length} <span className="text-xs text-text-secondary font-sans font-medium">uploads</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-text-tertiary font-bold tracking-wider uppercase font-mono">Payload Size</span>
          <div className="text-xl font-bold font-mono text-text-primary">
            {formatSize(totalBytesReceived)}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-text-tertiary font-bold tracking-wider uppercase font-mono">Node Status</span>
          <div className="text-xl font-bold text-status-success flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse" />
            <span className="text-sm font-sans font-bold">Active</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#181a20] border border-[#2f3336] rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-text-tertiary font-bold tracking-wider uppercase font-mono">Transfer Type</span>
          <div className="text-xl font-bold font-mono text-text-primary">
            G2P <span className="text-[10px] text-text-tertiary font-sans font-medium">(Portal)</span>
          </div>
        </div>

      </div>

      {/* 4. Binance Transaction History Table */}
      <div className={`bg-[#181a20] border border-[#2f3336] rounded-2xl overflow-hidden shadow-sm pt-4 ${activeTab === "history" ? "block" : "hidden"} lg:block`}>
        
        {/* Table Header Filter controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 pb-4 border-b border-[#2f3336]">
          <div>
            <h3 className="text-base font-bold text-text-primary">Deposit History</h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">Real-time socket updates for incoming payloads.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            {/* Search Bar */}
            <div className="relative bg-[#0b0e11] border border-[#2f3336] rounded-lg shadow-sm focus-within:border-primary/50 transition-colors w-full md:w-52">
              <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none w-full"
              />
            </div>

            {/* Date Filter */}
            <div className="relative bg-[#0b0e11] border border-[#2f3336] rounded-lg shadow-sm flex items-center px-3 w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-text-tertiary mr-1.5" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-none py-1.5 text-[11px] text-text-primary placeholder-text-tertiary focus:outline-none cursor-pointer"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="text-[10px] font-bold text-text-tertiary hover:text-status-error ml-1.5"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === "latest" ? "oldest" : "latest")}
              className="bg-[#0b0e11] border border-[#2f3336] hover:bg-[#20232a] text-[11px] font-bold text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto active:scale-[0.98]"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>Sort: {sortOrder === "latest" ? "Latest" : "Oldest"}</span>
            </button>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2f3336] text-[10px] text-text-tertiary font-bold tracking-wider uppercase font-mono bg-[#0b0e11]/30 bg-opacity-40">
                <th className="px-6 py-4">Sender Address</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Uploaded Files</th>
                <th className="px-6 py-4">Message / Notes</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-[#2f3336]/60 text-xs">
              <AnimatePresence mode="popLayout">
                {processedUploads.map((record) => (
                  <motion.tr
                    key={record.uploadId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="hover:bg-[#20232a]/30 transition-colors group"
                  >
                    {/* Sender Address */}
                    <td className="px-6 py-4 font-mono text-text-primary font-bold">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-sans text-xs text-primary font-extrabold select-none">
                          {record.senderName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-sans font-bold">{record.senderName}</span>
                          <span className="text-[9px] text-text-tertiary leading-none font-mono mt-0.5">{record.uploadId}</span>
                        </div>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="px-6 py-4 font-mono text-text-secondary">
                      <div className="flex flex-col">
                        <span>{new Date(record.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className="text-[10px] text-text-tertiary mt-0.5">{new Date(record.uploadedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </td>

                    {/* Uploaded Files list */}
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {record.files.map((file, fIdx) => {
                          const Icon = getFileIcon(file.type);
                          return (
                            <div
                              key={fIdx}
                              onClick={() => triggerDownload(file)}
                              className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#0b0e11] border border-[#2f3336] hover:border-primary/40 cursor-pointer transition-colors max-w-full group/file"
                              title={`Download ${file.name}`}
                            >
                              <Icon className="w-3 h-3 text-primary shrink-0" />
                              <span className="truncate max-w-[120px] font-semibold text-text-secondary group-hover/file:text-primary">{file.name}</span>
                              <span className="text-[9px] text-text-tertiary font-mono shrink-0">{formatSize(file.size)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {/* Message / Notes */}
                    <td className="px-6 py-4 max-w-xs">
                      {record.message ? (
                        <p className="text-text-secondary leading-relaxed truncate max-w-[200px]" title={record.message}>
                          {record.message}
                        </p>
                      ) : (
                        <span className="text-text-tertiary font-mono italic">--</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        {/* Download All */}
                        <button
                          onClick={() => record.files.forEach(f => triggerDownload(f))}
                          className="p-1.5 rounded-lg border border-[#2f3336] hover:border-primary bg-[#0b0e11] text-text-secondary hover:text-primary transition-all"
                          title="Download all files in deposit"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteUpload(record.uploadId)}
                          className="p-1.5 rounded-lg border border-[#2f3336]/60 hover:border-status-error/40 bg-[#0b0e11] text-text-tertiary hover:text-status-error transition-all"
                          title="Delete deposit record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {processedUploads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-text-tertiary">
                    <div className="w-12 h-12 bg-[#0b0e11] border border-[#2f3336] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <FileText className="w-6 h-6 text-text-tertiary" />
                    </div>
                    <h4 className="font-bold text-text-primary mb-1">No transaction records found</h4>
                    <p className="text-[11px] text-text-secondary max-w-xs mx-auto">
                      {searchQuery || dateFilter 
                        ? "Try adjusting filters or checking spelling." 
                        : "Deposited payloads will show up here instantly once sent."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
