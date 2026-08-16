"use client";

/**
 * "Printing & Payment Settings" — shopkeeper-only section inside Dashboard → Settings.
 * 
 * Payment setup flow:
 *   1. Vendor enters their UPI ID (e.g. name@ybl)
 *   2. Backend calls Razorpay QR Codes API → creates a permanent multi-use QR
 *   3. QR image is stored in DB and displayed here with a download button
 *   4. Students scan this QR at the counter or on the /g2p/[code] page
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, IndianRupee, Printer, Palette, CheckCircle2, MapPin,
  Loader2, Download, AtSign, Copy, Check,
} from "lucide-react";
/* eslint-disable @next/next/no-img-element */
import {
  getShopSettings, saveShopSettings, connectRazorpayAccount, type ShopkeeperSettings,
} from "@/lib/printShop";

export function PrintingSettings({ token }: { token: string | null }) {
  const [settings, setSettings] = useState<ShopkeeperSettings>({
    bwPrice: 2, colorPrice: 5, locationName: "", qrUrl: null, isAccepting: true,
  });
  const [savedToast, setSavedToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [copied, setCopied] = useState(false);

  // Load settings from backend on mount
  useEffect(() => {
    if (!token) return;
    getShopSettings(token).then(data => {
      setSettings(data);
      if (data.upiId) setUpiId(data.upiId);
    }).catch(() => {});
  }, [token]);

  const isConnected = !!(settings.razorpay_account_id && settings.charges_enabled);
  const qrImageUrl = settings.qrImageUrl || settings.qrUrl;

  const handleConnectRazorpay = async () => {
    if (!token) return;
    if (!upiId.trim() || !upiId.includes("@")) {
      setConnectError("Please enter a valid UPI ID (e.g. name@ybl)");
      return;
    }
    setConnectError("");
    setConnecting(true);
    try {
      const data = await connectRazorpayAccount(upiId.trim(), token);
      if (data.success) {
        setSettings(prev => ({
          ...prev,
          razorpay_account_id: "connected",
          charges_enabled: true,
          upiId: data.upiId,
          qrImageUrl: data.qrImageUrl,
          qrId: data.qrId,
        }));
      }
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : "Connection failed. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrImageUrl) return;
    const a = document.createElement("a");
    a.href = qrImageUrl;
    a.download = `share2me-payment-qr-${upiId}.png`;
    a.target = "_blank";
    a.click();
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await saveShopSettings({
        bwPrice: settings.bwPrice,
        colorPrice: settings.colorPrice,
        locationName: settings.locationName,
        isAccepting: settings.isAccepting,
      }, token);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2600);
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/40 backdrop-blur-[32px] border border-white/60 rounded-[24px] p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fcd34d] to-[#f59e0b] flex items-center justify-center shadow-sm">
            <Printer className="w-5 h-5 text-white" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-[#111827]">Printing & Payment Settings</h3>
            <p className="text-[12px] text-[#111827]/60">Configure pricing and your Razorpay UPI QR for customer payments.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${isConnected ? "bg-emerald-500/15 text-emerald-700" : "bg-orange-500/15 text-orange-700"}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-orange-500"}`} />
          {isConnected ? "Payments Active" : "Payment Not Configured"}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── Razorpay UPI QR Section ── */}
        <div className="bg-white/50 border border-white/70 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-[#111827]" strokeWidth={2} />
            <span className="text-[13px] font-bold text-[#111827]">Razorpay UPI Payment QR</span>
          </div>

          <div className="flex-1 flex flex-col bg-white/40 rounded-xl border border-[#111827]/10 overflow-hidden">
            {isConnected ? (
              /* ── CONNECTED STATE ── */
              <div className="flex flex-col items-center gap-3 p-4 text-center">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-[13px] font-bold">Razorpay Connected</span>
                </div>

                {/* QR Image */}
                {qrImageUrl ? (
                  <div className="w-full flex flex-col items-center gap-2">
                    <img
                      src={qrImageUrl}
                      alt="Payment QR Code"
                      className="w-36 h-36 rounded-xl border-2 border-[#111827]/10 shadow-sm object-contain bg-white p-1"
                    />
                    <p className="text-[11px] text-[#111827]/50">Permanent QR • Scan to pay any amount</p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={handleDownloadQr}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#111827] text-white text-[12px] font-semibold hover:bg-black transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download QR
                      </button>
                      <button
                        onClick={handleCopyUpi}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#111827]/10 text-[#111827] text-[12px] font-semibold hover:bg-[#111827]/20 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied!" : "Copy UPI"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* QR API not activated — show UPI ID as fallback */
                  <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <AtSign className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                    <p className="text-[12px] font-bold text-[#111827]">{upiId}</p>
                    <p className="text-[11px] text-[#111827]/50 mt-1">
                      QR image unavailable — share your UPI ID with customers directly.
                    </p>
                    <button onClick={handleCopyUpi} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy UPI ID"}
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-[#111827]/40 mt-1">
                  UPI: <span className="font-mono font-semibold">{upiId}</span>
                </p>
              </div>
            ) : (
              /* ── SETUP STATE ── */
              <div className="flex flex-col gap-3 p-4 w-full">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-[#111827]">Generate Your Payment QR</h4>
                    <p className="text-[11px] text-[#111827]/60">Enter your UPI ID — we'll generate a permanent QR instantly</p>
                  </div>
                </div>

                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111827]/40" />
                  <input
                    type="text"
                    placeholder="yourname@ybl"
                    value={upiId}
                    onChange={(e) => { setUpiId(e.target.value); setConnectError(""); }}
                    className="w-full h-[40px] bg-[#111827]/5 border border-[#111827]/10 rounded-xl text-[13px] font-semibold text-[#111827] pl-9 pr-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {connectError && (
                  <p className="text-[11px] text-red-500 font-semibold">{connectError}</p>
                )}

                <button
                  onClick={handleConnectRazorpay}
                  disabled={connecting || !upiId.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {connecting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating QR…</>
                  ) : (
                    <><QrCode className="w-4 h-4" /> Generate Payment QR</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Prices + Location ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white/50 border border-white/70 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <IndianRupee className="w-4 h-4 text-[#111827]" strokeWidth={2} />
              <span className="text-[13px] font-bold text-[#111827]">Printing Prices (per page)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]/60 mb-1.5">
                  <Printer className="w-3.5 h-3.5" /> Black & White
                </span>
                <div className="flex items-center bg-white rounded-xl border border-white/80 px-3">
                  <span className="text-[14px] font-bold text-[#111827]/50">₹</span>
                  <input
                    type="number" min={0} step={0.5} value={settings.bwPrice}
                    onChange={(e) => setSettings((s) => ({ ...s, bwPrice: Math.max(0, Number(e.target.value)) }))}
                    className="w-full bg-transparent px-2 py-2.5 text-[15px] font-bold text-[#111827] focus:outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]/60 mb-1.5">
                  <Palette className="w-3.5 h-3.5" /> Color
                </span>
                <div className="flex items-center bg-white rounded-xl border border-white/80 px-3">
                  <span className="text-[14px] font-bold text-[#111827]/50">₹</span>
                  <input
                    type="number" min={0} step={0.5} value={settings.colorPrice}
                    onChange={(e) => setSettings((s) => ({ ...s, colorPrice: Math.max(0, Number(e.target.value)) }))}
                    className="w-full bg-transparent px-2 py-2.5 text-[15px] font-bold text-[#111827] focus:outline-none"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white/50 border border-white/70 rounded-2xl p-4">
            <label className="block">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]/60 mb-1.5">
                <MapPin className="w-3.5 h-3.5" /> Shop / location name (optional)
              </span>
              <input
                type="text" value={settings.locationName}
                onChange={(e) => setSettings((s) => ({ ...s, locationName: e.target.value }))}
                placeholder="e.g. Sharma Xerox, Gate 2"
                className="w-full bg-white rounded-xl border border-white/80 px-3 py-2.5 text-[13px] text-[#111827] focus:outline-none focus:border-[#111827]/40"
              />
            </label>
          </div>

          <button
            onClick={save} disabled={saving}
            className="mt-auto self-start inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#111827] text-white text-[13px] font-semibold hover:bg-black transition-colors shadow-[0_8px_20px_rgba(0,0,0,0.18)] disabled:opacity-60"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 bg-[#111827] text-white px-5 py-3 rounded-full shadow-2xl text-[13px] font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Settings updated successfully.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
