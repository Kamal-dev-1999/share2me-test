"use client";

/**
 * "Printing & Payment Settings" — shopkeeper-only section rendered inside
 * Dashboard → Settings. Configures the UPI payment QR image and the
 * per-page printing prices that drive the student checkout flow.
 */

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  QrCode, Upload, Trash2, RefreshCw, IndianRupee, Printer, Palette,
  CheckCircle2, MapPin, Loader2,
} from "lucide-react";
/* eslint-disable @next/next/no-img-element */
import {
  getShopSettings, saveShopSettings, uploadQrImage, type ShopkeeperSettings,
} from "@/lib/printShop";

export function PrintingSettings() {
  const { data: session } = useSession();
  const token = (session as { backendToken?: string })?.backendToken;
  const [settings, setSettings] = useState<ShopkeeperSettings>({
    bwPrice: 2, colorPrice: 5, locationName: '', qrUrl: null, isAccepting: true,
  });
  const [savedToast, setSavedToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load settings from backend on mount
  useEffect(() => {
    if (!token) return;
    getShopSettings(token).then(setSettings).catch(() => {});
  }, [token]);

  const qrConfigured = !!settings.qrUrl;

  const onQrFile = async (file: File) => {
    if (!token) return;
    setQrUploading(true);
    try {
      const { qrUrl } = await uploadQrImage(file, token);
      setSettings((s) => ({ ...s, qrUrl }));
    } catch {
      alert("QR upload failed. Please try again.");
    } finally {
      setQrUploading(false);
    }
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await saveShopSettings({ bwPrice: settings.bwPrice, colorPrice: settings.colorPrice, locationName: settings.locationName, isAccepting: settings.isAccepting }, token);
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
            <h3 className="text-[16px] font-bold text-[#111827]">Printing &amp; Payment Settings</h3>
            <p className="text-[12px] text-[#111827]/60">Payment QR and per-page prices shown to your customers.</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
            qrConfigured ? "bg-emerald-500/15 text-emerald-700" : "bg-orange-500/15 text-orange-700"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${qrConfigured ? "bg-emerald-500" : "bg-orange-500"}`} />
          {qrConfigured ? "Payment QR Active" : "QR Not Configured"}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── Payment QR ── */}
        <div className="bg-white/50 border border-white/70 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-[#111827]" strokeWidth={2} />
            <span className="text-[13px] font-bold text-[#111827]">Payment QR Code</span>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onQrFile(e.target.files[0])}
          />

          {qrUploading ? (
            <div className="w-full h-40 rounded-xl border-2 border-dashed border-[#111827]/20 bg-white/40 flex flex-col items-center justify-center gap-2 text-[#111827]/50">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[13px] font-semibold">Uploading QR…</span>
            </div>
          ) : settings.qrUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={settings.qrUrl}
                alt="Payment QR preview"
                className="w-40 h-40 object-contain rounded-xl bg-white border border-white/80 shadow-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#111827] text-white text-[12px] font-semibold hover:bg-black transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Replace
                </button>
                <button
                  onClick={() => setSettings((s) => ({ ...s, qrUrl: null }))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-500/10 text-red-600 text-[12px] font-semibold hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-[#111827]/20 bg-white/40 hover:bg-white/70 hover:border-[#111827]/40 transition-all flex flex-col items-center justify-center gap-2 text-[#111827]/60"
            >
              <Upload className="w-6 h-6" strokeWidth={1.75} />
              <span className="text-[13px] font-semibold">Upload Payment QR</span>
              <span className="text-[11px]">Your UPI QR from PhonePe / GPay / Paytm</span>
            </button>
          )}
        </div>

        {/* ── Prices + location ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white/50 border border-white/70 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <IndianRupee className="w-4 h-4 text-[#111827]" strokeWidth={2} />
              <span className="text-[13px] font-bold text-[#111827]">Printing Prices (per page)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]/60 mb-1.5">
                  <Printer className="w-3.5 h-3.5" /> Black &amp; White
                </span>
                <div className="flex items-center bg-white rounded-xl border border-white/80 px-3">
                  <span className="text-[14px] font-bold text-[#111827]/50">₹</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={settings.bwPrice}
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
                    type="number"
                    min={0}
                    step={0.5}
                    value={settings.colorPrice}
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
                type="text"
                value={settings.locationName}
                onChange={(e) => setSettings((s) => ({ ...s, locationName: e.target.value }))}
                placeholder="e.g. Sharma Xerox, Gate 2"
                className="w-full bg-white rounded-xl border border-white/80 px-3 py-2.5 text-[13px] text-[#111827] focus:outline-none focus:border-[#111827]/40"
              />
            </label>
          </div>

          <button
            onClick={save}
            disabled={saving}
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 bg-[#111827] text-white px-5 py-3 rounded-full shadow-2xl text-[13px] font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Printing and payment settings updated successfully.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
