"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Upload, User, MessageSquare, CheckCircle2,
  FileText, ArrowLeft, Trash2, Loader2, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";

interface VendorProfile {
  id: string;
  name: string;
  accepting_requests: boolean;
}

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function G2pSenderPortal({ params }: PageProps) {
  const { code } = use(params);
  const [receiver, setReceiver] = useState<VendorProfile | null>(null);
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
    fetch(`${EXPRESS_BACKEND_URL}/g2p/requests/vendor/${code}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.id) setReceiver(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch vendor", err);
        setLoading(false);
      });
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

  const handleSendFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!senderName.trim()) return setErrorMsg("Please enter your name.");
    if (selectedFiles.length === 0) return setErrorMsg("Please attach at least one file.");
    if (!receiver.accepting_requests) return setErrorMsg("This portal is currently not accepting files.");

    setUploading(true);
    setUploadProgress(10); // Initial progress indicating we are contacting backend

    try {
      // 1. Create the Request Container (Safe transactional lock)
      const reqRes = await fetch(`${EXPRESS_BACKEND_URL}/g2p/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: receiver.id,
          deviceMetadata: { senderName: senderName.trim(), message: message.trim() }
        })
      });

      if (!reqRes.ok) {
        const errData = await reqRes.json();
        throw new Error(errData.message || errData.error || "Failed to create request");
      }
      
      const { id: requestId, status_token: statusToken } = await reqRes.json();
      setUploadProgress(20);

      // 2. Upload Each File Directly to S3/R2
      const totalFiles = selectedFiles.length;
      let completedFiles = 0;

      for (const file of selectedFiles) {
        // A. Presign Upload URL
        const preRes = await fetch(`${EXPRESS_BACKEND_URL}/g2p/files/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            statusToken,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size
          })
        });

        if (!preRes.ok) {
          const errData = await preRes.json();
          throw new Error(errData.message || `Failed to initialize upload for ${file.name}`);
        }
        
        const { fileId, presignedUrl } = await preRes.json();

        // B. Proxy Upload (Bypassing CORS entirely)
        const proxyUrl = `${EXPRESS_BACKEND_URL}/g2p/files/${fileId}/upload`;
        const uploadRes = await fetch(proxyUrl, {
          method: "PUT",
          body: file,
          headers: { 
            "Content-Type": file.type || 'application/octet-stream',
            "x-status-token": statusToken
          }
        });

        if (!uploadRes.ok) throw new Error(`Cloudflare rejected upload for ${file.name}`);

        // C. Complete & Verify Upload
        const completeRes = await fetch(`${EXPRESS_BACKEND_URL}/g2p/files/${fileId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statusToken })
        });
        
        if (!completeRes.ok) {
          const errData = await completeRes.json();
          throw new Error(errData.error || "Backend failed to verify the upload");
        }

        completedFiles++;
        setUploadProgress(20 + (completedFiles / totalFiles) * 80);
      }

      setUploadComplete(true);
    } catch (err: any) {
      console.error("Upload process error:", err);
      
      // If it's a TypeError: Failed to fetch during the PUT request, it's a network/CORS issue
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setErrorMsg("Network error: The backend server rejected the upload connection.");
      } else {
        setErrorMsg(err.message || "An error occurred during upload. Please try again.");
      }
    } finally {
      setUploading(false);
    }
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
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                  {receiver.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mb-0.5">SENDING TO</p>
                  <h1 className="text-xl font-semibold text-text-primary leading-tight">{receiver.name}</h1>
                </div>
              </div>

              {!receiver.accepting_requests ? (
                <div className="bg-status-error/10 border border-status-error/30 rounded-xl p-4 flex gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-status-error shrink-0" />
                  <p className="text-sm text-status-error font-medium">This portal is currently paused and is not accepting new files right now.</p>
                </div>
              ) : null}

              <form onSubmit={handleSendFiles} className="space-y-6">
                
                {/* File Dropzone */}
                <div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                      isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"
                    } ${uploading || !receiver.accepting_requests ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  >
                    <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading || !receiver.accepting_requests} />
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-text-primary mb-1">Click or drag files here</p>
                    <p className="text-xs text-text-tertiary">Files are sent directly via Cloudflare R2.</p>
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
                      type="text" required disabled={uploading || !receiver.accepting_requests} placeholder="Your Name"
                      value={senderName} onChange={e => setSenderName(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary/50 rounded-xl pl-11 pr-4 py-3.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-primary" />
                    <textarea
                      placeholder="Add a message (optional)" disabled={uploading || !receiver.accepting_requests} rows={2}
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
                  <button 
                    type="submit" 
                    disabled={!receiver.accepting_requests}
                    className="w-full bg-primary text-background disabled:bg-background-elevated disabled:text-text-tertiary hover:bg-primary-hover font-bold py-3.5 rounded-xl transition-colors mt-4 shadow-glow"
                  >
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
                Your files have been securely delivered to <strong>{receiver.name}</strong>&apos;s inbox.
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
