"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IndianRupee, Printer, Palette, CheckCircle2, MapPin,
  Loader2, Check, Clock, ShieldCheck, CreditCard, KeyRound, AlertCircle, X, Banknote
} from "lucide-react";
import {
  getShopSettings, saveShopSettings, type ShopkeeperSettings,
  getBillingStatus, requestBankOtp, verifyBankOtp, updateUpiDetails, type BillingStatus
} from "@/lib/printShop";

export function PrintingSettings({ token }: { token: string | null }) {
  const [settings, setSettings] = useState<ShopkeeperSettings>({
    bwPrice: 2, colorPrice: 5, locationName: "", qrUrl: null, isAccepting: true,
  });
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  
  const [savedToast, setSavedToast] = useState(false);
  const [saving, setSaving] = useState(false);

  // OTP & Bank Form State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState<"request" | "verify" | "form">("request");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [processingOtp, setProcessingOtp] = useState(false);
  
  const [editToken, setEditToken] = useState<string | null>(null);
  const [upiForm, setUpiForm] = useState({ upiId: "", upiName: "" });
  const [updatingBank, setUpdatingBank] = useState(false);

  // Load settings from backend on mount
  useEffect(() => {
    if (!token) return;
    getShopSettings(token).then(data => setSettings(data)).catch(() => {});
    getBillingStatus(token).then(data => setBilling(data)).catch(() => {});
  }, [token]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await saveShopSettings({
        bwPrice: settings.bwPrice,
        colorPrice: settings.colorPrice,
        locationName: settings.locationName,
        isAccepting: settings.isAccepting,
        retentionHours: settings.retentionHours || 24,
      }, token);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2600);
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!token) return;
    setProcessingOtp(true);
    setOtpError("");
    try {
      await requestBankOtp(token);
      setOtpStep("verify");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setProcessingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!token || !otpValue.trim()) return;
    setProcessingOtp(true);
    setOtpError("");
    try {
      const data = await verifyBankOtp(otpValue.trim(), token);
      if (data.success && data.editToken) {
        setEditToken(data.editToken);
        setOtpStep("form");
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setProcessingOtp(false);
    }
  };

  const handleSubmitUpiDetails = async () => {
    if (!token || !editToken) return;
    if (!upiForm.upiId || !upiForm.upiName) {
      setOtpError("All fields are required");
      return;
    }
    setUpdatingBank(true);
    setOtpError("");
    try {
      const data = await updateUpiDetails(
        editToken,
        upiForm.upiId,
        upiForm.upiName,
        token
      );
      if (data.success) {
        setBilling(prev => prev ? {
          ...prev,
          upi_id: data.upi_id,
          bank_verification_status: 'verified',
          charges_enabled: true
        } : {
          upi_id: data.upi_id,
          bank_verification_status: 'verified',
          charges_enabled: true,
          razorpay_account_id: null,
          bank_last4: null
        });
        setShowOtpModal(false);
        setOtpStep("request");
        setEditToken(null);
        setUpiForm({ upiId: "", upiName: "" });
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to update details");
    } finally {
      setUpdatingBank(false);
    }
  };

  const isConnected = billing?.bank_verification_status === 'verified' && billing?.charges_enabled;

  return (
    <div className="bg-white/40 backdrop-blur-[32px] border border-white/60 rounded-[24px] p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fcd34d] to-[#f59e0b] flex items-center justify-center shadow-sm">
            <Printer className="w-5 h-5 text-white" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-[#111827]">Printing & Payouts Settings</h3>
            <p className="text-[12px] text-[#111827]/60">Configure pricing and your Razorpay automated payouts.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${isConnected ? "bg-emerald-500/15 text-emerald-700" : "bg-orange-500/15 text-orange-700"}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-orange-500"}`} />
          {isConnected ? "Payouts Active" : "Payouts Setup Required"}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── Secure Payouts Section ── */}
        <div className="bg-white/50 border border-white/70 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#111827]" strokeWidth={2} />
            <span className="text-[13px] font-bold text-[#111827]">Direct P2P UPI Setup</span>
          </div>

          <div className="flex-1 flex flex-col bg-white/40 rounded-xl border border-[#111827]/10 overflow-hidden p-4 justify-center">
            {billing?.upi_id ? (
              <div className="flex flex-col items-center gap-4 text-center">
                {billing.bank_verification_status === 'verified' ? (
                  <div className="flex flex-col items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-8 h-8 mb-1" />
                    <span className="text-[14px] font-bold">Bank Account Verified</span>
                    <span className="text-[12px] text-emerald-600/80">95% automated revenue split is active</span>
                  </div>
                ) : billing.bank_verification_status === 'failed' ? (
                  <div className="flex flex-col items-center gap-1 text-red-600">
                    <AlertCircle className="w-8 h-8 mb-1" />
                    <span className="text-[14px] font-bold">Verification Failed</span>
                    <span className="text-[12px] text-red-600/80">Please update your bank details.</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-amber-600">
                    <Clock className="w-8 h-8 mb-1" />
                    <span className="text-[14px] font-bold">KYC Pending</span>
                    <span className="text-[12px] text-amber-600/80">Razorpay is verifying your account...</span>
                  </div>
                )}
                
                <div className="w-full p-3 bg-[#111827]/5 rounded-xl border border-[#111827]/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-[#111827]/60" />
                    <div className="text-left">
                      <p className="text-[11px] text-[#111827]/50 font-medium uppercase tracking-wider">Settlement UPI ID</p>
                      <p className="text-[13px] font-bold text-[#111827]">{billing.upi_id}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setShowOtpModal(true); setOtpStep("request"); }}
                  className="mt-2 w-full h-10 rounded-xl bg-[#111827]/10 hover:bg-[#111827]/20 text-[#111827] text-[12px] font-bold transition-colors"
                >
                  Manage Bank Details
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-1">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                </div>
                <h4 className="text-[14px] font-bold text-[#111827]">Setup Direct Payments</h4>
                <p className="text-[12px] text-[#111827]/60">Link your UPI ID to receive 100% of every order instantly directly from students.</p>
                
                <button
                  onClick={() => { setShowOtpModal(true); setOtpStep("request"); }}
                  className="mt-3 w-full inline-flex items-center justify-center h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold transition-colors shadow-sm shadow-indigo-500/20"
                >
                  Connect UPI ID
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

          <div className="bg-white/50 border border-white/70 rounded-2xl p-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#111827]" strokeWidth={2} />
              <span className="text-[13px] font-bold text-[#111827]">Shop Details</span>
            </div>
            <label className="block mb-4">
              <span className="block text-[11px] font-semibold text-[#111827]/60 mb-1.5">Pickup Location</span>
              <input
                type="text" placeholder="e.g. Ground Floor, Block A"
                value={settings.locationName || ""}
                onChange={(e) => setSettings(s => ({ ...s, locationName: e.target.value }))}
                className="w-full bg-white border border-white/80 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#111827] focus:outline-none focus:border-indigo-500/30 transition-colors"
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#111827]">Accepting Orders</span>
              <button
                onClick={() => setSettings(s => ({ ...s, isAccepting: !s.isAccepting }))}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${settings.isAccepting ? "bg-emerald-500" : "bg-black/20"}`}
              >
                <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.isAccepting ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="relative px-6 py-2.5 rounded-xl bg-[#111827] text-white text-[13px] font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50 overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {saving ? (
              <motion.div key="saving" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving
              </motion.div>
            ) : savedToast ? (
              <motion.div key="saved" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" /> Saved
              </motion.div>
            ) : (
              <motion.div key="default" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                Save Settings
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* OTP / Bank Details Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-[#111827]/10"
            >
              <div className="p-5 border-b border-[#111827]/5 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-[#111827] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> Secure Bank Setup
                </h3>
                <button onClick={() => setShowOtpModal(false)} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5 text-[#111827]/50" />
                </button>
              </div>

              <div className="p-6">
                {otpStep === "request" && (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <KeyRound className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h4 className="text-[16px] font-bold mb-2">Verification Required</h4>
                    <p className="text-[13px] text-[#111827]/60 mb-6">For your security, adding or updating bank details requires email verification.</p>
                    {otpError && <p className="text-red-500 text-sm mb-4">{otpError}</p>}
                    <button 
                      onClick={handleRequestOtp} disabled={processingOtp}
                      className="w-full py-3 rounded-xl bg-[#111827] text-white font-bold text-[14px] hover:bg-black transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                      {processingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Send OTP to Registered Email
                    </button>
                  </div>
                )}

                {otpStep === "verify" && (
                  <div className="text-center">
                    <h4 className="text-[16px] font-bold mb-2">Enter OTP</h4>
                    <p className="text-[13px] text-[#111827]/60 mb-6">We've sent a 6-digit code to your email.</p>
                    <input 
                      type="text" maxLength={6} placeholder="• • • • • •"
                      value={otpValue} onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 border border-[#111827]/20 rounded-xl mb-4 focus:outline-none focus:border-indigo-500"
                    />
                    {otpError && <p className="text-red-500 text-sm mb-4">{otpError}</p>}
                    <button 
                      onClick={handleVerifyOtp} disabled={processingOtp || otpValue.length !== 6}
                      className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-[14px] hover:bg-indigo-700 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                      {processingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Verify Securely
                    </button>
                  </div>
                )}

                {otpStep === "form" && (
                  <div className="space-y-4">
                    <p className="text-[13px] font-medium text-emerald-600 bg-emerald-50 p-2 rounded-lg flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-4 h-4" /> Secure Session Active
                    </p>
                    <label className="block">
                      <span className="block text-[12px] font-bold text-[#111827]/80 mb-1.5">Vendor / Business Name</span>
                      <input 
                        type="text" value={upiForm.upiName} onChange={e => setUpiForm(s => ({...s, upiName: e.target.value}))}
                        className="w-full bg-[#111827]/5 border border-[#111827]/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[12px] font-bold text-[#111827]/80 mb-1.5">UPI ID</span>
                      <input 
                        type="text" value={upiForm.upiId} onChange={e => setUpiForm(s => ({...s, upiId: e.target.value.toLowerCase()}))}
                        placeholder="e.g. name@bank"
                        className="w-full bg-[#111827]/5 border border-[#111827]/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
                      />
                    </label>
                    {otpError && <p className="text-red-500 text-sm mt-2">{otpError}</p>}
                    <button 
                      onClick={handleSubmitUpiDetails} disabled={updatingBank}
                      className="w-full mt-2 py-3 rounded-xl bg-indigo-600 text-white font-bold text-[14px] hover:bg-indigo-700 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                      {updatingBank ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Securely Register UPI ID
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
