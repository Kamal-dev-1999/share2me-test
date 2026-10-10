import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Download, ExternalLink, Settings, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { getBackendUrl } from "@/lib/backendUrl";

export function AgentSetupModal({
  user,
  token,
  onClose,
}: {
  user: any;
  token: string;
  onClose: () => void;
}) {
  const [agentToken, setAgentToken] = useState(user.print_agent_token || "LOADING_TOKEN...");
  const [isCopied, setIsCopied] = useState(false);
  const [isAgentOnline, setIsAgentOnline] = useState(false);
  const [isCheckingAgent, setIsCheckingAgent] = useState(false);

  useEffect(() => {
    if (user.print_agent_token) {
      setAgentToken(user.print_agent_token);
    }
  }, [user.print_agent_token]);

  // Poll for agent status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isAgentOnline) {
      let autoConfigSuccess = false;

      // Auto-configure local agent if running
      const autoConfigureAgent = async () => {
        if (autoConfigSuccess) return;
        try {
          const res = await fetch("http://127.0.0.1:13337/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: agentToken,
              serverUrl: getBackendUrl(),
            }),
          });
          if (res.ok) {
            autoConfigSuccess = true;
          }
        } catch (err) {
          // Agent not running locally yet, ignore
        }
      };

      autoConfigureAgent();

      interval = setInterval(async () => {
        setIsCheckingAgent(true);
        if (!autoConfigSuccess) {
          autoConfigureAgent();
        }

        try {
          const res = await fetch(`${getBackendUrl()}/g2p/vendor/agent-status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.isOnline || data.online) {
              setIsAgentOnline(true);
              clearInterval(interval);
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#FF8A00", "#FF2E93", "#00E054"],
              });
            }
          }
        } catch (e) {
          // ignore
        } finally {
          setIsCheckingAgent(false);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAgentOnline, token, agentToken]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[32px] w-full max-w-lg shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden"
      >
        {/* Decorative corner shape similar to reference */}
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-gradient-to-br from-[#FF8A00]/20 to-[#FF2E93]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-gradient-to-br from-[#00E054]/20 to-[#00E054]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF8A00] to-[#FF2E93] p-[2px]">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#FF2E93]" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Agent Setup</h2>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">
                Connect your printers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 relative z-10 flex flex-col gap-6 mt-4">
          
          {/* Step 1: Download */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900">1. Download Print Agent</h3>
              <a
                href={`${getBackendUrl()}/download/Share2Me-PrintAgent.exe`}
                download
                className="flex items-center gap-2 bg-gradient-to-r from-[#FF8A00] to-[#FF2E93] text-white px-4 py-2 rounded-full text-xs font-bold hover:shadow-lg hover:shadow-[#FF2E93]/30 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                Download .exe
              </a>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Run this application on the Windows computer connected to your physical printers.
            </p>
          </div>

          {/* Step 2: Token */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900">2. Authentication Token</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(agentToken);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  isCopied
                    ? "bg-[#00E054]/10 text-[#00E054]"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : "Copy"}
                {isCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              The agent will auto-configure if running, or paste this if prompted:
            </p>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 font-mono text-xs text-gray-800 text-center select-all cursor-text break-all">
              {agentToken}
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center mt-2">
            {isAgentOnline ? (
              <div className="flex items-center gap-2 bg-[#00E054]/10 border border-[#00E054]/20 text-[#00E054] px-5 py-2.5 rounded-full font-bold text-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E054] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00E054]"></span>
                </span>
                Agent Connected!
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 px-5 py-2.5 rounded-full font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for agent...
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
