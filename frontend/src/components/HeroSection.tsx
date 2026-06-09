"use client";
import { Lock, Zap, Globe } from "lucide-react";

// const STATS = [
//   { value: "AES-256", label: "Encryption Standard", color: "text-primary" },
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="relative w-full max-w-[1440px] mx-auto px-6 lg:px-8 pt-20 pb-16 overflow-hidden">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">

        {/* Left: Text Content */}
        <div className="w-full lg:w-[45%] flex flex-col items-start z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-primary text-[11px] font-bold tracking-[0.2em] uppercase mb-4"
          >
            SECURE • PRIVATE • FAST
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-hero text-text-primary mb-6"
          >
            Transfer Files.
            <br />
            <span className="text-primary">No Cloud.</span>
            <br />
            No Compromise.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-body text-text-secondary max-w-md leading-relaxed"
          >
            End-to-end encrypted peer-to-peer file transfer.
            Your file goes directly to the recipient — never touches our servers.
          </motion.p>
        </div>

        {/* Right: Interactive Illustration */}
        <div className="hidden sm:flex w-full lg:w-[55%] h-[240px] lg:h-[400px] relative justify-center items-center z-10 mt-8 lg:mt-0">
          <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full" />
          <div className="relative w-full h-full max-w-lg mx-auto flex items-center justify-between px-4 sm:px-12">
            {/* Laptop Mock */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
              className="w-48 h-32 sm:w-64 sm:h-44 bg-[#14181d] rounded-t-2xl border-t border-l border-r border-[#262c36] shadow-2xl flex flex-col relative z-20 overflow-hidden"
            >
              <div className="flex-1 w-full bg-[#0d1116] p-3 sm:p-4 relative overflow-hidden flex flex-col">
                {/* Soft center glow */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-70" />
                
                {/* Skeletal UI Top */}
                <div className="w-1/2 h-2 bg-[#1e2329] rounded-full mb-2 relative z-10" />
                <div className="w-3/4 h-2 bg-[#1a1f26] rounded-full relative z-10" />
                
                {/* Data Cards Bottom */}
                <div className="grid grid-cols-2 gap-3 mt-auto relative z-10">
                  {/* Active Upload Card */}
                  <div className="h-10 bg-[#161a20] rounded-xl border border-[#2a313c] flex items-center px-3 gap-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary" animate={{ width: ["0%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    </div>
                  </div>
                  {/* Pending Card */}
                  <div className="h-10 bg-[#161a20] rounded-xl border border-[#2a313c] flex items-center px-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#455060] shrink-0">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              {/* Laptop Base */}
              <div className="h-3 sm:h-4 bg-[#1c2128] w-full rounded-b-xl border-t border-[#2a313c] relative z-10 flex justify-center">
                <div className="w-16 h-1 bg-[#14181d] rounded-b-md" />
              </div>
            </motion.div>

            {/* Connection Arc */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-32 sm:h-48 z-10 overflow-visible flex justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 150" preserveAspectRatio="none">
                <path 
                  d="M 0 150 Q 160 -10 320 150" 
                  fill="none" 
                  stroke="url(#arcGradient)" 
                  strokeWidth="3"
                />
                <defs>
                  <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fcd535" stopOpacity="0" />
                    <stop offset="50%" stopColor="#fcd535" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Encryption Lock */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="absolute -top-4 w-16 h-16 bg-[#0d1116] border border-primary/30 rounded-full flex items-center justify-center z-30 shadow-[0_0_40px_rgba(252,213,53,0.1)]"
              >
                <div className="absolute inset-0 rounded-full border border-primary/10 animate-pulse-ring" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </motion.div>
            </div>

            {/* Phone Mock */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1, type: "spring", bounce: 0.2 }}
              className="w-24 h-48 sm:w-32 sm:h-64 bg-[#0d1116] rounded-[2rem] border-4 border-[#262c36] shadow-2xl relative z-20 flex flex-col items-center pt-3 px-3 overflow-hidden"
            >
              {/* Notch */}
              <div className="w-12 h-2.5 bg-[#1e2329] rounded-full mb-6 relative z-10" />
              
              <div className="w-full flex flex-col gap-3 relative z-10">
                {/* Active Receiving Oval */}
                <div className="w-full h-12 bg-status-success/10 rounded-[24px] border border-status-success/30 flex items-center px-4 gap-3 relative overflow-hidden">
                  <div className="w-2.5 h-2.5 rounded-full bg-status-success shadow-[0_0_8px_rgba(34,197,94,0.8)] shrink-0" />
                  <div className="w-full h-1.5 bg-status-success/30 rounded-full overflow-hidden">
                     <motion.div className="h-full bg-status-success" animate={{ width: ["0%", "100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  </div>
                </div>
                {/* Empty Oval */}
                <div className="w-full h-12 bg-[#161a20] rounded-[24px] border border-[#2a313c]" />
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}
