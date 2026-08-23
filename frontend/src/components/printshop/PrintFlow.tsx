"use client";

/**
 * Student-facing print flow on /g2p/[code]:
 *   1. Upload document  → page count via pdf-lib (client-side)
 *   2. Select print type → B&W / Color cards + live total
 *   3. Payment          → shop's UPI QR, amount, "Payment Pending"
 *   4. Confirmation     → pending screen that flips to ✓ success once the
 *                         shopkeeper confirms via Socket.IO real-time event.
 *
 * The student can NOT self-confirm payment — confirmation always
 * comes from the shopkeeper via PATCH /printshop/jobs/:id/confirm.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
/* eslint-disable @next/next/no-img-element */
import {
  Upload, FileText, Printer, Palette, CheckCircle2, Loader2, Clock,
  Download, IndianRupee, MapPin, ChevronLeft, QrCode, Banknote, Check,
} from "lucide-react";
import QRCode from "react-qr-code";
import {
  getPublicShopSettings, submitPrintJob, inr, formatBytes, DEFAULT_SETTINGS,
  type PrintType, type PrintJob, type PublicShopInfo, type PaymentMethod, type PrintConfig,
} from "@/lib/printShop";
import { countPages } from "@/lib/pageCount";
import { io as socketIO } from "socket.io-client";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS = ["Upload", "Print type", "Configure", "Payment", "Done"];

export function PrintFlow({ shopCode, shopName }: { shopCode: string; shopName: string }) {
  const [settings, setSettings] = useState<PublicShopInfo | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasPaidOnline, setHasPaidOnline] = useState(false);

  const submittingRef = useRef(false);

  // Load real shop settings from backend on mount
  useEffect(() => {
    getPublicShopSettings(shopCode)
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setSettingsLoading(false));
  }, [shopCode]);

  // Handle Stripe success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && params.get('jobId')) {
      const jobId = params.get('jobId')!;
      setJobs([{
        id: jobId, documentName: "Document", fileSizeBytes: 0, fileType: "",
        pages: 1, senderName: "You", printType: "bw", pricePerPage: 0,
        totalAmount: 0, paymentMethod: "online", paymentStatus: "paid",
        paymentId: "stripe", paidAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        printConfig: { copies: 1, paperSize: 'A4', doubleSided: false, stapling: false }
      }]);
      setStep(4);
    }
  }, []);

  // Step 1 state
  const [filesState, setFilesState] = useState<{ id: string; file: File; pages: number; counting: boolean; config?: PrintConfig & { printType?: PrintType } }[]>([]);
  const [senderName, setSenderName] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [printType, setPrintType] = useState<PrintType | null>(null);

  // Step 3 (Config) state
  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    copies: 1,
    doubleSided: false,
    stapling: false,
    paperSize: 'A4',
  });

  // Step 4/5 state
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  const effectiveSettings = settings ?? DEFAULT_SETTINGS;
  const qrConfigured = !!effectiveSettings.qrUrl || !!effectiveSettings.charges_enabled;
  
  const total = useMemo(() => {
    if (!printType) return 0;
    let sum = 0;
    for (const fs of filesState) {
      if (!fs.pages) continue;
      const type = fs.config?.printType || printType;
      const price = type === "color" ? effectiveSettings.colorPrice : effectiveSettings.bwPrice;
      const copies = fs.config?.copies || printConfig.copies || 1;
      const dSided = fs.config?.doubleSided ?? printConfig.doubleSided;
      const effectivePages = dSided ? Math.ceil(fs.pages / 2) : fs.pages;
      sum += effectivePages * price * copies;
    }
    return sum;
  }, [filesState, printType, printConfig, effectiveSettings]);

  const isCounting = filesState.some(f => f.counting);
  const totalPages = filesState.reduce((sum, f) => sum + (f.pages || 0), 0);  // ── Step 1: upload + page count ────────────────────────────────
  const handleFiles = async (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).slice(0, 10 - filesState.length);
    if (newFiles.length === 0) return;

    const added = newFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      pages: 0,
      counting: true
    }));
    
    setFilesState(prev => [...prev, ...added]);

    for (const item of added) {
      try {
        const p = await countPages(item.file);
        setFilesState(prev => prev.map(fs => fs.id === item.id ? { ...fs, pages: p, counting: false } : fs));
      } catch {
        setFilesState(prev => prev.map(fs => fs.id === item.id ? { ...fs, pages: 1, counting: false } : fs));
      }
    }
  };

  const removeFile = (id: string) => {
    setFilesState(prev => prev.filter(fs => fs.id !== id));
  };

  // ── Step 3 → 4: submit job to backend ──────────────────────────
  const submitJob = async (method: PaymentMethod) => {
    if (filesState.length === 0 || !printType || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // @ts-ignore
      const { submitBulkPrintJob } = await import("@/lib/printShop");
      
      const payloadFiles = filesState.map(fs => {
        const dSided = fs.config?.doubleSided ?? printConfig.doubleSided;
        const effectivePages = dSided ? Math.ceil(fs.pages / 2) : fs.pages;
        return {
          documentName: fs.file.name,
          fileSizeBytes: fs.file.size,
          fileType: fs.file.type || "application/octet-stream",
          pages: effectivePages,
          printConfig: fs.config,
        };
      });

      const result = await submitBulkPrintJob({
        shopCode,
        senderName: senderName.trim() || "Anonymous",
        paymentMethod: method,
        printType,
        files: payloadFiles,
      });

      // Upload all files concurrently
      await Promise.all(result.jobs.map((job, idx) => {
        if (!job.uploadUrl) return Promise.resolve();
        const fileObj = filesState[idx].file;
        return fetch(job.uploadUrl, {
          method: 'PUT',
          body: fileObj,
          headers: { 'Content-Type': fileObj.type || "application/octet-stream" }
        }).then(res => {
          if (!res.ok) throw new Error("Failed to upload document");
        });
      }));


      const createdJobs: PrintJob[] = result.jobs.map((j, idx) => ({
        id: j.jobId, documentName: filesState[idx].file.name, fileSizeBytes: filesState[idx].file.size,
        fileType: filesState[idx].file.type || "application/octet-stream", pages: payloadFiles[idx].pages,
        senderName: senderName.trim() || "Anonymous", printType: payloadFiles[idx].printConfig?.printType || printType,
        pricePerPage: j.pricePerPage, totalAmount: j.totalAmount,
        paymentMethod: method, paymentStatus: "pending",
        paymentId: null, paidAt: null,
        createdAt: j.createdAt, printConfig: payloadFiles[idx].printConfig || printConfig,
      }));
      setJobs(createdJobs);
      setStep(5);
    } catch (err: unknown) {
      console.error(err);
      setSubmitError(err instanceof Error && err.message === "shop_not_accepting" ? "This shop is not currently accepting orders." : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  useEffect(() => {
    if (step !== 5 || jobs.length === 0) return;
    
    const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || process.env.NEXT_PUBLIC_SIGNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://share2me-version-2-0.onrender.com";
    
    const socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || EXPRESS_BACKEND_URL,
      { transports: ["websocket", "polling"] }
    );

    socket.on("connect", () => {
      for (const j of jobs) {
        socket.emit("g2p:join_job_room", { jobId: j.id });
      }
    });

    socket.on("printshop:job_updated", (payload: { jobId: string; paymentStatus?: string; paymentId?: string; paidAt?: string; jobStatus?: string; printedAt?: string }) => {
      setJobs(prev => prev.map(j => {
        if (j.id !== payload.jobId) return j;
        return {
          ...j,
          paymentStatus: (payload.paymentStatus || j.paymentStatus) as any,
          paymentId: payload.paymentId || j.paymentId,
          paidAt: payload.paidAt || j.paidAt,
          jobStatus: (payload.jobStatus || j.jobStatus) as any,
          printedAt: payload.printedAt || j.printedAt
        };
      }));
    });
    return () => { socket.disconnect(); };
  }, [step, jobs.length]);

  if (settingsLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-[#111827] border-t-transparent animate-spin" />
    </div>
  );

  const downloadReceipt = async () => {
    if (jobs.length === 0) return;
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      // Standard A4 size
      const page = doc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      
      const colors = {
        primary: rgb(0.067, 0.094, 0.153),   // #111827
        secondary: rgb(0.294, 0.333, 0.388), // #4b5563
        lightGray: rgb(0.953, 0.957, 0.965), // #f3f4f6
        border: rgb(0.898, 0.906, 0.922),    // #e5e7eb
        success: rgb(0.063, 0.725, 0.506),   // #10b981
        white: rgb(1, 1, 1),
      };

      // 1. Watermark
      page.drawText("SHARE2ME", {
        x: width / 2 - 180,
        y: height / 2 - 100,
        size: 80,
        font: bold,
        color: rgb(0.96, 0.97, 0.98),
        rotate: degrees(45),
      });

      // 2. Header Block
      page.drawRectangle({
        x: 0,
        y: height - 120,
        width: width,
        height: 120,
        color: colors.primary,
      });
      
      try {
        const logoRes = await fetch('/logo.png');
        if (logoRes.ok) {
          const logoBytes = await logoRes.arrayBuffer();
          const logoImage = await doc.embedPng(logoBytes);
          const scale = 30 / logoImage.height;
          page.drawImage(logoImage, {
            x: 40,
            y: height - 60,
            width: logoImage.width * scale,
            height: 30,
          });
        } else {
          page.drawText("SHARE2ME", { x: 40, y: height - 50, size: 24, font: bold, color: colors.white });
        }
      } catch (e) {
        page.drawText("SHARE2ME", { x: 40, y: height - 50, size: 24, font: bold, color: colors.white });
      }
      page.drawText("OFFICIAL RECEIPT", { x: width - 230, y: height - 50, size: 18, font: bold, color: colors.white });
      page.drawText(`Shop: ${shopName} (${shopCode})`, { x: 40, y: height - 80, size: 12, font, color: colors.border });
      
      const dateStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      page.drawText(`Date: ${dateStr}`, { x: width - 230, y: height - 80, size: 10, font, color: colors.border });

      // 3. Customer & Payment Details (2 columns)
      let currentY = height - 180;
      const leftX = 40;
      const rightX = width / 2 + 40;
      
      // Billing To
      page.drawText("Billed To", { x: leftX, y: currentY, size: 10, font: bold, color: colors.secondary });
      page.drawText(jobs[0].senderName || "Guest", { x: leftX, y: currentY - 20, size: 14, font: bold, color: colors.primary });
      
      // Payment Details
      page.drawText("Payment Info", { x: rightX, y: currentY, size: 10, font: bold, color: colors.secondary });
      page.drawText(`Method: ${jobs[0].paymentMethod?.toUpperCase() || "ONLINE"}`, { x: rightX, y: currentY - 20, size: 11, font, color: colors.primary });
      page.drawText(`Status:`, { x: rightX, y: currentY - 40, size: 11, font, color: colors.primary });
      
      const statusText = jobs[0].paymentStatus.toUpperCase();
      const statusColor = statusText === 'PAID' ? colors.success : colors.secondary;
      page.drawText(statusText, { x: rightX + 45, y: currentY - 40, size: 11, font: bold, color: statusColor });
      
      if (jobs[0].paymentId) {
        page.drawText(`Txn ID: ${jobs[0].paymentId}`, { x: rightX, y: currentY - 60, size: 10, font, color: colors.secondary });
      }

      currentY -= 110;

      // 4. Items Table Header
      page.drawRectangle({
        x: 40,
        y: currentY,
        width: width - 80,
        height: 30,
        color: colors.lightGray,
      });
      
      const col1 = 50;
      const col2 = 330;
      const col3 = 450;
      
      page.drawText("Description", { x: col1, y: currentY + 10, size: 10, font: bold, color: colors.secondary });
      page.drawText("Pages / Type", { x: col2, y: currentY + 10, size: 10, font: bold, color: colors.secondary });
      page.drawText("Amount", { x: col3, y: currentY + 10, size: 10, font: bold, color: colors.secondary });

      currentY -= 30;

      // 5. Items Rows
      let totalAmount = 0;
      for (const j of jobs) {
        totalAmount += j.totalAmount;
        
        let docName = j.documentName;
        if (docName.length > 40) docName = docName.substring(0, 37) + "...";
        
        page.drawText(docName, { x: col1, y: currentY, size: 11, font, color: colors.primary });
        page.drawText(`${j.pages} pgs - ${j.printType.toUpperCase()}`, { x: col2, y: currentY, size: 11, font, color: colors.secondary });
        page.drawText(inr(j.totalAmount).replace('₹', 'Rs. '), { x: col3, y: currentY, size: 11, font: bold, color: colors.primary });
        
        page.drawLine({
          start: { x: 40, y: currentY - 10 },
          end: { x: width - 40, y: currentY - 10 },
          thickness: 1,
          color: colors.border,
        });
        
        currentY -= 30;
        if (jobs.length > 10 && currentY < 150) break; // Simple safeguard
      }

      // 6. Totals
      currentY -= 20;
      page.drawText("Total Paid", { x: col2, y: currentY, size: 12, font: bold, color: colors.secondary });
      page.drawText(inr(totalAmount).replace('₹', 'Rs. '), { x: col3, y: currentY, size: 16, font: bold, color: colors.primary });

      // 7. Footer
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 50,
        color: colors.lightGray,
      });
      page.drawText("Generated securely by Share2Me | share2.me", {
        x: width / 2 - 110,
        y: 20,
        size: 10,
        font,
        color: colors.secondary,
      });

      // Save and Download
      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Share2Me-Receipt-${shopName.replace(/\s+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate receipt", err);
    }
  };

  const isPaid = jobs.length > 0 && jobs.every(j => j.paymentStatus === "paid");

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="text-[12px] text-[#111827]/60">Printing at</p>
          <h2 className="text-[18px] font-bold text-[#111827] leading-tight flex items-center gap-2">
            {shopName}
            {effectiveSettings.locationName && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#111827]/60">
                <MapPin className="w-3 h-3" /> {effectiveSettings.locationName}
              </span>
            )}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
            qrConfigured ? "bg-emerald-500/15 text-emerald-700" : "bg-orange-500/15 text-orange-700"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${qrConfigured ? "bg-emerald-500" : "bg-orange-500"}`} />
          {qrConfigured ? "UPI payments accepted" : "Payment QR not set up"}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n || (n === 4 && isPaid);
          const current = step === n;
          return (
            <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                  done ? "bg-emerald-500 text-white"
                  : current ? "bg-[#111827] text-white"
                  : "bg-white/60 text-[#111827]/50 border border-white/70"
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : n}
              </span>
              <span className={`text-[11px] font-semibold truncate ${current ? "text-[#111827]" : "text-[#111827]/50"}`}>
                {label}
              </span>
              {i < 3 && <span className="flex-1 h-px bg-[#111827]/10 min-w-2" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            {effectiveSettings.isAccepting === false ? (
              <div className="rounded-2xl border-2 border-red-500/20 bg-red-500/5 p-8 text-center">
                <span className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                  <span className="text-xl font-bold">&times;</span>
                </span>
                <p className="text-[16px] font-extrabold text-[#111827]">Currently Not Accepting Orders</p>
                <p className="text-[13px] text-[#111827]/60 mt-2 max-w-[300px] mx-auto">
                  This shop is temporarily closed for new print orders. Please check back later.
                </p>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  dragging ? "border-emerald-500 bg-emerald-500/10" : "border-[#111827]/20 bg-white/40 hover:bg-white/60"
                }`}
              >
                <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                <Upload className="w-8 h-8 mx-auto text-[#111827]/50 mb-3" strokeWidth={1.75} />
                <p className="text-[14px] font-semibold text-[#111827]">Drop documents here or tap to browse</p>
                <p className="text-[12px] text-[#111827]/50 mt-1">Select up to 10 files. Pages counted automatically.</p>
              </div>
            )}

            {effectiveSettings.isAccepting !== false && filesState.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                {filesState.map(fs => (
                  <div key={fs.id} className="flex items-center gap-3 bg-white/60 border border-white/70 rounded-2xl p-3 shrink-0">
                    <span className="w-10 h-10 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[#111827] truncate">{fs.file.name}</p>
                      <p className="text-[11px] text-[#111827]/60">
                        {formatBytes(fs.file.size)}
                        {" · "}
                        {fs.counting ? (
                          <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> counting...</span>
                        ) : (
                          <span className="font-semibold text-[#111827]">{fs.pages} page{fs.pages !== 1 ? "s" : ""}</span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => removeFile(fs.id)} className="w-8 h-8 flex items-center justify-center text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                      <span className="text-xl leading-none">&times;</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {effectiveSettings.isAccepting !== false && (
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your name"
                className="mt-4 w-full bg-white/60 border border-white/70 rounded-full px-5 py-3 text-[14px] text-[#111827] focus:outline-none focus:border-[#111827]/40"
              />
            )}

            {effectiveSettings.isAccepting !== false && (
              <button
                disabled={filesState.length === 0 || isCounting || totalPages === 0 || !senderName.trim()}
                onClick={() => setStep(2)}
                className="mt-4 w-full h-12 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors disabled:opacity-40"
              >
                Continue
              </button>
            )}
          </motion.div>
        )}

        {step === 2 && filesState.length > 0 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-3">Select printing type</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { type: "bw" as PrintType,    icon: Printer, title: "Black & White", price: effectiveSettings.bwPrice,    grad: ["#4b5563", "#111827"] },
                { type: "color" as PrintType, icon: Palette, title: "Color",          price: effectiveSettings.colorPrice, grad: ["#f472b6", "#8b5cf6"] },
              ].map(({ type, icon: Icon, title, price, grad }) => {
                const active = printType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setPrintType(type)}
                    className={`text-left p-5 rounded-2xl border transition-all ${
                      active ? "bg-white border-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : "bg-white/50 border-white/70 hover:bg-white/80"
                    }`}
                  >
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
                      <Icon className="w-5 h-5 text-white" />
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[15px] text-[#111827]">{title}</span>
                      <span className={`w-4 h-4 rounded-full border-2 ${active ? "border-[#111827] bg-[#111827]" : "border-[#111827]/30"}`} />
                    </div>
                    <p className="text-[13px] text-[#111827]/60 mt-1">{inr(price)} per page</p>
                  </button>
                );
              })}
            </div>

            {printType && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-white/60 border border-white/70 rounded-2xl p-4 text-[13px]">
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Total Pages</span><b>{totalPages}</b></div>
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Default Print type</span><b>{printType === "color" ? "Color" : "Black & White"}</b></div>
                <div className="flex justify-between py-2 mt-1 border-t border-[#111827]/10 text-[16px]">
                  <span className="font-bold text-[#111827]">Total</span>
                  <span className="font-extrabold text-[#111827]">{inr(total)}</span>
                </div>
              </motion.div>
            )}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!printType}
                onClick={() => setStep(3)}
                className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors disabled:opacity-40"
              >
                Continue to settings
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && filesState.length > 0 && printType && (
          <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-1">Configure printing</h3>
            <p className="text-[12px] text-[#111827]/60 mb-4">Defaults are pre-filled — adjust as needed or go straight to payment.</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/60 border border-white/70 rounded-2xl p-4">
                <p className="text-[12px] font-bold text-[#111827] mb-2">Copies</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPrintConfig(c => ({ ...c, copies: Math.max(1, c.copies - 1) }))} className="w-8 h-8 rounded-full bg-[#111827]/10 text-[#111827] font-bold text-[16px] flex items-center justify-center hover:bg-[#111827]/20">-</button>
                  <span className="text-[18px] font-extrabold text-[#111827] w-8 text-center">{printConfig.copies}</span>
                  <button onClick={() => setPrintConfig(c => ({ ...c, copies: Math.min(20, c.copies + 1) }))} className="w-8 h-8 rounded-full bg-[#111827]/10 text-[#111827] font-bold text-[16px] flex items-center justify-center hover:bg-[#111827]/20">+</button>
                </div>
              </div>

              <div className="bg-white/60 border border-white/70 rounded-2xl p-4">
                <p className="text-[12px] font-bold text-[#111827] mb-2">Paper size</p>
                <div className="flex gap-2">
                  {(['A4', 'A3'] as const).map(size => (
                    <button key={size} onClick={() => setPrintConfig(c => ({ ...c, paperSize: size }))}
                      className={`flex-1 h-8 rounded-xl text-[13px] font-bold transition-all ${
                        printConfig.paperSize === size ? 'bg-[#111827] text-white' : 'bg-[#111827]/10 text-[#111827]'
                      }`}>{size}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setPrintConfig(c => ({ ...c, doubleSided: !c.doubleSided }))}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                  printConfig.doubleSided ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/60 border-white/70'
                }`}>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                  printConfig.doubleSided ? 'bg-emerald-500 border-emerald-500' : 'border-[#111827]/30'
                }`}>
                  {printConfig.doubleSided && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                <div>
                  <p className="text-[12px] font-bold text-[#111827]">Double-sided</p>
                  <p className="text-[10px] text-[#111827]/50">Saves ~50% pages</p>
                </div>
              </button>

              <button onClick={() => setPrintConfig(c => ({ ...c, stapling: !c.stapling }))}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                  printConfig.stapling ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/60 border-white/70'
                }`}>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                  printConfig.stapling ? 'bg-emerald-500 border-emerald-500' : 'border-[#111827]/30'
                }`}>
                  {printConfig.stapling && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                <div>
                  <p className="text-[12px] font-bold text-[#111827]">Stapling</p>
                  <p className="text-[10px] text-[#111827]/50">Bind all pages</p>
                </div>
              </button>
            </div>

            {filesState.length > 1 && (
              <div className="mb-4">
                <p className="text-[12px] font-bold text-[#111827] mb-2">Individual file settings (optional)</p>
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin">
                  {filesState.map(fs => (
                    <div key={fs.id} className="bg-white/60 border border-white/70 rounded-2xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#111827] truncate">{fs.file.name}</p>
                        <p className="text-[10px] text-[#111827]/60">{fs.pages} pages</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="text-[11px] font-semibold bg-[#111827]/5 border-none rounded-lg px-2 py-1 outline-none text-[#111827]"
                          value={fs.config?.printType || printType || "bw"}
                          onChange={(e) => setFilesState(prev => prev.map(f => f.id === fs.id ? { ...f, config: { ...(f.config || printConfig), printType: e.target.value as PrintType } } : f))}
                        >
                          <option value="bw">B&W</option>
                          <option value="color">Color</option>
                        </select>
                        <div className="flex items-center bg-[#111827]/5 rounded-lg px-2 py-1 text-[#111827]">
                          <button className="text-[14px] font-bold px-1" onClick={() => setFilesState(prev => prev.map(f => f.id === fs.id ? { ...f, config: { ...(f.config || printConfig), copies: Math.max(1, (f.config?.copies || printConfig.copies) - 1) } } : f))}>-</button>
                          <span className="text-[12px] font-bold w-4 text-center">{fs.config?.copies || printConfig.copies}</span>
                          <button className="text-[14px] font-bold px-1" onClick={() => setFilesState(prev => prev.map(f => f.id === fs.id ? { ...f, config: { ...(f.config || printConfig), copies: Math.min(20, (f.config?.copies || printConfig.copies) + 1) } } : f))}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(4)} className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors inline-flex items-center justify-center">
                Continue to payment · {inr(total)}
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-1">Complete payment</h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {[
                {
                  method: "online" as PaymentMethod, icon: QrCode, title: "Pay online",
                  desc: effectiveSettings.charges_enabled ? "Pay securely via Razorpay (UPI, Card)" : "Not available — Shop hasn't enabled online payments",
                  disabled: !effectiveSettings.charges_enabled, grad: ["#34d399", "#059669"],
                },
                {
                  method: "cash" as PaymentMethod, icon: Banknote, title: "Pay cash",
                  desc: "Pay at the counter on pickup",
                  disabled: false, grad: ["#fbbf24", "#d97706"],
                },
              ].map(({ method, icon: Icon, title, desc, disabled, grad }) => {
                const active = payMethod === method;
                return (
                  <button
                    key={method}
                    disabled={disabled}
                    onClick={() => setPayMethod(method)}
                    className={`text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      active ? "bg-white border-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : "bg-white/50 border-white/70 hover:bg-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                        style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
                        <Icon className="w-5 h-5 text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[14px] text-[#111827] block">{title}</span>
                        <span className="text-[11px] text-[#111827]/60">{desc}</span>
                      </div>
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? "border-[#111827] bg-[#111827]" : "border-[#111827]/30"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {payMethod === "online" && effectiveSettings.charges_enabled && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center bg-white/60 border border-white/70 rounded-2xl p-6 text-center">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#34d399] to-[#059669] text-white flex items-center justify-center mb-3 shadow-md">
                  <QrCode className="w-7 h-7" />
                </span>
                <p className="text-[16px] font-extrabold text-[#111827]">Pay {inr(total)} via UPI</p>
                <p className="mt-2 text-[12px] text-[#111827]/60 max-w-[300px]">You will be prompted to scan a QR code or use a UPI app after submitting your order.</p>
              </motion.div>
            )}

            {payMethod === "cash" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center bg-white/60 border border-white/70 rounded-2xl p-6 text-center">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fbbf24] to-[#d97706] text-white flex items-center justify-center mb-3 shadow-md">
                  <Banknote className="w-7 h-7" />
                </span>
                <p className="text-[16px] font-extrabold text-[#111827]">Pay {inr(total)} in cash at the counter</p>
                <p className="mt-2 text-[12px] text-[#111827]/60 max-w-[300px]">
                  No online payment needed. Hand over {inr(total)} when you collect your prints — the shopkeeper
                  will mark it as paid.
                </p>
              </motion.div>
            )}

            {submitError && <p className="mt-3 text-red-500 text-[12px] font-semibold text-center">{submitError}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(3)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!payMethod || submitting}
                onClick={() => payMethod && submitJob(payMethod)}
                className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : (payMethod === "cash" ? `Submit — Pay ${inr(total)} cash at counter` : `Submit & Pay ${inr(total)} via UPI`)}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5 — Pending → Success ── */}
        {step === 5 && jobs.length > 0 && (() => {
          const isPaid = jobs.every(j => j.paymentStatus === "paid");
          const isPrinted = jobs.every(j => j.jobStatus === "printed");
          const batchTotal = jobs.reduce((sum, j) => sum + j.totalAmount, 0);
          const docName = jobs.length === 1 ? jobs[0].documentName : `${jobs.length} documents`;

          if (isPaid && isPrinted) {
            return (
              <motion.div key="s5-done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-8">
                <motion.span
                  initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                  className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-5 shadow-[0_12px_32px_rgba(16,185,129,0.4)]"
                >
                  <CheckCircle2 className="w-10 h-10" />
                </motion.span>
                <h3 className="text-[24px] font-extrabold text-[#111827] mb-2">Thank you!</h3>
                <p className="text-[14px] text-[#111827]/70 max-w-[300px] mb-6">
                  Your payment is confirmed and your document is printed. Please collect your prints from the counter.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                  <button onClick={downloadReceipt} className="flex-1 h-12 rounded-full bg-white/80 border border-white text-[#111827] text-[14px] font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-white transition-colors">
                    <Download className="w-4 h-4" /> Receipt
                  </button>
                  <button onClick={() => {
                    setJobs([]); setFilesState([]); setPrintType(null); setPayMethod(null); setStep(1);
                  }} className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-black transition-colors">
                    <Upload className="w-4 h-4" /> Send more
                  </button>
                </div>
              </motion.div>
            );
          }

          if (isPaid && !isPrinted) {
            return (
              <motion.div key="s5-paid" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-8">
                <motion.span
                  initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                  className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-[0_12px_32px_rgba(16,185,129,0.4)]"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.span>
                <h3 className="text-[20px] font-extrabold text-[#111827]">Payment Successful</h3>
                <p className="text-[13px] text-[#111827]/60 mt-1 mb-4">
                  {jobs[0].senderName} · {docName}
                </p>
                <div className="w-full max-w-sm text-left bg-white/70 rounded-2xl border border-white/80 p-4 text-[13px] mb-5">
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Amount paid</span><b className="text-emerald-600">{inr(batchTotal)} Paid</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Payment ID</span><b className="font-mono text-[11px]">{jobs[0].paymentId}</b></div>
                </div>
                <div className="flex items-center gap-3 bg-blue-500/10 text-blue-700 px-4 py-3 rounded-xl border border-blue-500/20 text-[13px] text-left w-full max-w-sm mb-5">
                  <Printer className="w-5 h-5 shrink-0" />
                  <p>Your document is in the print queue. We'll update this screen as soon as it's printed!</p>
                </div>
                <button onClick={downloadReceipt} className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#111827] text-white text-[13px] font-semibold hover:bg-black transition-colors">
                  <Download className="w-4 h-4" /> Download receipt
                </button>
              </motion.div>
            );
          }

          if (isPrinted && !isPaid) {
            return (
              <motion.div key="s5-printed" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-8">
                <motion.span
                  initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                  className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center mb-4 shadow-[0_12px_32px_rgba(59,130,246,0.4)]"
                >
                  <Printer className="w-8 h-8" />
                </motion.span>
                <h3 className="text-[20px] font-extrabold text-[#111827]">Document Printed!</h3>
                <p className="text-[13px] text-[#111827]/60 mt-2 max-w-[320px]">
                  <b>{docName}</b> ready to collect.
                </p>
                <div className="mt-5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 max-w-[300px] w-full">
                  <p className="text-[14px] font-bold text-amber-700 mb-1">Payment Required</p>
                  <p className="text-[13px] text-amber-700/80">Please pay <b>{inr(batchTotal)}</b> at the counter to collect your prints.</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-[12px] text-[#111827]/50">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for shopkeeper to confirm payment...
                </span>
              </motion.div>
            );
          }

          // !isPaid && !isPrinted (Pending both)
          const isOnline = jobs[0].paymentMethod === "online";
          const upiUri = isOnline && effectiveSettings.upiId ? 
            `upi://pay?pa=${effectiveSettings.upiId}&pn=${encodeURIComponent(effectiveSettings.upiName || shopName)}&am=${batchTotal}&cu=INR` : null;

          return (
            <motion.div key="s5-pending" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-8">
              {isOnline && upiUri && !hasPaidOnline ? (
                <>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-[#111827]/10 mb-4 inline-block">
                    <QRCode value={upiUri} size={160} />
                  </div>
                  <h3 className="text-[20px] font-extrabold text-[#111827]">Scan to pay {inr(batchTotal)}</h3>
                  <a href={upiUri} className="mt-3 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                    Open UPI App
                  </a>
                  <button 
                    onClick={() => setHasPaidOnline(true)}
                    className="mt-4 text-[#111827] text-[13px] font-bold underline decoration-[#111827]/30 underline-offset-4 hover:decoration-[#111827] transition-all"
                  >
                    I have paid
                  </button>
                </>
              ) : (
                <>
                  <span className="w-16 h-16 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8" />
                  </span>
                  <h3 className="text-[20px] font-extrabold text-[#111827]">Document submitted</h3>
                  <p className="text-[13px] text-[#111827]/60 mt-2 max-w-[320px]">
                    <b>{docName}</b> is with the shop.{" "}
                    {jobs[0].paymentMethod === "cash" ? (
                      <>Pay <b>{inr(batchTotal)}</b> in <span className="text-amber-600 font-semibold">cash at the counter</span> when you collect your prints.</>
                    ) : (
                      <>Payment of <b>{inr(batchTotal)}</b> is <span className="text-orange-600 font-semibold">pending verification</span> by the shopkeeper.</>
                    )}
                  </p>
                </>
              )}
              <span className="mt-5 inline-flex items-center gap-2 text-[12px] text-[#111827]/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> This page updates automatically once confirmed
              </span>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
