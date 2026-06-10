"use client";
import { motion } from "framer-motion";

// const STATS = [
//   { value: "AES-256", label: "Encryption Standard", color: "text-primary" },

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

        {/* Right: Looping Video Animation */}
        <div className="hidden sm:flex w-full lg:w-[55%] relative justify-center items-center z-10 mt-8 lg:mt-0 pointer-events-none">
          <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full mix-blend-screen" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
            className="relative w-full max-w-2xl mx-auto flex justify-center items-center mix-blend-screen"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto object-contain mix-blend-screen contrast-125 translate-x-[6%]"
              style={{
                maskImage: "linear-gradient(to left, transparent 0%, transparent 12%, black 25%), linear-gradient(to right, transparent 0%, black 10%), linear-gradient(to bottom, transparent 0%, black 10%), linear-gradient(to top, transparent 0%, black 10%)",
                WebkitMaskImage: "linear-gradient(to left, transparent 0%, transparent 12%, black 25%), linear-gradient(to right, transparent 0%, black 10%), linear-gradient(to bottom, transparent 0%, black 10%), linear-gradient(to top, transparent 0%, black 10%)",
                WebkitMaskComposite: "source-in",
                maskComposite: "intersect"
              }}
              src="/animations/Create_a_seamless_perfectly_l.mp4"
            >
              Your browser does not support the video tag.
            </video>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
