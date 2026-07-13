"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Upload, User, MessageSquare, Send, CheckCircle2,
  FileCheck, Shield, ChevronLeft, Trash2, Loader2, AlertCircle
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

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function G2pSenderPortal({ params }: PageProps) {
  const { code } = use(params);
  const [receiver, setReceiver] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Progress & Completion states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load receiver profile matching the share code
  useEffect(() => {
    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    const matched = users.find(u => u.shareCode.toLowerCase() === code.toLowerCase());
    
    if (matched) {
      setReceiver(matched);
    }
    setLoading(false);
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-text-primary p-6">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-sm font-semibold text-text-secondary">Loading Sharing Portal...</p>
      </div>
    );
  }

  if (!receiver) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-text-primary p-6">
        <div className="w-16 h-16 rounded-2xl bg-status-error/10 border border-status-error/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-status-error" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Sharing Portal Not Found</h2>
        <p className="text-sm text-text-secondary mb-8 text-center max-w-sm">
          The Share Code &ldquo;{code}&rdquo; is invalid or has expired. Double check the spelling or scan the QR Code again.
        </p>
        <Link
          href="/"
          className="bg-primary text-background font-bold px-8 py-3.5 rounded-xl transition-all hover:bg-opacity-90 active:scale-[0.98] shadow-md"
        >
          Go Back Home
        </Link>
      </div>
    );
  }

  // File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArr]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const filesArr = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...filesArr]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Convert file to base64 dataUrl if it is small enough (< 250KB)
  const readFileAsDataUrl = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.size > 250_000) {
        resolve(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const name = senderName.trim();
    if (!name) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (selectedFiles.length === 0) {
      setErrorMsg("Please attach at least one file to transfer.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress bar streaming
    const totalDuration = 2000; // 2 seconds
    const intervalTime = 50;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(async () => {
      currentStep++;
      const progress = Math.min((currentStep / steps) * 100, 100);
      setUploadProgress(Math.floor(progress));

      if (progress >= 100) {
        clearInterval(timer);
        
        // Process files
        const processedFiles: UploadedFile[] = [];
        for (const file of selectedFiles) {
          const dataUrl = await readFileAsDataUrl(file);
          processedFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl
          });
        }

        // Store inside localStorage database
        const newRecord = {
          uploadId: "upl_" + Math.random().toString(36).substr(2, 9),
          receiverUserId: receiver.userId,
          senderName: name,
          message: message.trim(),
          files: processedFiles,
          uploadedAt: new Date().toISOString()
        };

        const existing: UploadRecord[] = JSON.parse(localStorage.getItem("share2me_mock_uploads") || "[]");
        existing.push(newRecord);
        localStorage.setItem("share2me_mock_uploads", JSON.stringify(existing));

        // Done
        setUploading(false);
        setUploadComplete(true);
      }
    }, intervalTime);
  };

  const resetForm = () => {
    setSenderName("");
    setMessage("");
    setSelectedFiles([]);
    setUploadComplete(false);
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary relative overflow-hidden flex flex-col justify-between">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/5 blur-[120px] pointer-events-none" />
      
      {/* Header Bar */}
      <header className="border-b border-border w-full py-4 bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1000px] mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-bold group">
            <ChevronLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" />
            <span>Cancel</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </div>
            <span className="text-text-primary font-display font-bold text-sm">Share2Me</span>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 flex items-center justify-center p-6 z-10 w-full">
        <div className="w-full max-w-[500px]">
          
          <AnimatePresence mode="wait">
            {!uploadComplete ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-background-elevated border border-border rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden"
              >
                {/* Receiver Info Header */}
                <div className="border-b border-border/60 pb-6 mb-6">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-status-success/20 bg-status-success/5 text-xs text-status-success font-bold tracking-wide uppercase w-fit mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                    Receiver Verified
                  </div>
                  <h1 className="text-2xl font-bold text-text-primary">G2P Share Portal</h1>
                  
                  <div className="flex items-center gap-3 bg-background border border-border/80 rounded-2xl p-4 mt-4 shadow-inner">
                    {receiver.profilePhoto ? (
                      <img
                        src={receiver.profilePhoto}
                        alt={receiver.username}
                        className="w-11 h-11 rounded-xl object-cover border border-border"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-text-tertiary">Sending files to:</p>
                      <p className="text-base font-bold text-text-primary leading-tight">{receiver.username}</p>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleSendFiles} className="space-y-6">
                  
                  {/* Sender Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>Your Name <span className="text-status-error">*</span></span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={uploading}
                      placeholder="e.g. John Smith"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary/50 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Drag and drop file upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-primary" />
                      <span>Attach Files <span className="text-status-error">*</span></span>
                    </label>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center min-h-[140px] ${
                        isDragging ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/40 bg-background/50"
                      } ${uploading ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        disabled={uploading}
                      />
                      
                      <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-3">
                        <Upload className="w-5 h-5 text-primary" />
                      </div>
                      
                      <p className="text-xs font-bold text-text-primary mb-1">Drag & drop files here or click to browse</p>
                      <p className="text-[10px] text-text-tertiary font-medium">Supports image, PDF, audio, video, zip and more</p>
                    </div>

                    {/* Selected files listing */}
                    <AnimatePresence>
                      {selectedFiles.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 mt-3 max-h-36 overflow-y-auto pr-1"
                        >
                          {selectedFiles.map((file, idx) => (
                            <div
                              key={idx}
                              className="bg-background border border-border/80 rounded-xl px-3 py-2 flex items-center justify-between gap-3 text-xs text-text-primary"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileCheck className="w-4 h-4 text-primary shrink-0" />
                                <span className="truncate font-medium">{file.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-text-tertiary font-mono">{formatSize(file.size)}</span>
                                {!uploading && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFile(idx)}
                                    className="text-text-tertiary hover:text-status-error p-1 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Optional Message */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      <span>Add Message (Optional)</span>
                    </label>
                    <textarea
                      placeholder="e.g. Please review these files."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={uploading}
                      rows={3}
                      className="w-full bg-background border border-border focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {errorMsg && (
                    <div className="bg-status-error/10 border border-status-error/20 rounded-xl p-3.5 text-xs text-status-error font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Submit Button & Progress */}
                  {uploading ? (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs text-text-secondary font-bold">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                          Uploading files...
                        </span>
                        <span className="font-mono text-primary">{uploadProgress}%</span>
                      </div>
                      
                      <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-primary transition-all duration-75 ease-out shadow-[0_0_10px_rgba(252,213,53,0.5)]"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full bg-primary text-background hover:bg-opacity-90 active:scale-[0.98] font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(252,213,53,0.25)] hover:shadow-[0_4px_30px_rgba(252,213,53,0.45)] mt-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Files</span>
                    </button>
                  )}

                </form>
              </motion.div>
            ) : (
              <motion.div
                key="completion"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-background-elevated border border-border rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-status-success/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="w-20 h-20 bg-status-success/10 border border-status-success/20 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-md animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-status-success" />
                </div>
                
                <h2 className="text-2xl font-bold text-text-primary mb-2">Files Sent Successfully!</h2>
                <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto mb-8">
                  {selectedFiles.length} file{selectedFiles.length !== 1 && "s"} {selectedFiles.length === 1 ? "was" : "were"} uploaded. <strong>{receiver.username}</strong> will see them in their dashboard immediately.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                  <button
                    onClick={resetForm}
                    className="w-full sm:w-auto bg-primary text-background font-bold px-8 py-3.5 rounded-xl transition-all hover:bg-opacity-90 active:scale-[0.98] shadow-md"
                  >
                    Send More Files
                  </button>
                  
                  <Link
                    href="/"
                    className="w-full sm:w-auto bg-background border border-border text-text-secondary hover:text-text-primary hover:bg-border/30 font-bold px-8 py-3.5 rounded-xl transition-all active:scale-[0.98]"
                  >
                    Back to Home
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Secure indicator footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-text-tertiary">
            <Shield className="w-4 h-4 text-primary" />
            <span>Secure End-to-End Encrypted Transfer</span>
          </div>

        </div>
      </main>

      {/* Footer bar */}
      <footer className="py-8 border-t border-border text-center text-xs text-text-tertiary z-10 bg-background/50">
        © 2026 Share2Me. All rights reserved.
      </footer>
    </div>
  );
}
