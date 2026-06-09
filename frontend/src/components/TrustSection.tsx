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
    </section>
  );
}
