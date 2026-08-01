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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-on-surface">
        <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-2 font-display uppercase">Portal Not Found</h2>
        <p className="text-sm text-text-secondary mb-8 text-center max-w-sm font-body">
          The Share Code &quot;{code}&quot; is invalid or has expired.
        </p>
        <Link href="/" className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:bg-[#ffe170] transition-colors shadow-md">
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden text-on-surface">
      
      {/* Subtle brand glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container border border-outline hover:bg-surface-container-high text-xs font-bold text-on-surface transition-all shadow-sm group mb-8">
          <ArrowLeft className="w-4 h-4 text-primary group-hover:-translate-x-0.5 transition-transform" /> Cancel Transfer
        </Link>

        <AnimatePresence mode="wait">
          {!uploadComplete ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-card border border-outline-variant rounded-2xl p-8 shadow-lg"
            >
              <div className="flex items-center gap-4 mb-8 pb-8 border-b border-outline-variant">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary flex items-center justify-center text-xl font-bold text-primary">
                  {receiver.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-0.5 font-mono">SENDING TO</p>
                  <h1 className="text-xl font-bold text-on-surface leading-tight font-display">{receiver.name}</h1>
                </div>
              </div>

              {!receiver.accepting_requests ? (
                <div className="bg-error/10 border border-error/30 rounded-xl p-4 flex gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-error shrink-0" />
                  <p className="text-sm text-error font-medium">This portal is currently paused and is not accepting new files right now.</p>
                </div>
              ) : null}

              <form onSubmit={handleSendFiles} className="space-y-6">
                
                {/* File Dropzone */}
                <div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative w-full border-2 border-dashed border-outline-variant rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                      isDragging ? "bg-primary/10 border-primary" : "bg-surface-container hover:bg-surface-container-high"
                    } ${uploading || !receiver.accepting_requests ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  >
                    <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading || !receiver.accepting_requests} />
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-on-surface mb-1 font-display">Click or drag files here</p>
                    <p className="text-xs text-text-secondary font-mono">Files are sent directly via Cloudflare R2.</p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-outline bg-surface-container-low hover:bg-surface-container transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-surface-container border border-outline flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-on-surface truncate font-display">{f.name}</span>
                              <span className="text-xs text-text-secondary mt-0.5 font-mono">{formatSize(f.size)}</span>
                            </div>
                          </div>
                          <div className="flex items-center shrink-0 ml-3">
                            {!uploading && (
                              <button type="button" onClick={() => setSelectedFiles(s => s.filter((_, idx) => idx !== i))} className="w-8 h-8 rounded-full bg-surface-container border border-outline flex items-center justify-center text-text-secondary hover:text-error hover:border-error transition-all opacity-0 group-hover:opacity-100">
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
                      className="w-full bg-surface-container border border-outline focus:border-primary rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-primary" />
                    <textarea
                      placeholder="Add a message (optional)" disabled={uploading || !receiver.accepting_requests} rows={2}
                      value={message} onChange={e => setMessage(e.target.value)}
                      className="w-full bg-surface-container border border-outline focus:border-primary rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>

                {errorMsg && <p className="text-error text-sm text-center font-bold font-mono">{errorMsg}</p>}

                {uploading ? (
                  <div className="pt-4">
                    <div className="flex justify-between text-xs font-bold text-text-secondary mb-2 font-mono">
                      <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 text-primary animate-spin" /> Uploading securely...</span>
                      <span className="text-primary">{Math.floor(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden border border-outline-variant">
                      <div className="h-full bg-primary transition-all duration-100" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button 
                    type="submit" 
                    disabled={!receiver.accepting_requests}
                    className="w-full bg-primary text-on-primary hover:bg-[#ffe170] disabled:bg-surface-container disabled:text-text-secondary font-bold py-3.5 rounded-xl border border-transparent shadow-md transition-all mt-4"
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
              className="bg-surface-card border border-outline-variant rounded-2xl p-10 text-center shadow-lg"
            >
              <div className="w-16 h-16 rounded-full bg-status-success/10 border border-status-success/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-status-success" />
              </div>
              <h2 className="text-2xl font-bold text-on-surface mb-3 font-display uppercase">Transfer Complete</h2>
              <p className="text-text-secondary text-sm mb-8 max-w-sm mx-auto leading-relaxed font-body">
                Your files have been securely delivered to <strong>{receiver.name}</strong>&apos;s inbox.
              </p>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => { setSelectedFiles([]); setUploadComplete(false); setUploadProgress(0); }} className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl hover:bg-[#ffe170] transition-colors shadow-md">
                  Send More Files
                </button>
                <Link href="/" className="w-full bg-surface-container border border-outline text-text-secondary font-bold py-3 rounded-xl hover:bg-surface-container-high transition-colors text-center">
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
