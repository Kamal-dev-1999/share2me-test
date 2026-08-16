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
      setJob({
        id: jobId, documentName: "Document", fileSizeBytes: 0, fileType: "",
        pages: 1, senderName: "You", printType: "bw", pricePerPage: 0,
        totalAmount: 0, paymentMethod: "online", paymentStatus: "paid",
        paymentId: "stripe", paidAt: new Date().toISOString(), createdAt: new Date().toISOString()
      });
      setStep(4);
    }
  }, []);

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
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
  const [job, setJob] = useState<PrintJob | null>(null);

  const effectiveSettings = settings ?? DEFAULT_SETTINGS;
  const qrConfigured = !!effectiveSettings.qrUrl || !!effectiveSettings.charges_enabled;
  const effectiveCopies = printConfig.copies || 1;
  // Double-sided reduces page count by half (rounded up)
  const effectivePages = pages ? (printConfig.doubleSided ? Math.ceil(pages / 2) : pages) : 0;
  const pricePerPage = printType === "color" ? effectiveSettings.colorPrice : effectiveSettings.bwPrice;
  const total = useMemo(
    () => (effectivePages && printType ? effectivePages * pricePerPage * effectiveCopies : 0),
    [effectivePages, printType, pricePerPage, effectiveCopies]
  );

  // ── Step 1: upload + page count ────────────────────────────────
  const handleFile = async (f: File) => {
    setFile(f);
    setPages(null);
    setCounting(true);
    try {
      setPages(await countPages(f));
    } catch {
      setPages(1);
    } finally {
      setCounting(false);
    }
  };

  // ── Step 3 → 4: submit job to backend ──────────────────────────
  const submitJob = async (method: PaymentMethod) => {
    if (!file || !pages || !printType || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPrintJob({
        shopCode,
        senderName: senderName.trim() || "Anonymous",
        documentName: file.name,
        fileSizeBytes: file.size,
        fileType: file.type || "application/octet-stream",
        pages: effectivePages,
        printType,
        paymentMethod: method,
        printConfig,
      });

      if (result.uploadUrl) {
        const uploadRes = await fetch(result.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || "application/octet-stream"
          }
        });
        if (!uploadRes.ok) {
          throw new Error("Failed to upload document to cloud storage.");
        }
      }

      if (method === 'online' && result.razorpayOrderId) {
        const loaded = await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        if (!loaded) {
          setSubmitError("Failed to load Razorpay SDK. Please check your connection.");
          setSubmitting(false);
          return;
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: result.amountPaise,
          currency: "INR",
          name: shopName,
          description: "Print Job Payment",
          order_id: result.razorpayOrderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/printshop/verify-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  jobId: result.jobId
                })
              });
              if (!verifyRes.ok) throw new Error("Payment verification failed");
              
              const created: PrintJob = {
                id: result.jobId, documentName: file.name, fileSizeBytes: file.size,
                fileType: file.type || "application/octet-stream", pages: effectivePages,
                senderName: senderName.trim() || "Anonymous", printType,
                pricePerPage: result.pricePerPage, totalAmount: result.totalAmount,
                paymentMethod: method, paymentStatus: "paid",
                paymentId: response.razorpay_payment_id, paidAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                printConfig,
              };
              setJob(created);
              setStep(5);
            } catch (err) {
              setSubmitError("Payment verification failed. If money was deducted, please contact the shopkeeper.");
            }
          },
          prefill: {
            name: senderName.trim() || "Anonymous"
          },
          theme: { color: "#111827" }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          setSubmitError(response.error.description || "Payment failed");
        });
        rzp.open();
        setSubmitting(false);
        return;
      }

      const created: PrintJob = {
        id: result.jobId,
        documentName: file.name,
        fileSizeBytes: file.size,
        fileType: file.type || "application/octet-stream",
        pages: effectivePages,
        senderName: senderName.trim() || "Anonymous",
        printType,
        pricePerPage: result.pricePerPage,
        totalAmount: result.totalAmount,
        paymentMethod: method,
        paymentStatus: "pending",
        paymentId: null,
        paidAt: null,
        createdAt: result.createdAt,
        printConfig,
      };
      setJob(created);
      setStep(5);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "submission_failed";
      setSubmitError(msg === "shop_not_accepting" ? "This shop is not currently accepting orders." : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (step !== 5 || !job || job.paymentStatus === "paid") return;
    const socket = socketIO(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
      { transports: ["websocket", "polling"] }
    );

    socket.on("connect", () => {
      socket.emit("g2p:join_job_room", { jobId: job.id });
    });

    socket.on("printshop:job_updated", (payload: { jobId: string; paymentStatus: string; paymentId?: string; paidAt?: string; jobStatus?: string; printedAt?: string }) => {
      if (payload.jobId !== job.id) return;
      setJob((prev) => prev ? { ...prev, paymentStatus: payload.paymentStatus as "paid" | "failed" | "pending", paymentId: payload.paymentId ?? null, paidAt: payload.paidAt ?? null } : prev);
    });
    return () => { socket.disconnect(); };
  }, [step, job]);

  if (settingsLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-[#111827] border-t-transparent animate-spin" />
    </div>
  );

  const downloadReceipt = async () => {
    if (!job) return;
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const page = doc.addPage([420, 520]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.07, 0.09, 0.15);
    let y = 470;
    const line = (label: string, value: string, big = false) => {
      page.drawText(label, { x: 40, y, size: 10, font, color: rgb(0.45, 0.45, 0.5) });
      page.drawText(value, { x: 200, y, size: big ? 14 : 11, font: bold, color: ink });
      y -= big ? 28 : 22;
    };
    page.drawText("Share2Me — Print Receipt", { x: 40, y: 490, size: 16, font: bold, color: ink });
    y = 450;
    line("Shop", shopName);
    line("Customer", job.senderName);
    line("Document", job.documentName.slice(0, 34));
    line("Pages", String(job.pages));
    line("Print type", job.printType === "color" ? "Color" : "Black & White");
    line("Price per page", `Rs ${job.pricePerPage}`);
    line("Amount paid", `Rs ${job.totalAmount}`, true);
    line("Method", job.paymentMethod === "cash" ? "Cash at counter" : "UPI (online)");
    line("Payment ID", job.paymentId ?? "-");
    line("Date", job.paidAt ? new Date(job.paidAt).toLocaleString("en-IN") : "-");
    line("Status", "PAID");
    const bytes = await doc.save();
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${job.paymentId ?? job.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isPaid = job?.paymentStatus === "paid";

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
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                dragging ? "border-emerald-500 bg-emerald-500/10" : "border-[#111827]/20 bg-white/40 hover:bg-white/60"
              }`}
            >
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Upload className="w-8 h-8 mx-auto text-[#111827]/50 mb-3" strokeWidth={1.75} />
              <p className="text-[14px] font-semibold text-[#111827]">Drop your document here or tap to browse</p>
              <p className="text-[12px] text-[#111827]/50 mt-1">PDF, Word, PowerPoint, Excel, text &amp; images — pages counted automatically</p>
            </div>

            {file && (
              <div className="mt-4 flex items-center gap-3 bg-white/60 border border-white/70 rounded-2xl p-4">
                <span className="w-11 h-11 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#111827] truncate">{file.name}</p>
                  <p className="text-[12px] text-[#111827]/60">
                    {formatBytes(file.size)}
                    {" · "}
                    {counting ? (
                      <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> counting pages…</span>
                    ) : (
                      <span className="font-semibold text-[#111827]">{pages} page{pages !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your name"
              className="mt-4 w-full bg-white/60 border border-white/70 rounded-full px-5 py-3 text-[14px] text-[#111827] focus:outline-none focus:border-[#111827]/40"
            />

            <button
              disabled={!file || counting || !pages || !senderName.trim()}
              onClick={() => setStep(2)}
              className="mt-4 w-full h-12 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors disabled:opacity-40"
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === 2 && pages && (
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
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Pages</span><b>{pages}</b></div>
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Print type</span><b>{printType === "color" ? "Color" : "Black & White"}</b></div>
                <div className="flex justify-between py-1"><span className="text-[#111827]/60">Price per page</span><b>{inr(pricePerPage)}</b></div>
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

        {step === 3 && pages && printType && (
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
                className="flex flex-col items-center bg-white/60 border border-white/70 rounded-2xl p-6">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#34d399] to-[#059669] text-white flex items-center justify-center mb-3 shadow-md">
                  <QrCode className="w-7 h-7" />
                </span>
                {effectiveSettings.qrUrl ? (
                  <>
                    <p className="text-[14px] font-bold text-[#111827] mb-2">Scan to pay {inr(total)}</p>
                    <img src={effectiveSettings.qrUrl} alt="Payment QR" className="w-40 h-40 rounded-xl border-2 border-[#111827]/10 shadow-sm object-contain bg-white p-1 mb-2" />
                    <p className="text-[11px] text-[#111827]/50">Or tap button below to pay via Razorpay checkout</p>
                  </>
                ) : (
                  <>
                    <p className="text-[16px] font-extrabold text-[#111827]">Pay {inr(total)} via Razorpay</p>
                    <p className="mt-2 text-[12px] text-[#111827]/60 max-w-[300px] text-center">You will be redirected to Razorpay to complete your payment via UPI or Card.</p>
                  </>
                )}
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
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : (payMethod === "cash" ? `Submit — Pay ${inr(total)} cash at counter` : `Pay ${inr(total)} via Razorpay`)}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5 — Pending → Success ── */}
        {step === 5 && job && (
          <motion.div key="s4" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            {isPaid ? (
              <div className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-8">
                <motion.span
                  initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                  className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-[0_12px_32px_rgba(16,185,129,0.4)]"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.span>
                <h3 className="text-[20px] font-extrabold text-[#111827]">Payment Successful</h3>
                <p className="text-[13px] text-[#111827]/60 mt-1 mb-4">
                  {job.senderName} · {job.documentName}
                </p>
                <div className="w-full max-w-sm text-left bg-white/70 rounded-2xl border border-white/80 p-4 text-[13px]">
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Pages</span><b>{job.pages}</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Print type</span><b>{job.printType === "color" ? "Color" : "Black & White"}</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Price per page</span><b>{inr(job.pricePerPage)}</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Amount paid</span><b className="text-emerald-600">{inr(job.totalAmount)} Paid</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Payment ID</span><b className="font-mono text-[11px]">{job.paymentId}</b></div>
                  <div className="flex justify-between py-1"><span className="text-[#111827]/60">Date</span><b>{job.paidAt && new Date(job.paidAt).toLocaleString("en-IN")}</b></div>
                </div>
                <button
                  onClick={downloadReceipt}
                  className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#111827] text-white text-[13px] font-semibold hover:bg-black transition-colors"
                >
                  <Download className="w-4 h-4" /> Download receipt
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center bg-white/60 border border-white/70 rounded-2xl p-8">
                <span className="w-16 h-16 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8" />
                </span>
                <h3 className="text-[20px] font-extrabold text-[#111827]">Document submitted</h3>
                <p className="text-[13px] text-[#111827]/60 mt-2 max-w-[320px]">
                  <b>{job.documentName}</b> ({job.pages} pages, {job.printType === "color" ? "Color" : "B&W"}) is with the shop.{" "}
                  {job.paymentMethod === "cash" ? (
                    <>Pay <b>{inr(job.totalAmount)}</b> in <span className="text-amber-600 font-semibold">cash at the counter</span> when you collect your prints.</>
                  ) : (
                    <>Payment of <b>{inr(job.totalAmount)}</b> is <span className="text-orange-600 font-semibold">pending verification</span> by the shopkeeper.</>
                  )}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-[12px] text-[#111827]/50">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> This page updates automatically once confirmed
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
