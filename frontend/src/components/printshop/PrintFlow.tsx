"use client";

/**
 * Student-facing print flow on /g2p/[code]:
 *   1. Upload document  → page count via pdf-lib (client-side)
 *   2. Select print type → B&W / Color cards + live total
 *   3. Payment          → shop's UPI QR, amount, "Payment Pending"
 *   4. Confirmation     → pending screen that flips to ✓ success once the
 *                         shopkeeper confirms (Phase 1: polls localStorage;
 *                         Phase 2: backend/webhook)
 *
 * The student can NOT self-confirm payment (spec) — confirmation always
 * comes from the shopkeeper's "Confirm payment received" action.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
/* eslint-disable @next/next/no-img-element */
import {
  Upload, FileText, Printer, Palette, CheckCircle2, Loader2, Clock,
  Download, IndianRupee, MapPin, ChevronLeft, QrCode, Banknote,
} from "lucide-react";
import {
  getShopSettings, addPrintJob, getPrintJob, inr, formatBytes,
  type PrintType, type PrintJob, type PrintShopSettings, type PaymentMethod,
} from "@/lib/printShop";
import { countPages } from "@/lib/pageCount";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Upload", "Print type", "Payment", "Done"];

export function PrintFlow({ shopName }: { shopName: string }) {
  const [settings] = useState<PrintShopSettings>(() => getShopSettings());
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [printType, setPrintType] = useState<PrintType | null>(null);

  // Step 3/4 state
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [job, setJob] = useState<PrintJob | null>(null);

  const pricePerPage = printType === "color" ? settings.colorPrice : settings.bwPrice;
  const total = useMemo(
    () => (pages && printType ? pages * pricePerPage : 0),
    [pages, printType, pricePerPage]
  );

  // ── Step 1: upload + page count ────────────────────────────────
  const handleFile = async (f: File) => {
    setFile(f);
    setPages(null);
    setCounting(true);
    try {
      // PDF / Word / PowerPoint / Excel / text — all counted client-side.
      setPages(await countPages(f));
    } catch {
      setPages(1);
    } finally {
      setCounting(false);
    }
  };

  // ── Step 3 → 4: record job (payment stays PENDING) ─────────────
  const submitJob = (method: PaymentMethod) => {
    if (!file || !pages || !printType) return;
    const created = addPrintJob({
      documentName: file.name,
      fileSizeBytes: file.size,
      fileType: file.type || "application/octet-stream",
      pages,
      senderName: senderName.trim() || "Anonymous",
      printType,
      pricePerPage,
      totalAmount: total,
      paymentMethod: method,
    });
    setJob(created);
    setStep(4);
  };

  // ── Step 4: poll for shopkeeper confirmation ───────────────────
  useEffect(() => {
    if (step !== 4 || !job || job.paymentStatus === "paid") return;
    const t = setInterval(() => {
      const fresh = getPrintJob(job.id);
      if (fresh && fresh.paymentStatus !== job.paymentStatus) setJob(fresh);
    }, 2500);
    return () => clearInterval(t);
  }, [step, job]);

  // ── Receipt (client-generated PDF) ─────────────────────────────
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
      {/* Shop header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="text-[12px] text-[#111827]/60">Printing at</p>
          <h2 className="text-[18px] font-bold text-[#111827] leading-tight flex items-center gap-2">
            {shopName}
            {settings.locationName && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#111827]/60">
                <MapPin className="w-3 h-3" /> {settings.locationName}
              </span>
            )}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
            settings.paymentQr ? "bg-emerald-500/15 text-emerald-700" : "bg-orange-500/15 text-orange-700"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${settings.paymentQr ? "bg-emerald-500" : "bg-orange-500"}`} />
          {settings.paymentQr ? "UPI payments accepted" : "Payment QR not set up"}
        </span>
      </div>

      {/* Stepper */}
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
        {/* ── STEP 1 — Upload ── */}
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

        {/* ── STEP 2 — Print type ── */}
        {step === 2 && pages && (
          <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-3">Select printing type</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {([
                { type: "bw" as PrintType,    icon: Printer, title: "Black & White", price: settings.bwPrice,    grad: ["#4b5563", "#111827"] },
                { type: "color" as PrintType, icon: Palette, title: "Color",          price: settings.colorPrice, grad: ["#f472b6", "#8b5cf6"] },
              ]).map(({ type, icon: Icon, title, price, grad }) => {
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
                <p className="text-[11px] text-[#111827]/50">{pages} pages × {inr(pricePerPage)} = {inr(total)}</p>
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
                Continue to payment · {inr(total)}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3 — Payment ── */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <h3 className="text-[16px] font-bold text-[#111827] mb-1">Complete payment</h3>
            <p className="text-[12px] text-[#111827]/60 mb-4">
              {file?.name} · {pages} pages · {printType === "color" ? "Color" : "B&W"} · {inr(pricePerPage)}/page
            </p>

            {/* Payment method choice */}
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {([
                {
                  method: "online" as PaymentMethod, icon: QrCode, title: "Pay online",
                  desc: settings.paymentQr ? "Scan the shop's UPI QR" : "Not available — QR not set up",
                  disabled: !settings.paymentQr, grad: ["#34d399", "#059669"],
                },
                {
                  method: "cash" as PaymentMethod, icon: Banknote, title: "Pay cash",
                  desc: "Pay at the counter on pickup",
                  disabled: false, grad: ["#fbbf24", "#d97706"],
                },
              ]).map(({ method, icon: Icon, title, desc, disabled, grad }) => {
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

            {payMethod === "online" && settings.paymentQr && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center bg-white/60 border border-white/70 rounded-2xl p-6">
                <p className="text-[14px] font-bold text-[#111827] mb-3">Scan to pay {inr(total)}</p>
                <img src={settings.paymentQr} alt="Shop payment QR" className="w-56 h-56 object-contain rounded-2xl bg-white border border-white/80 shadow-md" />
                <p className="mt-3 text-[18px] font-extrabold text-[#111827] flex items-center gap-1">
                  <IndianRupee className="w-4 h-4" /> Amount to pay: {inr(total)}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 text-orange-700 text-[11px] font-semibold">
                  <Clock className="w-3 h-3" /> Payment pending
                </span>
                <p className="mt-3 text-[11px] text-[#111827]/50 text-center max-w-[280px]">
                  Pay with any UPI app. The shopkeeper verifies your payment — you can&apos;t mark it paid yourself.
                </p>
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

            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(2)} className="h-12 px-5 rounded-full bg-white/60 border border-white/70 text-[13px] font-semibold text-[#111827] inline-flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!payMethod}
                onClick={() => payMethod && submitJob(payMethod)}
                className="flex-1 h-12 rounded-full bg-[#111827] text-white text-[14px] font-semibold hover:bg-black transition-colors disabled:opacity-40"
              >
                {payMethod === "cash" ? "Submit — I'll pay cash at the counter" : "I've paid — submit document"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4 — Pending → Success ── */}
        {step === 4 && job && (
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
