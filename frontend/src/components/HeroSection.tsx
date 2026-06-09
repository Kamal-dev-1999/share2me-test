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
        <div className="w-full lg:w-[55%] h-[400px] relative flex justify-center items-center z-10">
          <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full" />

          <div className="relative w-full h-full max-w-lg mx-auto flex items-center justify-between px-4 sm:px-12">

            {/* Laptop Mock */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, type: "spring" }}
              className="w-32 h-24 sm:w-48 sm:h-32 bg-background-elevated rounded-xl border border-border shadow-2xl flex flex-col justify-end p-2 sm:p-3 relative z-20"
            >
              <div className="w-full h-full bg-background-card rounded mb-2 border border-border/50 flex items-center justify-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-primary/20 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
              </div>
              <div className="w-full h-1 sm:h-1.5 bg-border rounded-full" />
            </motion.div>

            {/* Connection Arc & Particles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[280px] h-32 sm:h-48 border-t-2 border-dashed border-primary/30 rounded-t-[100%] z-10 overflow-visible flex justify-center">

              {/* Encryption Lock */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="absolute -top-6 w-12 h-12 bg-background-card border border-primary/40 shadow-glow rounded-xl flex items-center justify-center z-30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </motion.div>

              {/* Moving File Particles */}
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-8 h-10 sm:w-10 sm:h-12 bg-background-card border border-border rounded shadow-lg flex items-center justify-center"
                  style={{ top: "30%", left: "10%" }}
                  animate={{
                    left: ["10%", "50%", "90%"],
                    top: ["30%", "-10%", "30%"],
                    opacity: [0, 1, 0],
                    rotate: [0, 15, -15]
                  }}
                  transition={{
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    delay: i * 1,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </motion.div>
              ))}
            </div>

            {/* Phone Mock */}
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
              className="w-16 h-32 sm:w-24 sm:h-48 bg-background-elevated rounded-2xl border-2 border-border shadow-2xl p-1 sm:p-2 relative z-20"
            >
              <div className="w-full h-full bg-background-card rounded-xl border border-border/50 flex flex-col">
                <div className="w-full h-3 flex justify-center pt-1">
                  <div className="w-6 h-1 bg-border rounded-full" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-status-success/30 bg-status-success/10 flex items-center justify-center">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-status-success animate-pulse-ring" />
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
}
