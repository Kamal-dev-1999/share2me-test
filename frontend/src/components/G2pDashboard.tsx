"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Copy, Check, Search, Download, Trash2, Calendar,
  ArrowUpDown, FileText, FileImage, Film,
  FolderArchive, LogOut, Volume2, VolumeX,
  Inbox, QrCode, ChevronDown
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
  dataUrl?: string;
}

interface UploadRecord {
  uploadId: string;
  receiverUserId: string;
  senderName: string;
  message: string;
  files: UploadedFile[];
  uploadedAt: string;
}

type TabMode = "inbox" | "share";

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

function triggerDownload(file: UploadedFile) {
  const url = file.dataUrl || URL.createObjectURL(new Blob([`Mock content: ${file.name}`], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// Expandable Upload Record Component
// -------------------------------------------------------------
function UploadRecordItem({
  record,
  onDelete
}: {
  record: UploadRecord;
  onDelete: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

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
            onClick={(e) => { e.stopPropagation(); record.files.forEach(f => triggerDownload(f)); }}
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
                      onClick={(e) => { e.stopPropagation(); triggerDownload(file); }}
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
                      <div className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3 shadow-sm">
                        <Download className="w-4 h-4 text-text-secondary group-hover:text-primary" />
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

  const loadUploads = useCallback(() => {
    const allUploads: UploadRecord[] = JSON.parse(localStorage.getItem("share2me_mock_uploads") || "[]");
    const filtered = allUploads.filter(u => u.receiverUserId === user.userId);
    setUploads(prev => {
      if (prev.length > 0 && filtered.length > prev.length) playChime();
      return filtered;
    });
  }, [user.userId, playChime]);

  useEffect(() => {
    loadUploads();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "share2me_mock_uploads") loadUploads();
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(loadUploads, 2000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [loadUploads]);

  const shareLink = typeof window !== "undefined"
    ? `${window.location.origin}/g2p/${user.shareCode}`
    : `https://share2.me/g2p/${user.shareCode}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=fcd535&bgcolor=1e2329&data=${encodeURIComponent(shareLink)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(user.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteUpload = (uploadId: string) => {
    const allUploads: UploadRecord[] = JSON.parse(localStorage.getItem("share2me_mock_uploads") || "[]");
    localStorage.setItem("share2me_mock_uploads", JSON.stringify(allUploads.filter(u => u.uploadId !== uploadId)));
    loadUploads();
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
                    <p className="text-xs text-text-tertiary font-normal mt-0.5">{uploads.length} total transfers</p>
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
              className="bg-background-card border border-border rounded-2xl p-8 flex flex-col items-center text-center shadow-sm relative overflow-hidden h-full min-h-[500px] justify-center"
            >
              <div className="absolute top-[-20%] left-[-20%] w-full h-full bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mb-8 relative z-10 shadow-glow">
                <QrCode className="w-10 h-10 text-primary" />
              </div>

              <h2 className="text-2xl font-semibold text-text-primary mb-3 relative z-10">Your Share Portal</h2>
              <p className="text-sm text-text-tertiary mb-10 max-w-md relative z-10 leading-relaxed">
                Scan the QR code or share your unique code. Anyone with this code can upload files directly to your inbox, even if you are offline.
              </p>

              <div className="w-full max-w-sm bg-background rounded-2xl border border-border p-6 flex justify-center mb-8 relative z-10 shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt="QR Code" className="w-56 h-56 rounded-xl shadow-glow" />
              </div>
              
              <div className="w-full max-w-sm flex items-center bg-background border border-border focus-within:border-primary/50 rounded-xl p-2 pl-6 relative z-10 transition-colors shadow-sm">
                <span className="flex-1 text-lg font-bold tracking-[0.2em] text-primary text-left uppercase">{user.shareCode}</span>
                <button
                  onClick={copyToClipboard}
                  className="bg-primary text-background hover:bg-primary-hover px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-glow"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy Code"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
