"use client";
import { Shield, Zap, HardDrive, Lock, FileJson, Globe } from "lucide-react";
import { motion } from "framer-motion";

const trustFeatures = [
  {
    title: "AES-256",
    subtitle: "Encryption",
    icon: <Lock className="w-5 h-5 text-primary" />,
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    title: "P2P",
    subtitle: "Direct Transfer",
    icon: <Globe className="w-5 h-5 text-status-success" />,
    bg: "bg-status-success/10",
    border: "border-status-success/20",
  },
  {
    title: "0 KB",
    subtitle: "Stored on Server",
    icon: <HardDrive className="w-5 h-5 text-primary" />,
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    title: "ECDH Key Exchange",
    subtitle: "Keys never leave your device",
    icon: <Shield className="w-5 h-5 text-[#B967FF]" />,
    bg: "bg-[#B967FF]/10",
    border: "border-[#B967FF]/20",
  },
  {
    title: "WebRTC DataChannel",
    subtitle: "Fast, reliable P2P connection",
    icon: <Zap className="w-5 h-5 text-status-warning" />,
    bg: "bg-status-warning/10",
    border: "border-status-warning/20",
  },
  {
    title: "Works Everywhere",
    subtitle: "Any device, any OS, any browser",
    icon: <FileJson className="w-5 h-5 text-status-success" />,
    bg: "bg-status-success/10",
    border: "border-status-success/20",
  },
];

export function TrustSection() {
  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {trustFeatures.map((f, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            key={i}
            className="flex items-center gap-4 p-4 lg:p-5 rounded-2xl bg-background-card border border-border hover:border-border-hover transition-colors"
          >
            <div className={`w-12 h-12 rounded-xl ${f.bg} ${f.border} border flex items-center justify-center flex-shrink-0`}>
              {f.icon}
            </div>
            <div>
              <h4 className="text-[15px] font-semibold text-text-primary leading-tight">{f.title}</h4>
              <p className="text-[13px] text-text-tertiary mt-1">{f.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-12 flex flex-col md:flex-row md:items-center gap-6">
        <div className="text-[13px] text-text-tertiary">
          Trusted by privacy-first individuals and teams worldwide.
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-background-card bg-background-elevated flex items-center justify-center overflow-hidden">
                <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg key={i} className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="text-[13px] text-text-secondary ml-2 font-medium">4.9/5 from 1,200+ users</span>
          </div>
        </div>
      </div>
    </section>
  );
}
