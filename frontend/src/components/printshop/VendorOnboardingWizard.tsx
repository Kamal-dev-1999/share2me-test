"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Store, MapPin, Printer, ShieldCheck, CheckCircle2,
  Download, Loader2, Sparkles, Building2, Phone, ArrowLeft
} from "lucide-react";
import confetti from "canvas-confetti";
import { getBackendUrl } from "@/lib/backendUrl";
import { AnimatedCopyIcon } from "@/components/ui/AnimatedCopyIcon";

interface UserProfile {
  username: string;
  phone?: string;
  company?: string;
  print_agent_token?: string;
}

export function VendorOnboardingWizard({
  user,
  token,
  onComplete
}: {
  user: UserProfile;
  token: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [displayName, setDisplayName] = useState(user.username || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [company, setCompany] = useState(user.company || "");
  
  const [bwPrice, setBwPrice] = useState("2.00");
  const [colorPrice, setColorPrice] = useState("5.00");

  const [isAgentOnline, setIsAgentOnline] = useState(false);
  const [isCheckingAgent, setIsCheckingAgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [agentToken] = useState(user.print_agent_token || "LOADING_TOKEN...");

  // Poll for agent status in Step 3
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 3 && !isAgentOnline) {
      
      // Auto-configure local agent if running
      const autoConfigureAgent = async () => {
        try {
          await fetch('http://127.0.0.1:13337/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              token: agentToken, 
              serverUrl: getBackendUrl() 
            })
          });
        } catch (err) {
          // Agent not running locally yet, ignore
        }
      };
      
      // Trigger once on step load
      autoConfigureAgent();

      interval = setInterval(async () => {
        setIsCheckingAgent(true);
        // Also keep trying to auto-configure in case they start it while waiting
        autoConfigureAgent();
        
        try {
          const res = await fetch(`${getBackendUrl()}/g2p/vendor/agent-status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.isOnline || data.online) {
              setIsAgentOnline(true);
            }
          }
        } catch (e) {
          // ignore
        } finally {
          setIsCheckingAgent(false);
        }
      }, 3000); // Check every 3 seconds
    }
    return () => clearInterval(interval);
  }, [step, isAgentOnline, token, agentToken]);

  const handleNext = async () => {
    if (step === 1) {
      if (!displayName.trim() || !phone.trim() || !company.trim()) {
        alert("Please fill in all store profile details.");
        return;
      }
      setIsLoading(true);
      await fetch(`${getBackendUrl()}/g2p/vendor/profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName, phone, company, website: "", bio: "" })
      });
      setIsLoading(false);
      setStep(2);
    } else if (step === 2) {
      // In a full implementation we'd save pricing here
      setStep(3);
    } else if (step === 3) {
      // Step 3 Next is only active if agent is online
      if (!isAgentOnline) return;
      setStep(4);
      triggerSuccess();
    } else if (step === 4) {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    setIsLoading(true);
    await fetch(`${getBackendUrl()}/g2p/vendor/complete-setup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    setIsLoading(false);
    onComplete();
  };

  const triggerSuccess = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#9333ea", "#10b981", "#fbbf24"]
    });
  };

  const forceSkipAgent = () => {
    setIsAgentOnline(true);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-[#111827]/40 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto min-h-screen py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-2xl border border-white/50 rounded-[32px] w-full max-w-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col relative my-auto shrink-0 max-h-full overflow-hidden"
      >
        {/* Header / Stepper */}
        <div className="bg-[#111827] text-white p-6 sm:p-8 relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Store className="w-48 h-48 -mr-12 -mt-12" />
          </div>
          
          <div className="relative z-10 flex flex-col gap-6">
            <div>
              <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 inline-block">
                Vendor Onboarding • Step {step} of {totalSteps}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
                {step === 1 && "Storefront Profile"}
                {step === 2 && "Configure Pricing"}
                {step === 3 && "Print Agent Setup"}
                {step === 4 && "You're All Set!"}
              </h1>
              <p className="text-white/70 text-sm mt-2 max-w-md">
                {step === 1 && "Let's set up how students and customers will see your business on the Share2Me network."}
                {step === 2 && "Set your base rates for automatic cost calculation on print jobs."}
                {step === 3 && "The Share2Me Agent connects your physical printers to the cloud. This step is critical."}
                {step === 4 && "Your storefront is live. Your agent is connected. You are ready to accept orders."}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 w-full max-w-sm">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="h-1.5 flex-1 rounded-full bg-white/20 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: step >= s ? "100%" : "0%" }}
                    className="h-full bg-emerald-400"
                    transition={{ duration: 0.4 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 bg-white/40 flex-1 relative min-h-[360px] overflow-y-auto">
          <AnimatePresence mode="wait">
            
            {/* STEP 1 */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-5"
              >
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Shop / Business Name *</label>
                  <div className="relative">
                    <Building2 className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="e.g. Campus Xerox Hub"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-[#111827] focus:ring-1 focus:ring-[#111827] outline-none text-gray-800 transition-all font-medium"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Contact Phone *</label>
                  <div className="relative">
                    <Phone className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-[#111827] focus:ring-1 focus:ring-[#111827] outline-none text-gray-800 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Organization / Institution *</label>
                  <div className="relative">
                    <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="e.g. Share2Me Hub"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-[#111827] focus:ring-1 focus:ring-[#111827] outline-none text-gray-800 transition-all font-medium"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                  <Printer className="w-5 h-5 shrink-0" />
                  <p>When customers send files, Share2Me automatically counts the pages and calculates the cost based on your rates below.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 mb-2">
                      <span className="font-bold font-serif">B&W</span>
                    </div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Price per page (₹)</label>
                    <input 
                      type="number" 
                      value={bwPrice}
                      onChange={e => setBwPrice(e.target.value)}
                      step="0.5"
                      className="w-full text-2xl font-bold border-b-2 border-gray-200 focus:border-[#111827] outline-none text-gray-900 pb-1 bg-transparent transition-colors"
                    />
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="relative z-10 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white mb-2">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block relative z-10">Color Price (₹)</label>
                    <input 
                      type="number" 
                      value={colorPrice}
                      onChange={e => setColorPrice(e.target.value)}
                      step="1.0"
                      className="relative z-10 w-full text-2xl font-bold border-b-2 border-gray-200 focus:border-[#111827] outline-none text-gray-900 pb-1 bg-transparent transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white shrink-0">
                      <Download className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">1. Download the Agent</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Download and run the Share2Me Print Agent on the computer connected to your printers.</p>
                    </div>
                  </div>
                  <a 
                    href="/Share2Me-PrintAgent.exe"
                    download
                    className="shrink-0 flex items-center justify-center gap-2 bg-[#111827] hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4" /> 
                    Download .exe
                  </a>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">2. Copy your unique token</h3>
                    <AnimatedCopyIcon
                      text={agentToken}
                      className="text-gray-400 hover:text-black transition-colors"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Paste this token into the Print Agent when asked.</p>
                  <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm text-gray-800 break-all border border-gray-200 text-center select-all cursor-text">
                    {agentToken}
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border flex items-center justify-between transition-colors ${
                  isAgentOnline 
                    ? "bg-emerald-50 border-emerald-200" 
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className="flex items-center gap-3">
                    {isAgentOnline ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                    ) : (
                      <Loader2 className="w-6 h-6 text-amber-500 animate-spin shrink-0" />
                    )}
                    <div>
                      <h3 className={`font-bold ${isAgentOnline ? "text-emerald-800" : "text-amber-800"}`}>
                        {isAgentOnline ? "Agent Connected Successfully!" : "Waiting for connection..."}
                      </h3>
                      <p className={`text-xs ${isAgentOnline ? "text-emerald-600" : "text-amber-700"} mt-0.5`}>
                        {isAgentOnline 
                          ? "Your printers are now linked to the cloud." 
                          : "Leave this screen open while you set up the agent."}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Fallback button in case of issues */}
                {!isAgentOnline && (
                  <button onClick={forceSkipAgent} className="text-xs text-gray-400 hover:text-gray-600 underline text-center mt-2">
                    Force Skip (Debug / Support Only)
                  </button>
                )}
              </motion.div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center gap-4 text-center py-8"
              >
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2 shadow-inner">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold font-display text-gray-900">Ready for Business!</h2>
                <p className="text-gray-500 text-sm max-w-[280px]">
                  Your Share2Me vendor dashboard is now fully unlocked and your print agent is online.
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-gray-100 p-4 sm:p-6 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            className={`px-4 py-2 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors ${step === 1 || step === 4 ? "invisible" : ""}`}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          <button
            onClick={handleNext}
            disabled={isLoading || (step === 3 && !isAgentOnline)}
            className="px-6 py-2.5 bg-[#111827] hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg shadow-black/10 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === 4 ? "Enter Dashboard" : "Continue"}
            {step !== 4 && !isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
