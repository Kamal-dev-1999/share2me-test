"use client";

/**
 * Student-facing print flow on /g2p/[code]:
 *   1. Upload document & per-file download selection → page count via pdf-lib
 *   2. Select default print type → B&W / Color cards + live total
 *   3. Configure printing → per-file or global copies, color/B&W, allow download, double-sided, stapling
 *   4. Payment → shop's UPI QR / cash at counter
 *   5. Confirmation → pending screen with real-time pre-confirmation Edit mode & WebSocket live sync to vendor
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
  Edit2, Shield, ShieldCheck, Lock, X, RefreshCw, AlertCircle
} from "lucide-react";
import QRCode from "react-qr-code";
import {
  getPublicShopSettings, submitPrintJob, inr, formatBytes, DEFAULT_SETTINGS,
  updateBulkJobPreferences,
  type PrintType, type PrintJob, type PublicShopInfo, type PaymentMethod, type PrintConfig,
} from "@/lib/printShop";
import { countPages } from "@/lib/pageCount";
import { io as socketIO, Socket } from "socket.io-client";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS = ["Upload", "Print Type", "Configure", "Payment", "Done"];

interface UploadedFileItem {
  id: string;
  file: File;
  pages: number;
  counting: boolean;
  allowDownload: boolean; // Per-file download permission (step 1 & 2)
  config?: PrintConfig & { printType?: PrintType; allowDownload?: boolean };
}

interface EditDraftItem {
  jobId: string;
  documentName: string;
  pages: number;
  printType: PrintType;
  allowDownload: boolean;
  copies: number;
  doubleSided: boolean;
  stapling: boolean;
  paperSize: 'A4' | 'A3';
}

export function PrintFlow({ shopCode, shopName }: { shopCode: string; shopName: string }) {
  const [settings, setSettings] = useState<PublicShopInfo | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasPaidOnline, setHasPaidOnline] = useState(false);

  const submittingRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

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
        printConfig: { copies: 1, paperSize: 'A4', doubleSided: false, stapling: false, allowDownload: true },
        allowDownload: true
      }]);
      setStep(5);
    }
  }, []);

  // Step 1 state
  const [filesState, setFilesState] = useState<UploadedFileItem[]>([]);
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
    allowDownload: true
  });

  // Step 4/5 state
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  // Pre-confirmation Edit state (Requirement 3, 4, 5)
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [editingDrafts, setEditingDrafts] = useState<EditDraftItem[]>([]);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [lockedBanner, setLockedBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
  const totalPages = filesState.reduce((sum, f) => sum + (f.pages || 0), 0);

  // ── Step 1: upload + page count ────────────────────────────────
  const handleFiles = async (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).slice(0, 10 - filesState.length);
    if (newFiles.length === 0) return;

    const added: UploadedFileItem[] = newFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      pages: 0,
      counting: true,
      allowDownload: true, // Default to true, customizable per file
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

  const toggleFileDownload = (id: string) => {
    setFilesState(prev => prev.map(fs => {
      if (fs.id !== id) return fs;
      const nextVal = !fs.allowDownload;
      return {
        ...fs,
        allowDownload: nextVal,
        config: { ...(fs.config || printConfig), allowDownload: nextVal }
      };
    }));
  };

  // ── Step 3 → 4: submit job to backend ──────────────────────────
  const submitJob = async (method: PaymentMethod) => {
    if (filesState.length === 0 || !printType || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { submitBulkPrintJob } = await import("@/lib/printShop");

      const payloadFiles = filesState.map(fs => {
        return {
          documentName: fs.file.name,
          fileSizeBytes: fs.file.size,
          fileType: fs.file.type || "application/octet-stream",
          pages: fs.pages || 1,
          printConfig: { ...(fs.config || printConfig), allowDownload: fs.allowDownload },
          allowDownload: fs.allowDownload,
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
        id: j.jobId,
        vendorId: result.vendorId || settings?.vendorId,
        documentName: filesState[idx].file.name,
        fileSizeBytes: filesState[idx].file.size,
        fileType: filesState[idx].file.type || "application/octet-stream",
        pages: filesState[idx].pages || 1,
        senderName: senderName.trim() || "Anonymous",
        printType: payloadFiles[idx].printConfig?.printType || printType,
        pricePerPage: j.pricePerPage,
        totalAmount: j.totalAmount,
        paymentMethod: method,
        paymentStatus: "pending",
        paymentId: null,
        paidAt: null,
        createdAt: j.createdAt,
        printConfig: payloadFiles[idx].printConfig || printConfig,
        allowDownload: payloadFiles[idx].allowDownload,
        batchId: result.batchId
      }));

      setJobs(createdJobs);
      setStep(5);
    } catch (err: unknown) {
      console.error('[PrintFlow] Submission error:', err);
      if (err instanceof Error) {
        if (err.message === 'shop_not_accepting') {
          setSubmitError('This shop is not currently accepting orders.');
        } else if (err.message === 'shop_not_found') {
          setSubmitError(`Print shop "${shopCode}" was not found. Please check the shop code or QR code.`);
        } else if (err.message === 'rate_limited') {
          setSubmitError('Too many submissions. Please wait a moment and try again.');
        } else {
          setSubmitError(err.message || 'Submission failed. Please try again.');
        }
      } else {
        setSubmitError('Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // ── Sockets: Join room & listen for updates ────────────────────
  useEffect(() => {
    if (step !== 5 || jobs.length === 0) return;

    const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || process.env.NEXT_PUBLIC_SIGNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://share2me-version-2-0.onrender.com";

    const socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || EXPRESS_BACKEND_URL,
      { transports: ["websocket", "polling"] }
    );
    socketRef.current = socket;

    socket.on("connect", () => {
      for (const j of jobs) {
        socket.emit("g2p:join_job_room", { jobId: j.id });
      }
    });

    socket.on("printshop:job_updated", (payload: {
      jobId: string;
      paymentStatus?: string;
      paymentId?: string;
      paidAt?: string;
      jobStatus?: string;
      printedAt?: string;
      printType?: PrintType;
      pricePerPage?: number;
      totalAmount?: number;
      printConfig?: PrintConfig;
      allowDownload?: boolean;
    }) => {
      setJobs(prev => {
        const next = prev.map(j => {
          if (j.id !== payload.jobId) return j;
          return {
            ...j,
            paymentStatus: (payload.paymentStatus || j.paymentStatus) as any,
            paymentId: payload.paymentId || j.paymentId,
            paidAt: payload.paidAt || j.paidAt,
            jobStatus: (payload.jobStatus || j.jobStatus) as any,
            printedAt: payload.printedAt || j.printedAt,
            printType: payload.printType || j.printType,
            pricePerPage: payload.pricePerPage !== undefined ? payload.pricePerPage : j.pricePerPage,
            totalAmount: payload.totalAmount !== undefined ? payload.totalAmount : j.totalAmount,
            printConfig: payload.printConfig || j.printConfig,
            allowDownload: payload.allowDownload !== undefined ? payload.allowDownload : j.allowDownload
          };
        });

        // If vendor just confirmed payment, lock and close editing modal (Requirement 5)
        if (payload.paymentStatus === "paid") {
          setIsEditingPreferences(false);
          setLockedBanner("Order confirmed by vendor — preferences locked.");
          showToast("Order confirmed by vendor! Preferences are now locked.");
        }

        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [step, jobs.length]);

  // ── Open Edit Preferences (Requirement 3 & 4) ───────────────────
  const openEditModal = () => {
    const isPaid = jobs.every(j => j.paymentStatus === "paid");
    if (isPaid) return;

    setEditingDrafts(jobs.map(j => ({
      jobId: j.id,
      documentName: j.documentName,
      pages: j.pages,
      printType: j.printType,
      allowDownload: j.allowDownload !== false,
      copies: j.printConfig?.copies || 1,
      doubleSided: !!j.printConfig?.doubleSided,
      stapling: !!j.printConfig?.stapling,
      paperSize: j.printConfig?.paperSize || 'A4'
    })));
    setEditError(null);
    setIsEditingPreferences(true);

    // Real-time Push to Vendor via WebSockets (Requirement 4)
    const targetVendorId = settings?.vendorId || jobs[0]?.vendorId;
    if (socketRef.current && targetVendorId) {
      socketRef.current.emit("printshop:sender_editing_start", {
        jobIds: jobs.map(j => j.id),
        vendorId: targetVendorId,
        senderName: senderName.trim() || jobs[0]?.senderName || "Sender"
      });
    }
  };

  // ── Close Edit Preferences (Cancel) ─────────────────────────────
  const closeEditModal = () => {
    setIsEditingPreferences(false);
    setEditError(null);

    // End editing state for vendor
    const targetVendorId = settings?.vendorId || jobs[0]?.vendorId;
    if (socketRef.current && targetVendorId) {
      socketRef.current.emit("printshop:sender_editing_stop", {
        jobIds: jobs.map(j => j.id),
        vendorId: targetVendorId
      });
    }
  };

  // ── Save Edit Preferences (Requirement 3 & 4) ────────────────────
  const saveEditModal = async () => {
    setSavingPreferences(true);
    setEditError(null);
    try {
      const updates = editingDrafts.map(d => ({
        jobId: d.jobId,
        printType: d.printType,
        allowDownload: d.allowDownload,
        printConfig: {
          copies: d.copies,
          doubleSided: d.doubleSided,
          stapling: d.stapling,
          paperSize: d.paperSize,
          allowDownload: d.allowDownload,
          printType: d.printType
        }
      }));

      await updateBulkJobPreferences(updates);

      // Local state sync
      setJobs(prev => prev.map(j => {
        const d = editingDrafts.find(d => d.jobId === j.id);
        if (!d) return j;
        const price = d.printType === "color" ? effectiveSettings.colorPrice : effectiveSettings.bwPrice;
        const effectivePages = d.doubleSided ? Math.ceil(d.pages / 2) : d.pages;
        const newTotal = parseFloat((price * effectivePages * d.copies).toFixed(2));
        return {
          ...j,
          printType: d.printType,
          allowDownload: d.allowDownload,
          pricePerPage: price,
          totalAmount: newTotal,
          printConfig: {
            copies: d.copies,
            doubleSided: d.doubleSided,
            stapling: d.stapling,
            paperSize: d.paperSize,
            allowDownload: d.allowDownload,
            printType: d.printType
          }
        };
      }));

      setHasPaidOnline(false);
      setIsEditingPreferences(false);
      showToast("Preferences saved successfully!");
    } catch (err: any) {
      if (err.message && err.message.includes("order_locked")) {
        setEditError("This order was just confirmed by the vendor and is now locked.");
        setIsEditingPreferences(false);
        setLockedBanner("Order confirmed by vendor — preferences locked.");
      } else {
        setEditError("Failed to update preferences. Please try again.");
      }
    } finally {
      setSavingPreferences(false);
    }
  };

  // Draft total calculation in edit modal
  const editDraftTotal = useMemo(() => {
    let sum = 0;
    for (const d of editingDrafts) {
      const price = d.printType === "color" ? effectiveSettings.colorPrice : effectiveSettings.bwPrice;
      const effectivePages = d.doubleSided ? Math.ceil(d.pages / 2) : d.pages;
      sum += effectivePages * price * d.copies;
    }
    return sum;
  }, [editingDrafts, effectiveSettings]);

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
      const page = doc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();

      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);

      const colors = {
        primary: rgb(0.067, 0.094, 0.153),
        secondary: rgb(0.294, 0.333, 0.388),
        lightGray: rgb(0.953, 0.957, 0.965),
        border: rgb(0.898, 0.906, 0.922),
        success: rgb(0.063, 0.725, 0.506),
        white: rgb(1, 1, 1),
      };

      page.drawText("SHARE2ME", {
        x: width / 2 - 180,
        y: height / 2 - 100,
        size: 80,
        font: bold,
        color: rgb(0.96, 0.97, 0.98),
        rotate: degrees(45),
      });

      page.drawRectangle({
        x: 0,
        y: height - 120,
        width: width,
        height: 120,
        color: colors.primary,
      });

      page.drawText("OFFICIAL RECEIPT", { x: width - 230, y: height - 50, size: 18, font: bold, color: colors.white });
      page.drawText(`Shop: ${shopName} (${shopCode})`, { x: 40, y: height - 80, size: 12, font, color: colors.border });

      const dateStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      page.drawText(`Date: ${dateStr}`, { x: width - 230, y: height - 80, size: 10, font, color: colors.border });

      let currentY = height - 180;
      const leftX = 40;
      const rightX = width / 2 + 40;

      page.drawText("Billed To", { x: leftX, y: currentY, size: 10, font: bold, color: colors.secondary });
      page.drawText(jobs[0].senderName || "Guest", { x: leftX, y: currentY - 20, size: 14, font: bold, color: colors.primary });

      page.drawText("Payment Info", { x: rightX, y: currentY, size: 10, font: bold, color: colors.secondary });
      page.drawText(`Method: ${jobs[0].paymentMethod?.toUpperCase() || "ONLINE"}`, { x: rightX, y: currentY - 20, size: 11, font, color: colors.primary });

      const statusText = jobs[0].paymentStatus.toUpperCase();
      const statusColor = statusText === 'PAID' ? colors.success : colors.secondary;
      page.drawText(`Status: ${statusText}`, { x: rightX, y: currentY - 40, size: 11, font: bold, color: statusColor });

      if (jobs[0].paymentId) {
        page.drawText(`Txn ID: ${jobs[0].paymentId}`, { x: rightX, y: currentY - 60, size: 10, font, color: colors.secondary });
      }

      currentY -= 110;

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

      let totalAmount = 0;
      for (const j of jobs) {
        totalAmount += j.totalAmount;
        let docName = j.documentName;
        if (docName.length > 40) docName = docName.substring(0, 37) + "...";
        page.drawText(docName, { x: col1, y: currentY + 10, size: 11, font, color: colors.primary });
        page.drawText(`${j.pages} pg · ${j.printType.toUpperCase()}`, { x: col2, y: currentY + 10, size: 10, font, color: colors.secondary });
        page.drawText(`₹${j.totalAmount.toFixed(2)}`, { x: col3, y: currentY + 10, size: 11, font: bold, color: colors.primary });
        currentY -= 25;
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt-${shopCode}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Receipt generation error:", e);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Toast popup */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#111827] text-white px-5 py-2.5 rounded-full shadow-2xl text-[13px] font-semibold flex items-center gap-2 border border-white/20"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#111827]/10">
        <div>
          <h2 className="text-[20px] font-extrabold text-[#111827] leading-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            {shopName}
          </h2>
          <p className="text-[12px] text-[#111827]/60 flex items-center gap-1.5 mt-0.5">
            <span className="font-mono bg-[#111827]/5 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider">{shopCode}</span>
            {effectiveSettings.locationName && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{effectiveSettings.locationName}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/60 border border-white/80 rounded-full px-3 py-1 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-[#111827]">G2P Instant</span>
        </div>
      </div>

      {/* Progress Stepper / Breadcrumb */}
      <div className="w-full mb-7 sm:mb-9 select-none">
        <div className="flex items-center justify-between w-full">
          {STEP_LABELS.map((label, idx) => {
            const s = (idx + 1) as Step;
            const active = step === s;
            const done = step > s;
            const canNavigate = done && !submitting && step < 5;

            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                {/* Step node & label */}
                <div
                  onClick={() => canNavigate && setStep(s)}
                  className={`relative flex flex-col items-center shrink-0 ${canNavigate ? "cursor-pointer group" : ""}`}
                  title={canNavigate ? `Go back to ${label}` : undefined}
                >
                  <span
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] font-extrabold transition-all shrink-0 ${
                      done
                        ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                        : active
                        ? "bg-[#111827] text-white shadow-md ring-4 ring-[#111827]/10"
                        : "bg-[#111827]/10 text-[#111827]/40"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" /> : s}
                  </span>

                  {/* Desktop / tablet label placed underneath circle */}
                  <span
                    className={`absolute -bottom-5 sm:-bottom-6 text-[11px] font-semibold whitespace-nowrap hidden sm:block transition-colors ${
                      active
                        ? "text-[#111827] font-bold"
                        : done
                        ? "text-emerald-700 font-medium group-hover:text-emerald-800"
                        : "text-[#111827]/40"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* Adaptive connector track */}
                {idx < STEP_LABELS.length - 1 && (
                  <div className="flex-1 h-[2px] mx-1 sm:mx-2 rounded-full overflow-hidden bg-[#111827]/10">
                    <div
                      className={`h-full transition-all duration-300 ${
                        step > idx + 1 ? "bg-emerald-500 w-full" : "w-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile current step indicator */}
        <div className="flex items-center justify-between sm:hidden mt-3 px-1 py-1 rounded-lg bg-[#111827]/[0.03]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#111827]/50">
            Step {step} of {STEP_LABELS.length}
          </span>
          <span className="text-[12px] font-extrabold text-[#111827]">
            {STEP_LABELS[step - 1]}
          </span>
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[16px] font-bold text-[#111827]">Upload document(s)</h3>
              <span className="text-[12px] font-semibold text-[#111827]/50">{filesState.length}/10 files</span>
            </div>
            <p className="text-[12px] text-[#111827]/60 mb-4">
              Upload your files and select download permissions for each document.
            </p>

            {effectiveSettings.isAccepting === false ? (
              <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center text-red-600">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold text-[14px]">Shop Currently Closed</p>
                <p className="text-[12px] opacity-80 mt-1">This print shop is currently not accepting new orders.</p>
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
                <p className="text-[12px] text-[#111827]/50 mt-1">PDF, Word, Excel, Images, PPT. Up to 10 files.</p>
              </div>
            )}

            {/* File List with Per-File Allow Download Selection (Requirement 1 & 2) */}
            {effectiveSettings.isAccepting !== false && filesState.length > 0 && (
              <div className="mt-4 flex flex-col gap-2.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                {filesState.map(fs => (
                  <div key={fs.id} className="bg-white/70 border border-white/80 rounded-2xl p-3.5 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <FileText className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#111827] truncate">{fs.file.name}</p>
                        <p className="text-[11px] text-[#111827]/60">
                          {formatBytes(fs.file.size)}
                          {" · "}
                          {fs.counting ? (
                            <span className="inline-flex items-center gap-1 text-indigo-600"><Loader2 className="w-3 h-3 animate-spin" /> counting pages...</span>
                          ) : (
                            <span className="font-semibold text-[#111827]">{fs.pages} page{fs.pages !== 1 ? "s" : ""}</span>
                          )}
                        </p>
                      </div>
                      <button onClick={() => removeFile(fs.id)} className="w-7 h-7 flex items-center justify-center text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                        <span className="text-xl leading-none">&times;</span>
                      </button>
                    </div>

                    {/* Per-File Download Permission Toggle (Requirement 1) */}
                    <div className="pt-2 border-t border-[#111827]/5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-[#111827]/60">Vendor Download Permission:</span>
                        <button
                          type="button"
                          onClick={() => toggleFileDownload(fs.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                            fs.allowDownload
                              ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 border border-amber-500/30"
                          }`}
                        >
                          {fs.allowDownload ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Allow Download: <span className="underline font-extrabold">YES</span>
                            </>
                          ) : (
                            <>
                              <Shield className="w-3 h-3 text-amber-600" />
                              Allow Download: <span className="underline font-extrabold">NO (Print only)</span>
                            </>
                          )}
                        </button>
                      </div>
                      {!fs.allowDownload && (
                        <p className="text-[10px] text-amber-700/80 font-medium text-left">
                          Print Only: Vendor can print your document to physical paper but cannot save or download the digital file.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {effectiveSettings.isAccepting !== false && (
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your name (e.g. Rahul Sharma)"
                className="mt-4 w-full bg-white/70 border border-white/80 rounded-full px-5 py-3 text-[14px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#111827]/30 shadow-sm"
              />
            )}

            {effectiveSettings.isAccepting !== false && (
              <button
                disabled={filesState.length === 0 || isCounting || totalPages === 0 || !senderName.trim()}
                onClick={() => setStep(2)}
                className="mt-4 w-full h-12 rounded-full bg-[#111827] text-white text-[14px] font-bold hover:bg-black transition-colors disabled:opacity-40 shadow-md flex items-center justify-center gap-2"
              >
                Continue to Print Type →
              </button>
            )}
          </motion.div>
        )}

        {step === 2 && filesState.length > 0 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-1">Select default print type</h3>
            <p className="text-[12px] text-[#111827]/60 mb-4">Choose default color mode. You can also customize per file in the next step.</p>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { type: "bw" as PrintType, icon: Printer, title: "Black & White", price: effectiveSettings.bwPrice, grad: ["#4b5563", "#111827"] },
                { type: "color" as PrintType, icon: Palette, title: "Color", price: effectiveSettings.colorPrice, grad: ["#f472b6", "#8b5cf6"] },
              ].map(({ type, icon: Icon, title, price, grad }) => {
                const active = printType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setPrintType(type)}
                    className={`text-left p-5 rounded-2xl border transition-all ${
                      active ? "bg-white border-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-2 ring-[#111827]" : "bg-white/50 border-white/70 hover:bg-white/80"
                    }`}
                  >
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 shadow-sm text-white"
                      style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
                      <Icon className="w-5 h-5" />
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
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Total Files</span><b>{filesState.length}</b></div>
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Total Pages</span><b>{totalPages}</b></div>
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Default Print Type</span><b>{printType === "color" ? "Color" : "Black & White"}</b></div>
                <div className="flex justify-between py-2 mt-1 border-t border-[#111827]/10 text-[16px]">
                  <span className="font-bold text-[#111827]">Estimated Total</span>
                  <span className="font-extrabold text-[#111827]">{inr(total)}</span>
                </div>
              </motion.div>
            )}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5 hover:bg-white transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!printType}
                onClick={() => setStep(3)}
                className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-bold hover:bg-black transition-colors disabled:opacity-40 shadow-md"
              >
                Configure Settings →
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && filesState.length > 0 && printType && (
          <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-1">Configure print preferences</h3>
            <p className="text-[12px] text-[#111827]/60 mb-4">Set global options or customize settings individually for each file.</p>

            {/* Global Settings */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/60 border border-white/70 rounded-2xl p-4">
                <p className="text-[12px] font-bold text-[#111827] mb-2">Copies (All)</p>
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
                  <p className="text-[10px] text-[#111827]/50">Saves ~50% paper</p>
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

            {/* Per-File Preferences Section (Requirement 2) */}
            <div className="mb-4">
              <p className="text-[13px] font-bold text-[#111827] mb-2 flex items-center justify-between">
                <span>Per-File Preferences</span>
                <span className="text-[11px] font-normal text-[#111827]/60">Customize individually</span>
              </p>
              <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {filesState.map(fs => {
                  const currentType = fs.config?.printType || printType || "bw";
                  const currentCopies = fs.config?.copies || printConfig.copies || 1;
                  return (
                    <div key={fs.id} className="bg-white/70 border border-white/80 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-[#111827] truncate">{fs.file.name}</p>
                          <p className="text-[10px] text-[#111827]/60">{fs.pages} pages</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="text-[11px] font-bold bg-[#111827]/5 border-none rounded-lg px-2 py-1 outline-none text-[#111827]"
                            value={currentType}
                            onChange={(e) => {
                              const val = e.target.value as PrintType;
                              setFilesState(prev => prev.map(f => f.id === fs.id ? { ...f, config: { ...(f.config || printConfig), printType: val } } : f));
                            }}
                          >
                            <option value="bw">B&W ({inr(effectiveSettings.bwPrice)}/p)</option>
                            <option value="color">Color ({inr(effectiveSettings.colorPrice)}/p)</option>
                          </select>
                          <div className="flex items-center bg-[#111827]/5 rounded-lg px-2 py-1 text-[#111827]">
                            <button
                              type="button"
                              className="text-[13px] font-bold px-1 hover:text-black"
                              onClick={() => setFilesState(prev => prev.map(f => f.id === fs.id ? { ...f, config: { ...(f.config || printConfig), copies: Math.max(1, currentCopies - 1) } } : f))}
                            >-</button>
                            <span className="text-[11px] font-bold w-4 text-center">{currentCopies}</span>
                            <button
                              type="button"
                              className="text-[13px] font-bold px-1 hover:text-black"
                              onClick={() => setFilesState(prev => prev.map(f => f.id === fs.id ? { ...f, config: { ...(f.config || printConfig), copies: Math.min(20, currentCopies + 1) } } : f))}
                            >+</button>
                          </div>
                        </div>
                      </div>

                      {/* Download permission toggle per file */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#111827]/5 text-[11px]">
                        <span className="text-[#111827]/60">Download by Vendor:</span>
                        <button
                          type="button"
                          onClick={() => toggleFileDownload(fs.id)}
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] transition-colors ${
                            fs.allowDownload
                              ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                              : "bg-amber-500/15 text-amber-800 hover:bg-amber-500/25"
                          }`}
                        >
                          {fs.allowDownload ? "✓ Download Allowed" : "✗ Print Only"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5 hover:bg-white transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(4)} className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-bold hover:bg-black transition-colors inline-flex items-center justify-center shadow-md">
                Continue to Payment · {inr(total)} →
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-1">Select payment method</h3>
            <p className="text-[12px] text-[#111827]/60 mb-4">Pay online now or hand cash at the counter on pickup.</p>

            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {[
                {
                  method: "online" as PaymentMethod, icon: QrCode, title: "Pay online",
                  desc: effectiveSettings.charges_enabled ? "Pay securely via UPI QR or App" : "Not available — Shop hasn't enabled online payments",
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
                      active ? "bg-white border-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-2 ring-[#111827]" : "bg-white/50 border-white/70 hover:bg-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 text-white"
                        style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
                        <Icon className="w-5 h-5" />
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

            {/* Order Summary Breakdown */}
            <div className="bg-white/60 border border-white/70 rounded-2xl p-4 text-[13px] mb-4">
              <div className="flex justify-between font-bold text-[#111827] mb-2 pb-1 border-b border-[#111827]/10">
                <span>Summary ({filesState.length} document{filesState.length !== 1 ? "s" : ""})</span>
                <span>{inr(total)}</span>
              </div>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 text-[12px]">
                {filesState.map(fs => {
                  const type = fs.config?.printType || printType || "bw";
                  return (
                    <div key={fs.id} className="flex items-center justify-between text-[#111827]/70">
                      <span className="truncate max-w-[220px] font-medium">{fs.file.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#111827]/5 uppercase">{type}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${fs.allowDownload ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                          {fs.allowDownload ? "DL: ON" : "DL: OFF"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {submitError && <p className="mb-3 text-red-500 text-[12px] font-semibold text-center">{submitError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5 hover:bg-white transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!payMethod || submitting}
                onClick={() => payMethod && submitJob(payMethod)}
                className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-bold hover:bg-black transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-md"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : (payMethod === "cash" ? `Submit — Pay ${inr(total)} cash at counter` : `Submit & Pay ${inr(total)} via UPI`)}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5 — Pending & Live Edit Mode ── */}
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
                <h3 className="text-[20px] font-extrabold text-[#111827]">Payment Confirmed</h3>
                <p className="text-[13px] text-[#111827]/60 mt-1 mb-4">
                  {jobs[0].senderName} · {docName}
                </p>
                <div className="w-full max-w-sm text-left bg-white/70 rounded-2xl border border-white/80 p-4 text-[13px] mb-5">
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Amount</span><b className="text-emerald-600">{inr(batchTotal)} Paid</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Payment ID</span><b className="font-mono text-[11px]">{jobs[0].paymentId || "Confirmed"}</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Status</span><b className="text-emerald-600 font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> Preferences Locked</b></div>
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

          // !isPaid && !isPrinted (Pending both) — Displays EDIT PREFERENCES option (Requirement 3, 4, 5)
          const isOnline = jobs[0].paymentMethod === "online";
          const upiUri = isOnline && effectiveSettings.upiId ?
            `upi://pay?pa=${effectiveSettings.upiId}&pn=${encodeURIComponent(effectiveSettings.upiName || shopName)}&am=${batchTotal}&cu=INR` : null;

          return (
            <motion.div key="s5-pending" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-6 sm:p-8">
              {lockedBanner && (
                <div className="w-full mb-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-[12px] font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  {lockedBanner}
                </div>
              )}

              {isOnline && upiUri && !hasPaidOnline ? (
                <>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-[#111827]/10 mb-4 inline-block">
                    <QRCode value={upiUri} size={150} />
                  </div>
                  <h3 className="text-[20px] font-extrabold text-[#111827]">Scan to pay {inr(batchTotal)}</h3>
                  <div className="flex gap-2 mt-3">
                    <a href={upiUri} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                      Open UPI App
                    </a>
                    <button
                      onClick={() => setHasPaidOnline(true)}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white/80 border border-white text-[#111827] text-[13px] font-bold hover:bg-white shadow-sm"
                    >
                      I have paid
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="w-16 h-16 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center mb-3">
                    <Clock className="w-8 h-8" />
                  </span>
                  <h3 className="text-[20px] font-extrabold text-[#111827]">Document submitted</h3>
                  <p className="text-[13px] text-[#111827]/60 mt-2 max-w-[340px]">
                    <b>{docName}</b> is with the shopkeeper.{" "}
                    {jobs[0].paymentMethod === "cash" ? (
                      <>Pay <b>{inr(batchTotal)}</b> in <span className="text-amber-600 font-bold">cash at counter</span> on pickup.</>
                    ) : (
                      <>Payment of <b>{inr(batchTotal)}</b> is <span className="text-orange-600 font-bold">pending confirmation</span> by the vendor.</>
                    )}
                  </p>
                </>
              )}

              {/* Edit Options button before vendor confirmation (Requirement 3, 4, 5) */}
              {!isPaid && (
                <div className="mt-5 w-full max-w-sm flex flex-col items-center">
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="w-full h-11 px-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit File Preferences
                  </button>
                  <p className="text-[11px] text-[#111827]/50 mt-1.5 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                    Live syncs to vendor • Locks upon vendor confirmation
                  </p>
                </div>
              )}

              <span className="mt-4 inline-flex items-center gap-2 text-[12px] text-[#111827]/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> This page updates automatically once confirmed
              </span>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Pre-Confirmation Edit Preferences Modal (Requirement 3 & 4) ── */}
      <AnimatePresence>
        {isEditingPreferences && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-white/80 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#111827]/10 mb-4">
                <div>
                  <h3 className="text-[17px] font-extrabold text-[#111827] flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-indigo-600" />
                    Edit File Preferences
                  </h3>
                  <p className="text-[11px] text-[#111827]/60">
                    Live syncing to vendor • Changes lock once vendor confirms
                  </p>
                </div>
                <button onClick={closeEditModal} className="p-1.5 rounded-full hover:bg-[#111827]/10 text-[#111827]/60">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-[12px] font-semibold">
                  {editError}
                </div>
              )}

              {/* Editable file list */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {editingDrafts.map((draft, idx) => (
                  <div key={draft.jobId} className="bg-[#111827]/5 border border-[#111827]/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#111827] truncate">{draft.documentName}</p>
                        <p className="text-[11px] text-[#111827]/60">{draft.pages} page{draft.pages !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-[12px] font-extrabold text-indigo-600">
                        {inr((draft.printType === "color" ? effectiveSettings.colorPrice : effectiveSettings.bwPrice) * (draft.doubleSided ? Math.ceil(draft.pages / 2) : draft.pages) * draft.copies)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#111827]/10">
                      {/* Allow Download toggle */}
                      <button
                        type="button"
                        onClick={() => setEditingDrafts(prev => prev.map(d => d.jobId === draft.jobId ? { ...d, allowDownload: !d.allowDownload } : d))}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                          draft.allowDownload
                            ? "bg-emerald-50 border-emerald-500/30 text-emerald-800"
                            : "bg-amber-50 border-amber-500/30 text-amber-800"
                        }`}
                      >
                        <span>Allow Download:</span>
                        <span className="underline font-extrabold">{draft.allowDownload ? "YES" : "NO"}</span>
                      </button>

                      {/* Print Type toggle */}
                      <div className="flex rounded-xl bg-white border border-[#111827]/10 p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditingDrafts(prev => prev.map(d => d.jobId === draft.jobId ? { ...d, printType: "bw" } : d))}
                          className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${draft.printType === "bw" ? "bg-[#111827] text-white" : "text-[#111827]/60"}`}
                        >
                          B&W
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDrafts(prev => prev.map(d => d.jobId === draft.jobId ? { ...d, printType: "color" } : d))}
                          className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${draft.printType === "color" ? "bg-indigo-600 text-white" : "text-[#111827]/60"}`}
                        >
                          Color
                        </button>
                      </div>

                      {/* Copies counter */}
                      <div className="flex items-center justify-between bg-white border border-[#111827]/10 rounded-xl px-3 py-1 text-[11px]">
                        <span className="font-semibold text-[#111827]/70">Copies:</span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <button
                            type="button"
                            onClick={() => setEditingDrafts(prev => prev.map(d => d.jobId === draft.jobId ? { ...d, copies: Math.max(1, d.copies - 1) } : d))}
                            className="w-5 h-5 rounded bg-[#111827]/10 flex items-center justify-center hover:bg-[#111827]/20"
                          >-</button>
                          <span className="w-5 text-center font-bold text-[#111827]">{draft.copies}</span>
                          <button
                            type="button"
                            onClick={() => setEditingDrafts(prev => prev.map(d => d.jobId === draft.jobId ? { ...d, copies: Math.min(20, d.copies + 1) } : d))}
                            className="w-5 h-5 rounded bg-[#111827]/10 flex items-center justify-center hover:bg-[#111827]/20"
                          >+</button>
                        </div>
                      </div>

                      {/* Double-Sided toggle */}
                      <button
                        type="button"
                        onClick={() => setEditingDrafts(prev => prev.map(d => d.jobId === draft.jobId ? { ...d, doubleSided: !d.doubleSided } : d))}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                          draft.doubleSided ? "bg-emerald-50 border-emerald-500/30 text-emerald-800" : "bg-white border-[#111827]/10 text-[#111827]/60"
                        }`}
                      >
                        <span>Double-sided:</span>
                        <span>{draft.doubleSided ? "ON" : "OFF"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer with updated total */}
              <div className="pt-4 mt-3 border-t border-[#111827]/10 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-[#111827]/60 block leading-tight">New Total</span>
                  <span className="text-[18px] font-extrabold text-[#111827]">{inr(editDraftTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2.5 rounded-full border border-[#111827]/20 text-[13px] font-bold text-[#111827] hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingPreferences}
                    onClick={saveEditModal}
                    className="px-6 py-2.5 rounded-full bg-[#111827] hover:bg-black text-white text-[13px] font-bold flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {savingPreferences ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
