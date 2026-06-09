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
              initial={{ x: -40, opacity: 0, rotateY: 15 }}
              animate={{ x: 0, opacity: 1, rotateY: 0 }}
              transition={{ duration: 1, type: "spring", bounce: 0.4 }}
              style={{ perspective: 1000 }}
              className="w-40 h-28 sm:w-56 sm:h-36 bg-[#1a1f26] rounded-t-xl border-t border-l border-r border-[#2d3540] shadow-2xl flex flex-col justify-between relative z-20 overflow-hidden"
            >
              <div className="flex-1 w-full bg-[#0d1116] p-2 sm:p-3 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary/20 blur-[24px] rounded-full" />
                <div className="w-1/2 h-1.5 bg-border rounded-full mb-2 opacity-50 relative z-10" />
                <div className="w-3/4 h-1.5 bg-border rounded-full mb-3 opacity-30 relative z-10" />
                
                <div className="grid grid-cols-2 gap-2 mt-auto relative z-10">
                  <div className="h-8 bg-background-elevated rounded border border-border/50 flex items-center px-2 overflow-hidden relative">
                    <motion.div className="absolute inset-0 bg-primary/10" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/70 shrink-0">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <div className="w-full h-1 bg-primary/20 ml-2 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary" animate={{ width: ["0%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    </div>
                  </div>
                  <div className="h-8 bg-background-elevated rounded border border-border/50 flex items-center px-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="h-2 sm:h-3 bg-[#242b35] w-[110%] -ml-[5%] rounded-b-xl border border-[#333d4a] relative z-10 flex justify-center">
                <div className="w-1/4 h-1 bg-[#1a1f26] rounded-b-md" />
              </div>
            </motion.div>

            {/* Connection Arc & Particles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-[320px] h-32 sm:h-48 z-10 overflow-visible flex justify-center">
              
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 150" preserveAspectRatio="none">
                <path d="M 0 150 Q 160 -50 320 150" fill="none" stroke="currentColor" className="text-primary/15" strokeWidth="2" strokeDasharray="6 6" />
                <motion.path 
                  d="M 0 150 Q 160 -50 320 150" 
                  fill="none" 
                  stroke="url(#glowGradient)" 
                  strokeWidth="3"
                  initial={{ strokeDasharray: "0 1000", strokeDashoffset: 0 }}
                  animate={{ strokeDasharray: ["0 1000", "200 1000", "0 1000"], strokeDashoffset: [0, -100, -320] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <defs>
                  <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fcd535" stopOpacity="0" />
                    <stop offset="50%" stopColor="#fcd535" stopOpacity="1" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Encryption Lock */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="absolute -top-6 w-14 h-14 bg-[#0d1116] border border-primary/40 shadow-[0_0_30px_rgba(252,213,53,0.15)] rounded-2xl flex items-center justify-center z-30"
              >
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </motion.div>
              </motion.div>
            </div>

            {/* Phone Mock */}
            <motion.div
              initial={{ x: 40, opacity: 0, rotateY: -15 }}
              animate={{ x: 0, opacity: 1, rotateY: 0 }}
              transition={{ duration: 1, delay: 0.2, type: "spring", bounce: 0.4 }}
              style={{ perspective: 1000 }}
              className="w-20 h-40 sm:w-28 sm:h-56 bg-[#1a1f26] rounded-[2rem] border-4 border-[#2d3540] shadow-2xl relative z-20 flex flex-col items-center pt-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-[#0d1116] rounded-[1.75rem]" />
              <div className="w-1/3 h-2 bg-background rounded-full mb-4 relative z-10 mt-1" />
              
              <div className="w-full px-2 sm:px-3 flex flex-col gap-2 relative z-10 mt-2">
                <div className="w-full h-8 sm:h-10 bg-background-elevated rounded-xl border border-status-success/30 flex items-center px-2 gap-2 relative overflow-hidden">
                  <motion.div className="absolute inset-0 bg-status-success/10" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                  <div className="w-4 h-4 rounded-full bg-status-success/20 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 bg-status-success rounded-full animate-pulse-ring" />
                  </div>
                  <div className="w-full h-1 bg-status-success/30 rounded-full overflow-hidden">
                     <motion.div className="h-full bg-status-success" animate={{ width: ["0%", "100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  </div>
                </div>
                <div className="w-full h-8 sm:h-10 bg-background-elevated rounded-xl border border-border/50 opacity-50" />
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
}
