"use client";
import { TopNav } from "@/components/TopNav";
import { TrustSection } from "@/components/TrustSection";
import Link from "next/link";
import { Star, Shield, Cpu, Code2, Heart, Rocket } from "lucide-react";
import { motion } from "framer-motion";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />
      
      <TopNav />
      
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-16 relative z-10">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-24 max-w-4xl mx-auto pt-16 relative"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_20px_rgba(255,204,0,0.15)] mb-8"
          >
            <Star className="w-4 h-4 text-primary" />
            <span className="text-[14px] font-bold text-primary tracking-wide">SHARE2ME VERSION 2.7</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-display font-extrabold text-text-primary mb-8 leading-[1.15] tracking-tight">
            Redefining Secure <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#ffaa00] to-[#B967FF]">
              Peer-to-Peer Transfers
            </span>
          </h1>
          <p className="text-[18px] md:text-[20px] text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Share2Me was built to eliminate the middleman in file sharing. No servers storing your data, no artificial upload limits, just direct, end-to-end encrypted connections right between browsers.
          </p>
        </motion.div>

        {/* Latest Features Highlights */}
        <section className="mb-32">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-4 mb-10"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-background-elevated to-background-card border border-border flex items-center justify-center shadow-soft">
              <Rocket className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-text-primary">The 2.7 Evolution</h2>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              whileHover={{ y: -8 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-background-card/50 backdrop-blur-xl rounded-[32px] border border-border p-8 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group shadow-lg"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-[0_0_15px_rgba(255,204,0,0.15)]">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Enterprise-Grade TURN</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed">
                Version 2.7 introduces Metered TURN credentials passing through port 443 with TLS, effortlessly bypassing corporate firewalls and deep-packet inspection.
              </p>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -8 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-background-card/50 backdrop-blur-xl rounded-[32px] border border-border p-8 hover:border-[#B967FF]/50 hover:bg-[#B967FF]/5 transition-all duration-300 group shadow-lg relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#B967FF]/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-[0_0_15px_rgba(185,103,255,0.15)]">
                <Cpu className="w-7 h-7 text-[#B967FF]" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Next.js 15 Migration</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed">
                Completely refactored to utilize the latest Next.js 15 runtime, dramatically improving edge-caching and patching critical upstream CVE vulnerabilities.
              </p>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -8 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-background-card/50 backdrop-blur-xl rounded-[32px] border border-border p-8 hover:border-status-success/50 hover:bg-status-success/5 transition-all duration-300 group shadow-lg"
            >
              <div className="w-14 h-14 rounded-2xl bg-status-success/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <Code2 className="w-7 h-7 text-status-success" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Smart Error Handling</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed">
                New responsive error toasts and human-readable feedback. Disconnects, invalid pins, and WebRTC failures are now beautifully presented without the technical jargon.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Features Grid (Trust Section) */}
        <section className="mb-32">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-4 mb-10"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-background-elevated to-background-card border border-border flex items-center justify-center shadow-soft">
              <Shield className="w-6 h-6 text-text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-text-primary">System Architecture</h2>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-background-elevated/80 backdrop-blur-md rounded-[40px] border border-border p-4 sm:p-8 shadow-2xl relative"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-[40px] pointer-events-none" />
            <TrustSection />
          </motion.div>
        </section>

        {/* Developer Section */}
        <section className="mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-background-card to-background-elevated rounded-[40px] border border-border overflow-hidden relative shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 opacity-70" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#B967FF]/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 opacity-70" />
            
            <div className="p-10 md:p-16 flex flex-col md:flex-row gap-12 items-center relative z-10">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: -2 }}
                className="w-40 h-40 md:w-48 md:h-48 rounded-[40px] bg-gradient-to-br from-background-elevated to-background border border-border flex items-center justify-center shrink-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative group cursor-default"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[40px]" />
                <span className="text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 group-hover:from-primary group-hover:to-white transition-all duration-500">K</span>
              </motion.div>
              
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background/50 backdrop-blur-sm mb-6">
                  <Code2 className="w-4 h-4 text-primary" />
                  <span className="text-[13px] font-bold text-text-secondary tracking-widest uppercase">Lead Developer</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-4">Kamal</h2>
                <p className="text-[16px] md:text-[18px] text-text-secondary leading-relaxed max-w-2xl mb-8">
                  A passionate full-stack developer dedicated to building secure, performant, and beautiful web applications. Share2Me was engineered to solve the complex problem of frictionless peer-to-peer data transfer in restrictive network environments.
                </p>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <a href="https://github.com/Kamal-dev-1999" target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-background-elevated border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-primary hover:bg-primary/10 transition-all duration-300 shadow-lg hover:-translate-y-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                  </a>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-background-elevated border border-border text-[14px] font-medium text-text-secondary">
                    Built with <Heart className="w-4 h-4 text-status-error fill-status-error/20" /> in India
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-12 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
              <span className="text-text-primary font-display font-bold">Share2Me</span>
            </div>
            
            <div className="text-[13px] text-text-tertiary">
              © 2026 Share2Me. All rights reserved.
            </div>

            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
