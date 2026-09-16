"use client";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Zap,
  Shield,
  Sparkles,
  Crown,
  Check,
  Loader2,
  HardDrive,
  Calendar,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { getBackendUrl } from "@/lib/backendUrl";
import { useSession } from "next-auth/react";
import confetti from "canvas-confetti";

export default function PricingPage() {
  const { data: session, update: updateSession } = useSession();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [proSuccessModal, setProSuccessModal] = useState(false);

  const [planType, setPlanType] = useState<string>(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("share2me_is_pro") === "true"
    ) {
      return "PRO";
    }
    return "FREE";
  });

  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    status: string;
    endsAt: string | null;
    daysRemaining: number;
  }>({
    status: "none",
    endsAt: null,
    daysRemaining: 0,
  });

  const isPro =
    ["PRO", "PREMIUM"].includes(planType.toUpperCase()) ||
    (typeof window !== "undefined" &&
      localStorage.getItem("share2me_is_pro") === "true");

  // Load Vendor Profile & Subscription Status
  useEffect(() => {
    let mounted = true;
    const backendUrl = getBackendUrl();

    fetch("/api/g2p-token", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { token: null }))
      .then((data) => {
        if (!mounted) return;
        if (data.token) {
          setToken(data.token);
          fetch(`${backendUrl}/g2p/vendor/me`, {
            headers: { Authorization: `Bearer ${data.token}` },
            cache: "no-store",
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((profile) => {
              if (!mounted || !profile) return;
              setVendorProfile(profile);
              if (profile.plan_type) {
                setPlanType(profile.plan_type);
                if (typeof window !== "undefined") {
                  if (String(profile.plan_type).toUpperCase() === "PRO") {
                    localStorage.setItem("share2me_is_pro", "true");
                  } else {
                    localStorage.removeItem("share2me_is_pro");
                  }
                }
              }
              if (
                profile.subscription_status ||
                profile.subscription_ends_at
              ) {
                setSubscriptionDetails({
                  status: profile.subscription_status || "none",
                  endsAt: profile.subscription_ends_at || null,
                  daysRemaining: profile.days_remaining || 0,
                });
              }
            })
            .catch((err) => console.error("Failed to load vendor profile:", err))
            .finally(() => {
              if (mounted) setIsLoadingProfile(false);
            });
        } else {
          if (mounted) setIsLoadingProfile(false);
        }
      })
      .catch((err) => {
        console.error("Failed to get g2p token:", err);
        if (mounted) setIsLoadingProfile(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Multi-stage celebration effects
  const triggerCelebration = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100, 50, 200]);
      } catch (e) {}
    }

    try {
      // 1. Center cannon explosion
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#9333ea", "#c084fc", "#10b981", "#fbbf24", "#ffffff"],
        zIndex: 99999,
      });

      // 2. Left side cannon burst
      setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 60,
          origin: { x: 0.1, y: 0.65 },
          colors: ["#9333ea", "#a855f7", "#38bdf8", "#fbbf24"],
          zIndex: 99999,
        });
      }, 250);

      // 3. Right side cannon burst
      setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 60,
          origin: { x: 0.9, y: 0.65 },
          colors: ["#10b981", "#34d399", "#fbbf24", "#ffffff"],
          zIndex: 99999,
        });
      }, 450);

      // 4. Golden luxury star cascade
      setTimeout(() => {
        confetti({
          particleCount: 45,
          spread: 100,
          origin: { y: 0.15 },
          shapes: ["star", "circle"],
          colors: ["#fbbf24", "#f59e0b", "#a855f7", "#ffffff"],
          zIndex: 99999,
        });
      }, 750);
    } catch (e) {
      console.warn("Celebration animation non-critical:", e);
    }
  }, []);

  useEffect(() => {
    if (proSuccessModal) {
      triggerCelebration();
    }
  }, [proSuccessModal, triggerCelebration]);

  // Load Razorpay Standard Checkout SDK
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if (existingScript) {
        if ((window as any).Razorpay) return resolve(true);
        existingScript.addEventListener("load", () => resolve(true));
        existingScript.addEventListener("error", () => resolve(false));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Razorpay Pro Plan Checkout (₹499 for 30 Days)
  const handleUpgradeCheckout = async () => {
    if (!token) {
      alert("Please sign in or launch your G2P Receive Portal first to upgrade.");
      window.location.href = "/g2p";
      return;
    }
    setIsCheckoutLoading(true);
    const backendUrl = getBackendUrl();

    try {
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        alert(
          "Failed to load Razorpay payment gateway. Please check your internet connection.",
        );
        setIsCheckoutLoading(false);
        return;
      }

      // 1. Create order on backend
      const res = await fetch(
        `${backendUrl}/g2p/billing/subscription/create-order`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await res.json();
      if (!res.ok || !data.orderId) {
        alert(
          data.message ||
            data.error ||
            "Could not initialize payment order. Please try again.",
        );
        setIsCheckoutLoading(false);
        return;
      }

      // 2. Launch Razorpay Checkout Modal
      const options = {
        key: data.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "Share2Me",
        description: "Pro Vendor Membership (30 Days)",
        order_id: data.orderId,
        prefill: {
          name: data.vendor?.name || session?.user?.name || "",
          email: data.vendor?.email || session?.user?.email || "",
          contact: data.vendor?.phone || "",
        },
        theme: {
          color: "#9333ea",
        },
        modal: {
          ondismiss: () => {
            setIsCheckoutLoading(false);
          },
        },
        handler: async (response: any) => {
          setIsCheckoutLoading(true);
          try {
            // 3. Cryptographically verify signature on backend
            const verifyRes = await fetch(
              `${backendUrl}/g2p/billing/subscription/verify-payment`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              },
            );

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setPlanType("PRO");
              if (typeof window !== "undefined") {
                localStorage.setItem("share2me_is_pro", "true");
              }
              try {
                await updateSession?.({ planType: "PRO" });
              } catch (e) {}
              setSubscriptionDetails({
                status: "active",
                endsAt: verifyData.subscription_ends_at,
                daysRemaining: verifyData.days_remaining || 30,
              });
              setProSuccessModal(true);
              triggerCelebration();
              setTimeout(() => {
                window.location.href = "/g2p";
              }, 4500);
            } else {
              alert(
                verifyData.message ||
                  "Payment verification failed. Please contact support if payment was debited.",
              );
            }
          } catch (err: any) {
            console.error("Verification error:", err);
            alert(
              "Error verifying payment signature. Please check your dashboard in a moment.",
            );
          } finally {
            setIsCheckoutLoading(false);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        alert(
          `Payment failed: ${response.error?.description || "Transaction declined"}`,
        );
        setIsCheckoutLoading(false);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred. Please try again.");
      setIsCheckoutLoading(false);
    }
  };

  const faqs = [
    {
      q: "How does the 30-day free trial work?",
      a: "When you create a G2P Receive Portal, you get full access to receive files and clipboard text completely free for 30 days. No credit card is required to start the trial.",
    },
    {
      q: "What happens after the 30 days are up?",
      a: "To keep your permanent inbox, custom Share Code, and zero-ad privileges active, you upgrade to a Pro subscription (₹499/month). If you choose not to subscribe, your portal will be temporarily paused, but your account remains safe.",
    },
    {
      q: "Can I extend or renew my Pro plan anytime?",
      a: "Yes! You can extend your Pro plan by 30 days at any point directly from this pricing page or inside your G2P Inbox dashboard via Razorpay.",
    },
    {
      q: "What are the storage and file size limits on Pro?",
      a: "Pro plan members enjoy 10 GB cloud storage, configurable file retention up to 7 days, 100% ad-free file downloads for customers, and automated print job queue sync.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between font-sans selection:bg-primary/20">
      <div>
        <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
          {/* Back Button */}
          <div className="mb-6">
            <Link
              href="/g2p"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container border border-outline hover:bg-surface-container-high text-xs font-bold text-on-surface transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-primary" />
              <span>Back to G2P Portal</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary text-xs font-bold text-primary uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              {isPro ? "Pro Member Active" : "30-Day Free Trial Available"}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight font-display uppercase">
              Get Your Permanent <span className="text-primary">G2P Inbox</span>
            </h1>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto font-body">
              Receive large files and clipboard text from anyone directly into your personal dashboard. 100% ad-free with priority bandwidth for ₹499/30 days.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Free Trial Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-surface-card border ${
                !isPro
                  ? "border-outline-variant shadow-md"
                  : "border-outline-variant/60 opacity-85"
              } rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden`}
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface font-display uppercase">
                      30-Day Trial
                    </h3>
                    <p className="text-xs text-text-secondary mt-1 font-body">
                      Try G2P risk-free
                    </p>
                  </div>
                  {!isPro && (
                    <span className="px-3 py-1 rounded-lg bg-surface-container border border-outline-variant text-[10px] font-bold text-on-surface uppercase font-mono tracking-wider">
                      Active Plan
                    </span>
                  )}
                  {isPro && (
                    <span className="px-3 py-1 rounded-lg bg-surface-container/60 border border-outline-variant/60 text-[10px] font-bold text-text-secondary uppercase font-mono tracking-wider">
                      Trial Completed
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-on-surface">
                    ₹0
                  </span>
                  <span className="text-sm text-text-secondary font-mono">
                    / 30-day trial
                  </span>
                </div>

                <ul className="space-y-4">
                  {[
                    "Create your unique Share Code",
                    "Receive files up to 2 GB",
                    "Customized display name profile",
                    "Full dashboard inbox access",
                    "No credit card required",
                  ].map((feat, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 text-sm text-text-secondary font-body"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/g2p"
                  className="w-full h-12 bg-surface-container text-on-surface border border-outline hover:bg-surface-container-high font-bold rounded-2xl flex items-center justify-center transition-all text-sm"
                >
                  {isPro ? "Open G2P Dashboard" : "Start Using G2P"}
                </Link>
              </div>
            </motion.div>

            {/* Pro Subscription Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`bg-surface-card border ${
                isPro
                  ? "border-emerald-400/80 shadow-[0_10px_40px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50"
                  : "border-primary/60 shadow-[0_10px_40px_rgba(147,51,234,0.15)]"
              } rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden`}
            >
              {/* Highlight Tag */}
              <div
                className={`absolute top-0 right-0 ${
                  isPro ? "bg-emerald-500 text-white" : "bg-primary text-on-primary"
                } text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl border-l border-b border-outline-variant flex items-center gap-1`}
              >
                {isPro ? (
                  <>
                    <Check className="w-3 h-3" /> ACTIVE PLAN
                  </>
                ) : (
                  "PRO PASS"
                )}
              </div>

              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-on-surface font-display uppercase">
                        Pro Plan
                      </h3>
                      {isPro && (
                        <Crown className="w-4 h-4 text-amber-400 drop-shadow-sm" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 font-body">
                      Keep your portal permanently alive &amp; ad-free
                    </p>
                  </div>
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-extrabold text-on-surface">
                    ₹499
                  </span>
                  <span className="text-sm text-text-secondary font-mono">
                    / 30 days
                  </span>
                </div>

                {isPro && (
                  <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {subscriptionDetails.daysRemaining > 0
                        ? `${subscriptionDetails.daysRemaining} days remaining`
                        : "Subscription Active"}
                    </span>
                    {subscriptionDetails.endsAt && (
                      <span className="text-text-secondary font-normal">
                        (until{" "}
                        {new Date(
                          subscriptionDetails.endsAt,
                        ).toLocaleDateString()}
                        )
                      </span>
                    )}
                  </div>
                )}

                <ul className="space-y-4 mt-4">
                  {[
                    "100% Ad-Free (Zero redirects & popunders)",
                    "10 GB Cloud Storage upgrade",
                    "Up to 7-Day File Retention (configurable)",
                    "Permanent 6-char Share Code active forever",
                    "Customized QR codes & shop branding",
                    "Full Local Print Agent integration",
                    "Priority high-speed upload lanes",
                  ].map((feat, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 text-sm text-on-surface font-body"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 space-y-2">
                <button
                  onClick={handleUpgradeCheckout}
                  disabled={isCheckoutLoading}
                  className={`w-full h-12 ${
                    isPro
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                      : "bg-primary text-on-primary hover:bg-[#ffe170]"
                  } border border-transparent font-bold rounded-2xl flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50 shadow-md cursor-pointer`}
                >
                  {isCheckoutLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Initializing
                      Razorpay...
                    </>
                  ) : isPro ? (
                    <>
                      <Zap className="w-4 h-4 fill-current text-amber-300" /> Extend
                      Plan (+30 Days for ₹499)
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current text-on-primary" /> Upgrade
                      with Razorpay — ₹499
                    </>
                  )}
                </button>

                {isPro && (
                  <Link
                    href="/g2p"
                    className="w-full h-10 bg-surface-container text-on-surface border border-outline hover:bg-surface-container-high font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs"
                  >
                    <span>Go to G2P Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </motion.div>
          </div>

          {/* Security Banner */}
          <div className="max-w-4xl mx-auto mt-12 bg-surface-container-low border border-outline-variant rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-sm font-bold text-on-surface font-display">
                Secure Cryptographic Billing
              </h4>
              <p className="text-xs text-text-secondary mt-0.5 font-body">
                All transactions are 256-bit SSL encrypted and processed securely via Razorpay. Your Pro perks, 10 GB storage, and zero-ad privileges unlock instantly upon payment.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto mt-16 space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface text-center font-display uppercase">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low transition-all"
                >
                  <button
                    onClick={() =>
                      setActiveFaq(activeFaq === index ? null : index)
                    }
                    className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-on-surface hover:text-primary transition-colors"
                  >
                    <span className="font-display">{faq.q}</span>
                    <HelpCircle
                      className={`w-4 h-4 text-primary transition-transform duration-200 ${
                        activeFaq === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {activeFaq === index && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-text-secondary border-t border-outline-variant bg-surface-container-lowest leading-relaxed font-body">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* --- PRO SUCCESS CELEBRATION MODAL --- */}
      <AnimatePresence>
        {proSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 25 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#1c1936] via-[#121124] to-[#0a0a14] border border-purple-500/40 p-6 sm:p-8 text-center shadow-[0_20px_70px_rgba(168,85,247,0.4)] overflow-hidden"
            >
              {/* Background ambient lighting */}
              <div className="absolute -top-20 -left-20 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Icon Badge with animated celebration rings */}
              <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: [1, 1.8, 2.2], opacity: [0.9, 0.4, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-purple-400/50 pointer-events-none"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: [1, 1.8, 2.2], opacity: [0.9, 0.4, 0] }}
                  transition={{ duration: 2.2, delay: 0.7, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-emerald-400/50 pointer-events-none"
                />

                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-emerald-400 blur-xl opacity-80 animate-pulse" />
                <motion.div
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200 }}
                  className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#9333ea] to-[#4f46e5] flex items-center justify-center shadow-2xl border border-white/40"
                >
                  <Crown className="w-10 h-10 text-amber-300 drop-shadow-[0_4px_16px_rgba(252,211,77,0.6)] animate-bounce" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", damping: 10, stiffness: 300 }}
                  className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1.5 shadow-lg border-2 border-[#1c1936]"
                >
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </motion.div>
              </div>

              {/* Title & Badge */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-3 tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Payment Verified &amp; Active
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                Welcome to Share2Me PRO!
              </h3>
              <p className="text-xs sm:text-sm text-white/75 mb-6 max-w-sm mx-auto leading-relaxed">
                Your 30-day Pro Vendor membership is now active. All premium perks and ad-free privileges are unlocked.
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-6 text-left">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      100% Ad-Free
                    </div>
                    <div className="text-[11px] text-white/60">
                      Zero redirects &amp; popunders
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-start gap-2.5">
                  <HardDrive className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      10 GB Cloud Storage
                    </div>
                    <div className="text-[11px] text-white/60">
                      10x storage upgrade
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-start gap-2.5">
                  <Calendar className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      7-Day Retention
                    </div>
                    <div className="text-[11px] text-white/60">
                      Configurable file retention
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      Permanent Code
                    </div>
                    <div className="text-[11px] text-white/60">
                      Dedicated shop branding
                    </div>
                  </div>
                </div>
              </div>

              {/* Animated Progress Bar counting down to reload */}
              <div className="w-full bg-white/10 rounded-full h-1.5 mb-3 overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4.5, ease: "linear" }}
                  className="h-full bg-gradient-to-r from-purple-500 via-emerald-400 to-amber-400 rounded-full"
                />
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  window.location.href = "/g2p";
                }}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-[0_10px_30px_rgba(147,51,234,0.4)] flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Launch Pro Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="text-[11px] text-white/40 mt-3 font-mono">
                Redirecting to G2P Dashboard in a few seconds...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
