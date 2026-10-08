"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Printer, CreditCard, Sparkles, Clock, MapPin,
  ImageIcon, Trash2, Upload, Check, CheckCircle2, AlertCircle,
  ShieldCheck, ChevronDown, Lock, Crown, RotateCcw,
  Loader2, Copy, Building2, Phone, Globe, User, X, ArrowRight
} from "lucide-react";
import QRCode from "react-qr-code";
import {
  getShopSettings, saveShopSettings, type ShopkeeperSettings,
  getBillingStatus, requestBankOtp, verifyBankOtp, updateUpiDetails,
  type BillingStatus
} from "@/lib/printShop";
import { getBackendUrl } from "@/lib/backendUrl";

export interface UserProfile {
  userId: string;
  googleId: string;
  email: string;
  username: string;
  shareCode: string;
  profilePhoto: string;
  createdAt: string;
  planType?: string;
}

const RETENTION_OPTIONS = [
  { value: 2, label: "2 Hours (Free Default)", desc: "Standard auto-purge for free tier", proOnly: false },
  { value: 12, label: "12 Hours (Pro)", desc: "Half-day customer pickup window", proOnly: true },
  { value: 24, label: "24 Hours (Pro)", desc: "Full-day buffer for daily jobs", proOnly: true },
  { value: 48, label: "2 Days (Pro)", desc: "Weekend buffer for multi-day orders", proOnly: true },
  { value: 168, label: "7 Days (Pro Max)", desc: "Maximum 1-week archival safety", proOnly: true },
];

interface UserSettingsHubProps {
  user: UserProfile;
  token: string | null;
  isShopkeeper: boolean;
  isPro: boolean;
  planType: string;
  monthlyStats?: { received: number; remaining: number | null; limit: number | null };
  setIsUpgradeModalOpen: (v: boolean) => void;
  // Profile props
  displayName: string;
  setDisplayName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  handleUpdateProfile: () => Promise<void>;
  isUpdatingProfile: boolean;
  profileUpdateStatus: { ok: boolean; msg: string } | null;
  // Persona props
  persona: string;
  setPersona: (v: string) => void;
  handleUpdatePersona: (newPersona: string) => Promise<void>;
  isUpdatingPersona: boolean;
  personaUpdateStatus: { ok: boolean; msg: string } | null;
  // QR props
  qrFgColor: string;
  setQrFgColor: (v: string) => void;
  qrBgColor: string;
  setQrBgColor: (v: string) => void;
  qrLogoUrl: string;
  setQrLogoUrl: (v: string) => void;
  saveQrSettings: () => void;
  qrSaved: boolean;
  onRetriggerSetup?: () => void;
}

export function UserSettingsHub({
  user,
  token,
  isShopkeeper,
  isPro,
  planType,
  monthlyStats,
  setIsUpgradeModalOpen,
  displayName,
  setDisplayName,
  phone,
  setPhone,
  company,
  setCompany,
  website,
  setWebsite,
  bio,
  setBio,
  handleUpdateProfile,
  isUpdatingProfile,
  profileUpdateStatus,
  persona,
  setPersona,
  handleUpdatePersona,
  isUpdatingPersona,
  personaUpdateStatus,
  qrFgColor,
  setQrFgColor,
  qrBgColor,
  setQrBgColor,
  qrLogoUrl,
  setQrLogoUrl,
  saveQrSettings,
  qrSaved,
  onRetriggerSetup,
}: UserSettingsHubProps) {
  // Navigation tabs
  type SettingsTab = "storefront" | "pricing" | "payouts" | "plan";
  const [activeTab, setActiveTab] = useState<SettingsTab>("storefront");

  // Shop settings state
  const [shopSettings, setShopSettings] = useState<ShopkeeperSettings>({
    bwPrice: 2,
    colorPrice: 5,
    locationName: "",
    qrUrl: null,
    isAccepting: true,
    retentionHours: 24,
  });
  const [initialShopSettings, setInitialShopSettings] = useState<ShopkeeperSettings | null>(null);

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [shopImages, setShopImages] = useState<{ r2Key: string; url: string }[]>([]);
  const [initialShopImages, setInitialShopImages] = useState<{ r2Key: string; url: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "success" | "error">("idle");
  const [gpsError, setGpsError] = useState<string>("");
  const [gpsAddress, setGpsAddress] = useState<string>("");

  // Saving state
  const [isSavingTab, setIsSavingTab] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // OTP Bank Modal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState<"request" | "verify" | "form">("request");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [processingOtp, setProcessingOtp] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [upiForm, setUpiForm] = useState({ upiId: "", upiName: "" });
  const [updatingBank, setUpdatingBank] = useState(false);

  // Agent Status
  const [agentOnline, setAgentOnline] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === "storefront") {
      const checkAgent = async () => {
        try {
          const res = await fetch(`${getBackendUrl()}/g2p/vendor/agent-status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setAgentOnline(data.isOnline || data.online);
          }
        } catch {
          // ignore
        }
      };
      checkAgent();
      interval = setInterval(checkAgent, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab, token]);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Retention dropdown
  const [isRetentionDropdownOpen, setIsRetentionDropdownOpen] = useState(false);
  const retentionDropdownRef = useRef<HTMLDivElement>(null);
  const [retentionNotice, setRetentionNotice] = useState<string | null>(null);

  // Tab auto-scroll refs for mobile
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabRef.current && tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const tab = activeTabRef.current;
      const scrollLeft = tab.offsetLeft - container.clientWidth / 2 + tab.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeTab]);

  // Initial form values for dirty tracking
  const [initialProfile, setInitialProfile] = useState({
    displayName, phone, company, website, bio
  });
  useEffect(() => {
    setInitialProfile({ displayName, phone, company, website, bio });
  }, []);

  // Show Toast
  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch address from GPS coords
  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data && data.display_name) {
        setGpsAddress(data.display_name);
      } else {
        setGpsAddress("Coordinates pinned successfully");
      }
    } catch {
      setGpsAddress("Coordinates pinned successfully");
    }
  };

  // Load shop settings
  useEffect(() => {
    if (!token || !isShopkeeper) return;
    getShopSettings(token).then((data) => {
      setShopSettings(data);
      setInitialShopSettings(data);
      if (data.latitude && data.longitude) {
        fetchAddressFromCoords(data.latitude, data.longitude);
      }
      if (data.shopImages) {
        setShopImages(data.shopImages);
        setInitialShopImages(data.shopImages);
      }
    }).catch(() => {});

    getBillingStatus(token).then(data => setBilling(data)).catch(() => {});
  }, [token, isShopkeeper]);

  // Click outside for retention dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (retentionDropdownRef.current && !retentionDropdownRef.current.contains(event.target as Node)) {
        setIsRetentionDropdownOpen(false);
      }
    }
    if (isRetentionDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isRetentionDropdownOpen]);

  // Detect location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      setGpsStatus("error");
      return;
    }
    setGpsStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          if (token) {
            const { saveShopLocation } = await import("@/lib/printShop");
            await saveShopLocation(position.coords.latitude, position.coords.longitude, token);
            await fetchAddressFromCoords(position.coords.latitude, position.coords.longitude);
            setGpsStatus("success");
            showToast("Store live location pinned successfully!");
            setTimeout(() => setGpsStatus("idle"), 5000);
          }
        } catch {
          setGpsError("Failed to save location to server");
          setGpsStatus("error");
        }
      },
      (error) => {
        let msg = "Failed to detect location";
        if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied";
        if (error.code === error.POSITION_UNAVAILABLE) msg = "Location unavailable";
        if (error.code === error.TIMEOUT) msg = "Location request timed out";
        setGpsError(msg);
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Upload shop image
  const handleUploadShopImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (shopImages.length >= 3) {
      setGalleryNotice("Maximum 3 photos allowed.");
      setTimeout(() => setGalleryNotice(null), 3000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setGalleryNotice("Photo must be under 5MB.");
      setTimeout(() => setGalleryNotice(null), 3000);
      return;
    }
    setUploadingImage(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || `${getBackendUrl()}/g2p/printshop`;
      const presignRes = await fetch(`${API_BASE}/settings/images/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      if (!presignRes.ok) throw new Error("Failed to get presigned URL");
      const { url, r2Key } = await presignRes.json();

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload image");

      const previewUrl = URL.createObjectURL(file);
      setShopImages((prev) => [...prev, { r2Key, url: previewUrl }]);
      showToast("Photo uploaded! Remember to save changes.");
    } catch (err) {
      console.error(err);
      setGalleryNotice("Upload failed. Please try again.");
      setTimeout(() => setGalleryNotice(null), 3000);
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteShopImage = (index: number) => {
    setShopImages((prev) => prev.filter((_, i) => i !== index));
  };

  // OTP Bank Handlers
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
      setOtpError(err instanceof Error ? err.message : "Invalid OTP code");
    } finally {
      setProcessingOtp(false);
    }
  };

  const handleSubmitUpiDetails = async () => {
    if (!token || !editToken) return;
    if (!upiForm.upiId.trim() || !upiForm.upiName.trim()) {
      setOtpError("Both UPI ID and Account Holder Name are required");
      return;
    }
    setUpdatingBank(true);
    setOtpError("");
    try {
      const data = await updateUpiDetails(editToken, upiForm.upiId.trim(), upiForm.upiName.trim(), token);
      if (data.success) {
        setBilling((prev) =>
          prev
            ? { ...prev, upi_id: data.upi_id, bank_verification_status: "verified", charges_enabled: true }
            : { upi_id: data.upi_id, bank_verification_status: "verified", charges_enabled: true, razorpay_account_id: null, bank_last4: null }
        );
        setShowOtpModal(false);
        setOtpStep("request");
        setEditToken(null);
        setUpiForm({ upiId: "", upiName: "" });
        showToast("Settlement bank UPI updated successfully!");
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to update UPI details");
    } finally {
      setUpdatingBank(false);
    }
  };

  // Dirty State Computations
  const isProfileDirty = useMemo(() => {
    return (
      displayName !== initialProfile.displayName ||
      phone !== initialProfile.phone ||
      company !== initialProfile.company ||
      website !== initialProfile.website ||
      bio !== initialProfile.bio ||
      (isShopkeeper && initialShopSettings && (
        shopSettings.locationName !== (initialShopSettings.locationName || "") ||
        shopImages.length !== initialShopImages.length ||
        shopImages.some((img, idx) => img.r2Key !== initialShopImages[idx]?.r2Key)
      ))
    );
  }, [displayName, phone, company, website, bio, initialProfile, isShopkeeper, shopSettings.locationName, shopImages, initialShopImages, initialShopSettings]);

  const isPricingDirty = useMemo(() => {
    if (!initialShopSettings) return false;
    return (
      shopSettings.bwPrice !== initialShopSettings.bwPrice ||
      shopSettings.colorPrice !== initialShopSettings.colorPrice ||
      (shopSettings.retentionHours || 24) !== (initialShopSettings.retentionHours || 24) ||
      shopSettings.isAccepting !== initialShopSettings.isAccepting
    );
  }, [shopSettings, initialShopSettings]);

  // Save Handlers
  const handleSaveStorefront = async () => {
    setIsSavingTab(true);
    try {
      await handleUpdateProfile();
      if (isShopkeeper && token) {
        await saveShopSettings({
          bwPrice: shopSettings.bwPrice,
          colorPrice: shopSettings.colorPrice,
          locationName: shopSettings.locationName,
          isAccepting: shopSettings.isAccepting,
          retentionHours: shopSettings.retentionHours || 24,
          shopImages: shopImages.map((img) => img.r2Key),
        }, token);
        setInitialShopImages([...shopImages]);
        setInitialShopSettings({ ...shopSettings });
      }
      setInitialProfile({ displayName, phone, company, website, bio });
      showToast("Storefront details saved successfully!");
    } catch {
      showToast("Failed to save storefront details.", "error");
    } finally {
      setIsSavingTab(false);
    }
  };

  const handleSavePricing = async () => {
    if (!token) return;
    setIsSavingTab(true);
    try {
      await saveShopSettings({
        bwPrice: Number(shopSettings.bwPrice),
        colorPrice: Number(shopSettings.colorPrice),
        locationName: shopSettings.locationName,
        isAccepting: shopSettings.isAccepting,
        retentionHours: shopSettings.retentionHours || 24,
        shopImages: shopImages.map((img) => img.r2Key),
      }, token);
      setInitialShopSettings({ ...shopSettings });
      showToast("Pricing & order intake settings saved!");
    } catch {
      showToast("Failed to save pricing settings.", "error");
    } finally {
      setIsSavingTab(false);
    }
  };

  const handleDiscardChanges = () => {
    if (activeTab === "storefront") {
      setDisplayName(initialProfile.displayName);
      setPhone(initialProfile.phone);
      setCompany(initialProfile.company);
      setWebsite(initialProfile.website);
      setBio(initialProfile.bio);
      if (initialShopSettings) {
        setShopSettings((s) => ({ ...s, locationName: initialShopSettings.locationName || "" }));
        setShopImages([...initialShopImages]);
      }
    } else if (activeTab === "pricing" && initialShopSettings) {
      setShopSettings({ ...initialShopSettings });
    }
  };

  const isCurrentTabDirty = activeTab === "storefront" ? isProfileDirty : activeTab === "pricing" ? isPricingDirty : false;

  const currentRetentionOption =
    RETENTION_OPTIONS.find((o) => o.value === (shopSettings.retentionHours || (isPro ? 24 : 2))) ||
    (isPro ? RETENTION_OPTIONS[2] : RETENTION_OPTIONS[0]);

  const isBankConnected = billing?.bank_verification_status === "verified" && billing?.charges_enabled;

  return (
    <div className="flex flex-col gap-4 md:h-full md:min-h-0 overflow-y-auto pr-1 pb-28 lg:pb-16 custom-scrollbar relative">
      {/* Settings Header & Sub-Navigation */}
      <div className="flex flex-col gap-3 border-b border-black/5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827] font-display tracking-tight">
              Settings
            </h2>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/5 text-[#111827]/70">
              {isShopkeeper ? "Merchant Hub" : "Personal"}
            </span>
          </div>

          {isShopkeeper && (
            <div className="flex items-center gap-2 bg-white/50 border border-white/70 px-2.5 py-1 rounded-full shadow-xs self-start sm:self-auto">
              <span className={`w-2 h-2 rounded-full ${shopSettings.isAccepting ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-[11px] font-bold text-[#111827]/75">
                {shopSettings.isAccepting ? "Store Open" : "Orders Paused"}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-[#111827]/60 leading-relaxed -mt-1">
          Configure your storefront identity, printing pricing, payouts, and portal branding.
        </p>

        {/* Tab Selector Pills - Responsive, Smooth Scrollable on Mobile & Symmetrical on Desktop (NEVER CUT OFF) */}
        <div
          ref={tabsContainerRef}
          className="w-full flex items-center gap-1.5 bg-white/50 backdrop-blur-xl border border-white/70 p-1.5 rounded-2xl sm:rounded-full shadow-xs overflow-x-auto no-scrollbar scroll-smooth"
        >
          {(isShopkeeper
            ? [
                { id: "storefront", label: "Storefront", fullLabel: "Storefront Profile", icon: Store },
                { id: "pricing", label: "Pricing", fullLabel: "Orders & Pricing", icon: Printer },
                { id: "payouts", label: "Payouts", fullLabel: "Payouts & Bank", icon: CreditCard },
                { id: "plan", label: "Plan & QR", fullLabel: "Plan & Portal", icon: Sparkles },
              ]
            : [
                { id: "storefront", label: "Profile", fullLabel: "Profile Details", icon: User },
                { id: "plan", label: "Plan & QR", fullLabel: "Plan & Branding", icon: Sparkles },
              ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={active ? activeTabRef : null}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`relative py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-xl sm:rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 outline-none select-none min-h-[40px] whitespace-nowrap shrink-0 sm:shrink sm:flex-1 ${
                  active
                    ? "text-white shadow-sm"
                    : "text-[#111827]/70 hover:text-[#111827] hover:bg-black/5"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="active-settings-tab"
                    className="absolute inset-0 bg-[#111827] rounded-xl sm:rounded-full z-0"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                <span className="relative z-10 hidden xl:inline">{tab.fullLabel}</span>
                <span className="relative z-10 xl:hidden">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: STOREFRONT & PROFILE
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "storefront" && (
        <motion.div
          key="storefront"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="grid md:grid-cols-2 gap-4 items-start">
            {/* Business Contact Card */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-[#111827]">
                    {isShopkeeper ? "Storefront Information" : "Profile Details"}
                  </h3>
                  <p className="text-[11px] text-[#111827]/55">Public identity displayed on your drop portal</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                    {isShopkeeper ? "Shop / Business Name" : "Display Name"}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Campus Xerox Hub"
                    className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3.5 py-2 text-sm text-[#111827] outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3.5 py-2 text-sm text-[#111827] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Share2Me Hub"
                      className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3.5 py-2 text-sm text-[#111827] outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                    Website or Social Link
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3.5 py-2 text-sm text-[#111827] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                    Storefront Bio / Description
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief description of your services, location landmarks, and printing capabilities..."
                    rows={3}
                    className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3.5 py-2 text-sm text-[#111827] outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/5">
                <span className="text-[11px] text-[#111827]/50">
                  {isProfileDirty ? "● Unsaved modifications" : "✓ All changes in sync"}
                </span>
                <button
                  onClick={handleSaveStorefront}
                  disabled={isSavingTab || isUpdatingProfile}
                  className="px-4 py-1.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingTab || isUpdatingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Storefront
                </button>
              </div>
            </div>

            {/* If shopkeeper: Location & Photo Gallery */}
            {isShopkeeper ? (
              <div className="flex flex-col gap-4">
                {/* Pickup & Map Pin Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-[#111827]">Pickup Location &amp; Map Pin</h3>
                      <p className="text-[11px] text-[#111827]/55">Helps nearby students locate your physical shop</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                      Pickup Landmark / Floor
                    </label>
                    <input
                      type="text"
                      value={shopSettings.locationName}
                      onChange={(e) => setShopSettings((s) => ({ ...s, locationName: e.target.value }))}
                      placeholder="e.g. Ground Floor, Near Student Canteen Block B"
                      className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3.5 py-2 text-sm text-[#111827] outline-none transition-colors"
                    />
                  </div>

                  <div className="bg-white/40 border border-white/70 rounded-xl p-3 flex flex-col gap-2 mt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${gpsAddress ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {gpsAddress ? "Live GPS Coordinates Pinned" : "Location Not Yet Pinned"}
                      </span>
                      <button
                        onClick={handleDetectLocation}
                        disabled={gpsStatus === "locating"}
                        className="px-3 py-1 rounded-lg bg-white border border-black/10 hover:bg-black/5 text-[#111827] text-[11px] font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1 self-start sm:self-auto"
                      >
                        {gpsStatus === "locating" ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3 text-emerald-600" />}
                        {gpsStatus === "locating" ? "Detecting..." : "Re-detect GPS"}
                      </button>
                    </div>
                    {gpsAddress && (
                      <p className="text-[11px] text-[#111827]/70 leading-relaxed font-mono bg-white/50 p-2 rounded-lg border border-black/5">
                        {gpsAddress}
                      </p>
                    )}
                    {gpsError && <p className="text-[11px] font-medium text-red-500">{gpsError}</p>}
                  </div>
                </div>

                {/* Storefront Photo Gallery Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-[#111827]">Shop Photo Gallery</h3>
                        <p className="text-[11px] text-[#111827]/55">Add up to 3 photos so students can spot your shop</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#111827]/60 bg-black/5 px-2 py-0.5 rounded-full font-mono">
                      {shopImages.length} / 3 Photos
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {shopImages.map((img, idx) => (
                      <div key={img.r2Key || idx} className="relative aspect-video rounded-xl overflow-hidden border border-black/10 group shadow-sm bg-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={`Store photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleDeleteShopImage(idx)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {shopImages.length < 3 && (
                      <label className="aspect-video rounded-xl border-2 border-dashed border-black/15 hover:border-black/30 bg-white/40 hover:bg-white/70 flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center group">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={handleUploadShopImage}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                        {uploadingImage ? (
                          <Loader2 className="w-5 h-5 text-[#111827]/60 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-[#111827]/60 group-hover:text-[#111827] transition-colors mb-1" />
                            <span className="text-[10px] font-bold text-[#111827]/70">Add Photo</span>
                          </>
                        )}
                      </label>
                    )}
                  </div>
                  {galleryNotice && <p className="text-[11px] text-amber-800 font-medium">{galleryNotice}</p>}
                </div>

                {/* Automation & Agent Setup Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="w-10 h-10 rounded-xl bg-[#111827]/10 text-[#111827] flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </span>
                      {agentOnline ? (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                      ) : (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#111827] flex items-center gap-2">
                        Local Print Agent
                        {agentOnline ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Online</span>
                        ) : (
                          <span className="bg-red-100 text-red-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Offline</span>
                        )}
                      </h3>
                      <p className="text-[11px] text-[#111827]/55 mt-0.5">
                        {agentOnline ? "Agent is actively monitoring orders" : "Re-run setup to connect your physical printers"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRetriggerSetup && onRetriggerSetup()}
                    className="shrink-0 px-4 py-2 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Agent Setup
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ORDERS & PRICING (Shopkeeper only)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "pricing" && isShopkeeper && (
        <motion.div
          key="pricing"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          {/* Hero Store Intake Status Card */}
          <div className={`rounded-2xl p-5 border transition-all shadow-sm ${
            shopSettings.isAccepting
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-amber-500/10 border-amber-500/30"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  shopSettings.isAccepting ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                }`}>
                  <Printer className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#111827]">Order Intake Status</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      shopSettings.isAccepting ? "bg-emerald-500/20 text-emerald-800" : "bg-amber-500/20 text-amber-800"
                    }`}>
                      {shopSettings.isAccepting ? "Accepting Orders" : "Orders Paused"}
                    </span>
                  </div>
                  <p className="text-xs text-[#111827]/60 mt-0.5">
                    {shopSettings.isAccepting
                      ? "Your store is OPEN. Students can scan your QR code and drop files for instant printing."
                      : "Your store is PAUSED. Students scanning your portal will see a friendly 'temporarily closed' notice."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setShopSettings((s) => ({ ...s, isAccepting: !s.isAccepting }))}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-300 outline-none ${
                    shopSettings.isAccepting ? "bg-emerald-500" : "bg-black/25"
                  }`}
                  aria-label="Toggle store order intake"
                >
                  <motion.div
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                    animate={{ x: shopSettings.isAccepting ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {shopSettings.isAccepting ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-500 stroke-[3]" />
                    )}
                  </motion.div>
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 items-start">
            {/* Print Rate Catalog Card */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-[#111827]">Printing Rates (Per Page)</h3>
                  <p className="text-[11px] text-[#111827]/55">Standard prices applied when calculating student order totals</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/60 border border-white/80 rounded-xl p-3 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider">
                    Black &amp; White
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#111827]">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={shopSettings.bwPrice}
                      onChange={(e) => setShopSettings((s) => ({ ...s, bwPrice: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-transparent text-xl font-bold text-[#111827] outline-none"
                    />
                    <span className="text-xs text-[#111827]/40">/ page</span>
                  </div>
                </div>

                <div className="bg-white/60 border border-white/80 rounded-xl p-3 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider">
                    Full Color
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#111827]">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={shopSettings.colorPrice}
                      onChange={(e) => setShopSettings((s) => ({ ...s, colorPrice: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-transparent text-xl font-bold text-[#111827] outline-none"
                    />
                    <span className="text-xs text-[#111827]/40">/ page</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#111827]/55 leading-relaxed">
                When students upload multi-page documents, the total is computed automatically and collected via direct UPI or cash.
              </p>
            </div>

            {/* Data Retention & Privacy Card */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-[#111827]">File Retention &amp; Privacy</h3>
                    <p className="text-[11px] text-[#111827]/55">Auto-purge window for customer uploaded files</p>
                  </div>
                </div>
                {isPro && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-600" /> Pro Safe
                  </span>
                )}
              </div>

              <div className="relative" ref={retentionDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsRetentionDropdownOpen(!isRetentionDropdownOpen)}
                  className="w-full bg-white/60 border border-white/80 hover:border-black/20 rounded-xl px-3.5 py-2.5 text-xs text-[#111827] flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#111827]/60" />
                    <span className="font-bold">{currentRetentionOption.label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#111827]/50 transition-transform ${isRetentionDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isRetentionDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-white/80 rounded-xl shadow-xl z-50 p-1.5 flex flex-col gap-1"
                    >
                      {RETENTION_OPTIONS.map((opt) => {
                        const isSelected = (shopSettings.retentionHours || (isPro ? 24 : 2)) === opt.value;
                        const isLocked = opt.proOnly && !isPro;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (isLocked) {
                                setRetentionNotice("Extended retention up to 7 days requires Share2Me Pro.");
                                setTimeout(() => setRetentionNotice(null), 4000);
                                setIsRetentionDropdownOpen(false);
                                return;
                              }
                              setShopSettings((s) => ({ ...s, retentionHours: opt.value }));
                              setIsRetentionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                              isSelected
                                ? "bg-[#111827] text-white font-bold"
                                : "hover:bg-black/5 text-[#111827]"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{opt.label}</span>
                                {isLocked && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-800 uppercase">
                                    Pro
                                  </span>
                                )}
                              </div>
                              <p className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#111827]/50"}`}>
                                {opt.desc}
                              </p>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {retentionNotice && (
                <p className="text-[11px] font-semibold text-amber-800 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  {retentionNotice}
                </p>
              )}

              <p className="text-[11px] text-[#111827]/55 leading-relaxed">
                Files older than this duration are automatically purged from cloud storage to protect customer privacy and reclaim storage.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: PAYOUTS & BANKING (Shopkeeper only)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "payouts" && isShopkeeper && (
        <motion.div
          key="payouts"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="grid md:grid-cols-2 gap-4 items-start">
            {/* Direct UPI Settlement Card */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-[#111827]">Direct UPI Settlement</h3>
                    <p className="text-[11px] text-[#111827]/55">100% of customer payments route straight to you</p>
                  </div>
                </div>
                {billing?.upi_id ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    billing.bank_verification_status === "verified"
                      ? "bg-emerald-500/15 text-emerald-800 border border-emerald-500/20"
                      : billing.bank_verification_status === "failed"
                      ? "bg-rose-500/15 text-rose-800 border border-rose-500/20"
                      : "bg-amber-500/15 text-amber-800 border border-amber-500/20"
                  }`}>
                    {billing.bank_verification_status === "verified" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Verified
                      </>
                    ) : billing.bank_verification_status === "failed" ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Verification Failed
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Verification Pending
                      </>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Not Configured
                  </span>
                )}
              </div>

              <div className="bg-white/60 border border-white/80 rounded-xl p-3.5 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-[#111827]/60 uppercase tracking-wider">
                  Settlement UPI Address
                </span>
                {billing?.upi_id ? (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-[#111827] truncate">
                      {billing.upi_id}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(billing.upi_id!);
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      className="p-1.5 rounded-lg hover:bg-black/5 text-[#111827]/60 hover:text-[#111827] transition-colors"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs font-medium text-[#111827]/50 italic">
                      No settlement UPI ID configured yet
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOtpModal(true);
                        setOtpStep("request");
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      + Add UPI ID
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <p className="text-[11px] text-[#111827]/55">
                  Zero platform cut • Instant direct bank settlement
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpModal(true);
                    setOtpStep("request");
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-black/10 hover:bg-black/5 text-xs font-bold text-[#111827] transition-all shadow-sm flex items-center justify-center gap-1.5 self-start sm:self-auto"
                >
                  <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                  {billing?.upi_id ? "Manage Bank Details" : "Set Up UPI Details"}
                </button>
              </div>
            </div>

            {/* Payout Security & Zero Fee Card */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-[#111827]">Settlement Rails &amp; Compliance</h3>
                  <p className="text-[11px] text-[#111827]/55">How your student payments are processed</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-[#111827]/70 leading-relaxed mt-1">
                <div className="flex items-start gap-2 bg-white/40 p-2.5 rounded-xl border border-white/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>Students scan your shop QR code to drop documents and choose B&amp;W or Color.</p>
                </div>
                <div className="flex items-start gap-2 bg-white/40 p-2.5 rounded-xl border border-white/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>UPI intent triggers in their payment app (Google Pay, PhonePe, Paytm). Funds credit immediately to your verified UPI ID.</p>
                </div>
                <div className="flex items-start gap-2 bg-white/40 p-2.5 rounded-xl border border-white/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>Your incoming Print Queue verifies payment instantly via WebSocket without waiting for holding accounts.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: PLAN & PORTAL BRANDING
      ────────────────────────────────────────────────────────────── */}
      {activeTab === "plan" && (
        <motion.div
          key="plan"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="grid md:grid-cols-2 gap-4 items-start">
            {/* Account Type & Subscription Plan */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-[#111827]">Account Type &amp; Tier</h3>
                    <p className="text-[11px] text-[#111827]/55">Sets your maximum file sizes and platform capabilities</p>
                  </div>
                </div>
                {isPro ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Crown className="w-3.5 h-3.5 text-amber-500" /> Pro Active
                  </span>
                ) : (
                  <button
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1 rounded-full transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600" /> Upgrade to Pro
                  </button>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                  Active Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: "PERSONAL", label: "Personal", limit: "50MB" },
                    { value: "EDUCATOR", label: "Educator", limit: "200MB" },
                    { value: "PRINT_SHOP", label: "Print Shop", limit: "500MB" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdatePersona(opt.value)}
                      disabled={isUpdatingPersona}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        persona === opt.value
                          ? "bg-[#111827] text-white border-[#111827] shadow-sm font-bold"
                          : "bg-white/60 hover:bg-white border-white/80 text-[#111827]"
                      }`}
                    >
                      <span className="block text-xs font-bold">{opt.label}</span>
                      <span className={`text-[10px] ${persona === opt.value ? "text-white/70" : "text-[#111827]/50"}`}>
                        {opt.limit} max / file
                      </span>
                    </button>
                  ))}
                </div>
                {personaUpdateStatus && (
                  <p className={`text-xs font-semibold mt-2 ${personaUpdateStatus.ok ? "text-emerald-600" : "text-red-500"}`}>
                    {personaUpdateStatus.msg}
                  </p>
                )}
              </div>

              {/* Live File Receive Quota Meter */}
              <div className="bg-[#111827]/5 border border-[#111827]/10 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111827]">Monthly File Receive Quota</span>
                  {isPro ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full font-mono uppercase">
                      ∞ Unlimited
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full font-mono">
                      {monthlyStats?.remaining ?? Math.max(0, 250 - (monthlyStats?.received || 0))} files left of 250
                    </span>
                  )}
                </div>
                {!isPro && (
                  <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden border border-white/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (monthlyStats?.received || 0) >= 225
                          ? "bg-red-500"
                          : "bg-gradient-to-r from-purple-500 to-indigo-600"
                      }`}
                      style={{
                        width: `${Math.min(100, (((monthlyStats?.received || 0) / 250) * 100))}%`,
                      }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-[#111827]/60">
                  {isPro
                    ? "Your account enjoys zero monthly file receive limits and extended 7-day retention."
                    : `Free accounts can receive up to 250 files per month (resets on the 1st of every month). ${monthlyStats?.received || 0} received so far.`}
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-900 block">Share2Me Pro Member</span>
                  <span className="text-[11px] text-purple-800/80">Permanent share code, unlimited receives, 7-day retention</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-sm"
                >
                  {isPro ? "Extend Plan" : "Upgrade ₹499"}
                </button>
              </div>
            </div>

            {/* Portal QR Appearance with Live Preview */}
            <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-[#111827]">Portal QR Branding</h3>
                    <p className="text-[11px] text-[#111827]/55">Styles the QR code displayed on your shopfront portal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQrFgColor("#1e2329");
                    setQrBgColor("#ffffff");
                    setQrLogoUrl("");
                  }}
                  className="text-[11px] font-bold text-[#111827]/60 hover:text-[#111827] flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              {/* Side-by-side: Live QR Preview + Color Pickers */}
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Live QR Frame */}
                <div
                  className="w-32 h-32 rounded-2xl p-2.5 shadow-md flex items-center justify-center relative overflow-hidden shrink-0 border border-black/10"
                  style={{ backgroundColor: qrBgColor || "#ffffff" }}
                >
                  <QRCode
                    value={`https://share2me.in/g2p/${user.shareCode || "DEMO"}`}
                    size={108}
                    fgColor={qrFgColor || "#1e2329"}
                    bgColor={qrBgColor || "#ffffff"}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                  {qrLogoUrl && /^https?:\/\//.test(qrLogoUrl) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrLogoUrl}
                        alt="Logo"
                        className="w-7 h-7 rounded-full bg-white p-0.5 shadow-sm border border-black/10 object-contain"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  )}
                </div>

                {/* Color and Logo Form */}
                <div className="flex-1 w-full flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                        Foreground
                      </label>
                      <div className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-xl p-1.5">
                        <input
                          type="color"
                          value={qrFgColor}
                          onChange={(e) => setQrFgColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-[11px] font-mono text-[#111827]">{qrFgColor.toUpperCase()}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                        Background
                      </label>
                      <div className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-xl p-1.5">
                        <input
                          type="color"
                          value={qrBgColor}
                          onChange={(e) => setQrBgColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-[11px] font-mono text-[#111827]">{qrBgColor.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#111827]/70 uppercase tracking-wider block mb-1">
                      Center Logo Image URL
                    </label>
                    <input
                      type="text"
                      value={qrLogoUrl}
                      onChange={(e) => setQrLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full bg-white/60 border border-white/80 focus:border-[#111827]/60 rounded-xl px-3 py-1.5 text-xs text-[#111827] outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/5">
                <span className="text-[11px] text-[#111827]/50">
                  {qrSaved ? "✓ Styles saved to browser storage" : "Styles apply instantly to your customer portal"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    saveQrSettings();
                    showToast("Portal QR branding saved!");
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold transition-all shadow-sm"
                >
                  Save QR Style
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          UNIFIED CONTEXTUAL FLOATING SAVE BAR
      ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCurrentTabDirty && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-xl bg-[#111827]/95 backdrop-blur-2xl border border-white/20 text-white rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-[0_20px_50px_rgba(0,0,0,0.35)] flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">
                You have unsaved changes in <strong className="text-white capitalize">{activeTab}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isSavingTab}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={activeTab === "storefront" ? handleSaveStorefront : handleSavePricing}
                disabled={isSavingTab}
                className="px-4 py-1.5 rounded-xl bg-white text-[#111827] text-xs font-bold hover:bg-white/90 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingTab ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                Save Changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          GLOBAL FEEDBACK TOAST
      ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-4 sm:right-6 z-[100] max-w-[92vw] sm:max-w-md px-4 py-2.5 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-bold backdrop-blur-xl ${
              toastMessage.type === "success"
                ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/30"
                : "bg-red-950/90 text-red-200 border-red-500/30"
            }`}
          >
            {toastMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          OTP BANK DETAILS MODAL
      ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showOtpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOtpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl w-full max-w-md border border-black/10 flex flex-col gap-4 text-[#111827]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-base">Update Settlement UPI</h3>
                    <p className="text-xs text-gray-500">2-Factor Authentication required</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOtpModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 text-gray-400 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {otpStep === "request" && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    To protect your store revenue, updating your settlement UPI requires verifying a 6-digit code sent to your registered account email (<strong>{user.email}</strong>).
                  </p>
                  {otpError && <p className="text-xs font-semibold text-red-600">{otpError}</p>}
                  <button
                    onClick={handleRequestOtp}
                    disabled={processingOtp}
                    className="w-full py-2.5 rounded-xl bg-[#111827] text-white text-xs font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    {processingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Send Verification Code
                  </button>
                </div>
              )}

              {otpStep === "verify" && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Enter the 6-digit security code sent to <strong>{user.email}</strong>:
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold py-2.5 rounded-xl border border-gray-300 focus:border-black outline-none"
                  />
                  {otpError && <p className="text-xs font-semibold text-red-600">{otpError}</p>}
                  <button
                    onClick={handleVerifyOtp}
                    disabled={processingOtp || otpValue.length < 6}
                    className="w-full py-2.5 rounded-xl bg-[#111827] text-white text-xs font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Verify &amp; Continue
                  </button>
                </div>
              )}

              {otpStep === "form" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">
                      New Settlement UPI ID
                    </label>
                    <input
                      type="text"
                      value={upiForm.upiId}
                      onChange={(e) => setUpiForm((f) => ({ ...f, upiId: e.target.value }))}
                      placeholder="e.g. yourname@okaxis"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-black text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={upiForm.upiName}
                      onChange={(e) => setUpiForm((f) => ({ ...f, upiName: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-black text-sm outline-none"
                    />
                  </div>
                  {otpError && <p className="text-xs font-semibold text-red-600">{otpError}</p>}
                  <button
                    onClick={handleSubmitUpiDetails}
                    disabled={updatingBank}
                    className="w-full mt-2 py-2.5 rounded-xl bg-[#111827] text-white text-xs font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Update Bank UPI ID
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
