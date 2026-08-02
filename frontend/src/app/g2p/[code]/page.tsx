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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center shadow-hard">
          <Loader2 className="w-6 h-6 text-ink animate-spin" strokeWidth={2.5} />
        </div>
        <span className="label-caps text-ink">Looking up portal…</span>
      </div>
    );
  }

  if (!receiver) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-on-surface">
        <div className="card-brutalist p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-error text-surface border-2 border-ink rounded-md flex items-center justify-center mx-auto mb-6 shadow-hard-sm">
            <AlertCircle className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h2 className="font-display font-bold uppercase text-3xl text-ink mb-2">Portal Not Found</h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            The Share Code <span className="font-mono font-bold text-ink">&quot;{code}&quot;</span> is invalid or has expired.
          </p>
          <Link href="/" className="btn-brutalist w-full">
            Return Home
          </Link>
        </div>
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
    setUploadProgress(10);

    try {
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

      const totalFiles = selectedFiles.length;
      let completedFiles = 0;

      for (const file of selectedFiles) {
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

        const { fileId } = await preRes.json();

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
    <div className="min-h-screen bg-background flex flex-col items-center px-5 sm:px-8 py-10 md:py-16 font-body text-on-surface">
      <div className="w-full max-w-xl">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 border-2 border-ink rounded-md px-3 py-1.5 bg-surface hover:bg-signal-yellow transition-colors label-caps text-ink shadow-hard-sm mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
          Cancel Transfer
        </Link>

        <AnimatePresence mode="wait">
          {!uploadComplete ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-brutalist p-6 sm:p-8"
            >
              {/* Recipient header */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b-2 border-ink">
                <div className="w-14 h-14 rounded-md bg-signal-yellow border-2 border-ink flex items-center justify-center font-display font-bold uppercase text-2xl text-ink shadow-hard-sm shrink-0">
                  {receiver.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="label-caps text-on-surface-variant mb-1">// Sending To</p>
                  <h1 className="font-display font-bold uppercase text-2xl md:text-3xl text-ink leading-tight truncate">
                    {receiver.name}
                  </h1>
                </div>
              </div>

              {!receiver.accepting_requests && (
                <div className="bg-error-container border-2 border-error rounded-md p-4 flex gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-on-error-container shrink-0" strokeWidth={2.5} />
                  <p className="text-sm text-on-error-container font-medium">
                    This portal is currently paused and is not accepting new files.
                  </p>
                </div>
              )}

              <form onSubmit={handleSendFiles} className="space-y-6">
                {/* Dropzone */}
                <div>
                  <label className="label-caps text-on-surface-variant block mb-2">// Files</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                      isDragging
                        ? "border-signal-yellow bg-signal-yellow/20"
                        : "border-ink bg-surface-container hover:bg-surface-container-high"
                    } ${uploading || !receiver.accepting_requests ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  >
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading || !receiver.accepting_requests}
                    />
                    <div className="w-14 h-14 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center mb-4 shadow-hard-sm">
                      <Upload className="w-7 h-7 text-ink" strokeWidth={2.5} />
                    </div>
                    <p className="font-display font-bold uppercase text-lg text-ink mb-1">
                      Click or drag files here
                    </p>
                    <p className="label-caps text-on-surface-variant">Direct upload via Cloudflare R2</p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedFiles.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-md border-2 border-ink bg-surface hover:bg-surface-container transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-md bg-signal-yellow border-2 border-ink flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-ink" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-ink truncate">{f.name}</span>
                              <span className="label-caps text-on-surface-variant mt-0.5">{formatSize(f.size)}</span>
                            </div>
                          </div>
                          {!uploading && (
                            <button
                              type="button"
                              onClick={() => setSelectedFiles(s => s.filter((_, idx) => idx !== i))}
                              className="w-8 h-8 rounded-md border-2 border-ink bg-surface flex items-center justify-center text-ink hover:bg-error hover:text-surface transition-all shrink-0 ml-3"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sender fields */}
                <div className="space-y-4">
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-2">// Your Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink" strokeWidth={2.5} />
                      <input
                        type="text" required disabled={uploading || !receiver.accepting_requests}
                        placeholder="Jane Doe"
                        value={senderName} onChange={e => setSenderName(e.target.value)}
                        className="input-brutalist pl-11"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-caps text-on-surface-variant block mb-2">// Message (optional)</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-ink" strokeWidth={2.5} />
                      <textarea
                        placeholder="Say something…" disabled={uploading || !receiver.accepting_requests} rows={2}
                        value={message} onChange={e => setMessage(e.target.value)}
                        className="input-brutalist pl-11 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-error-container border-2 border-error rounded-md p-3 text-on-error-container text-sm font-mono">
                    {errorMsg}
                  </div>
                )}

                {uploading ? (
                  <div className="pt-2">
                    <div className="flex justify-between mb-2">
                      <span className="label-caps text-ink flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                        Uploading securely…
                      </span>
                      <span className="label-caps text-ink">{Math.floor(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-3 bg-surface-container border-2 border-ink rounded-full overflow-hidden">
                      <div
                        className="h-full bg-signal-yellow transition-all duration-100 rounded-full border-r-2 border-ink"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!receiver.accepting_requests}
                    className="btn-brutalist w-full disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Transfer Files →
                  </button>
                )}
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-brutalist p-10 text-center"
            >
              <div className="w-16 h-16 bg-signal-yellow border-2 border-ink rounded-md flex items-center justify-center mx-auto mb-6 shadow-hard">
                <CheckCircle2 className="w-9 h-9 text-ink" strokeWidth={2.5} />
              </div>
              <h2 className="font-display font-bold uppercase text-3xl text-ink mb-3">Transfer Complete</h2>
              <p className="text-on-surface-variant mb-8 max-w-sm mx-auto leading-relaxed">
                Your files have been securely delivered to{" "}
                <strong className="text-ink">{receiver.name}</strong>&apos;s inbox.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setSelectedFiles([]);
                    setUploadComplete(false);
                    setUploadProgress(0);
                  }}
                  className="btn-brutalist w-full"
                >
                  Send More Files
                </button>
                <Link href="/" className="btn-brutalist-ghost w-full">
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
