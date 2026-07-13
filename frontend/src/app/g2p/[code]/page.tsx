"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Upload, User, MessageSquare, CheckCircle2,
  FileText, ArrowLeft, Trash2, Loader2, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UserProfile {
  userId: string;
  username: string;
  shareCode: string;
  profilePhoto: string;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function G2pSenderPortal({ params }: PageProps) {
  const { code } = use(params);
  const [receiver, setReceiver] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const users: UserProfile[] = JSON.parse(localStorage.getItem("share2me_mock_users") || "[]");
    const matched = users.find(u => u.shareCode.toLowerCase() === code.toLowerCase());
    if (matched) setReceiver(matched);
    setLoading(false);
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!receiver) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-status-error/10 border border-status-error/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-status-error" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Portal Not Found</h2>
        <p className="text-sm text-text-tertiary mb-8 text-center max-w-sm">
          The Share Code &quot;{code}&quot; is invalid or has expired.
        </p>
        <Link href="/" className="bg-primary text-background font-bold px-6 py-3 rounded-xl hover:bg-primary-hover transition-colors shadow-glow">
          Return Home
        </Link>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const readFileAsDataUrl = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.size > 500_000) return resolve(undefined);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleSendFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!senderName.trim()) return setErrorMsg("Please enter your name.");
    if (selectedFiles.length === 0) return setErrorMsg("Please attach at least one file.");

    setUploading(true);
    setUploadProgress(0);

    const steps = 40;
    let currentStep = 0;
    const timer = setInterval(async () => {
      currentStep++;
      setUploadProgress(Math.min((currentStep / steps) * 100, 100));

      if (currentStep >= steps) {
        clearInterval(timer);
        const processedFiles: UploadedFile[] = [];
        for (const file of selectedFiles) {
          processedFiles.push({ name: file.name, size: file.size, type: file.type, dataUrl: await readFileAsDataUrl(file) });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing: any[] = JSON.parse(localStorage.getItem("share2me_mock_uploads") || "[]");
        existing.push({
          uploadId: "upl_" + Math.random().toString(36).substr(2, 9),
          receiverUserId: receiver.userId,
          senderName: senderName.trim(),
          message: message.trim(),
          files: processedFiles,
          uploadedAt: new Date().toISOString()
        });
        localStorage.setItem("share2me_mock_uploads", JSON.stringify(existing));

        setUploading(false);
        setUploadComplete(true);
      }
    }, 50);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + ["B", "KB", "MB", "GB"][i];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {/* Subtle brand glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-text-tertiary hover:text-primary text-sm font-medium mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Cancel Transfer
        </Link>

        <AnimatePresence mode="wait">
          {!uploadComplete ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background-card border border-border rounded-3xl p-8 shadow-xl"
            >
              <div className="flex items-center gap-4 mb-8 pb-8 border-b border-border">
                {receiver.profilePhoto ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receiver.profilePhoto} className="w-14 h-14 rounded-full object-cover border border-primary/20" alt="" />
                  </>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                    {receiver.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mb-0.5">SENDING TO</p>
                  <h1 className="text-xl font-semibold text-text-primary leading-tight">{receiver.username}</h1>
                </div>
              </div>

              <form onSubmit={handleSendFiles} className="space-y-6">
                
                {/* File Dropzone */}
                <div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                      isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"
                    } ${uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  >
                    <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-text-primary mb-1">Click or drag files here</p>
                    <p className="text-xs text-text-tertiary">No limits. Send anything.</p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/50 hover:bg-background transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-background-elevated border border-border flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-text-primary truncate">{f.name}</span>
                              <span className="text-xs text-text-tertiary mt-0.5">{formatSize(f.size)}</span>
                            </div>
                          </div>
                          <div className="flex items-center shrink-0 ml-3">
                            {!uploading && (
                              <button type="button" onClick={() => setSelectedFiles(s => s.filter((_, idx) => idx !== i))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-text-tertiary hover:text-status-error hover:border-status-error/50 transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                    <input
                      type="text" required disabled={uploading} placeholder="Your Name"
                      value={senderName} onChange={e => setSenderName(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary/50 rounded-xl pl-11 pr-4 py-3.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-primary" />
                    <textarea
                      placeholder="Add a message (optional)" disabled={uploading} rows={2}
                      value={message} onChange={e => setMessage(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary/50 rounded-xl pl-11 pr-4 py-3.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>

                {errorMsg && <p className="text-status-error text-sm text-center font-medium">{errorMsg}</p>}

                {uploading ? (
                  <div className="pt-4">
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-2">
                      <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 text-primary animate-spin" /> Uploading securely...</span>
                      <span className="text-primary">{Math.floor(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
                      <div className="h-full bg-primary transition-all duration-100 shadow-glow" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button type="submit" className="w-full bg-primary text-background hover:bg-primary-hover font-bold py-3.5 rounded-xl transition-colors mt-4 shadow-glow">
                    Transfer Files
                  </button>
                )}
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background-card border border-border rounded-3xl p-10 text-center shadow-xl"
            >
              <div className="w-16 h-16 rounded-full bg-status-success/10 border border-status-success/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-status-success" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">Transfer Complete</h2>
              <p className="text-text-secondary text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Your files have been securely delivered to <strong>{receiver.username}</strong>&apos;s inbox.
              </p>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => { setSelectedFiles([]); setUploadComplete(false); setUploadProgress(0); }} className="w-full bg-primary text-background font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors shadow-glow">
                  Send More Files
                </button>
                <Link href="/" className="w-full bg-background border border-border text-text-secondary font-bold py-3 rounded-xl hover:bg-background-elevated hover:text-text-primary transition-colors">
                  Return to Home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
