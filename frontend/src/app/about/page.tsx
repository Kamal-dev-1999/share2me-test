import { TopNav } from "@/components/TopNav";
import { TrustSection } from "@/components/TrustSection";
import Link from "next/link";
import { Star, Zap, Shield, Cpu, Code2 } from "lucide-react";

export const metadata = {
  title: "About Us | Share2Me",
  description: "Learn about the Share2Me project, its developers, and its latest enterprise-grade features.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-16">
        
        {/* Header Section */}
        <div className="text-center mb-16 max-w-3xl mx-auto pt-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10 mb-6">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-[13px] font-medium text-primary">Version 2.6</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-6 leading-tight">
            Redefining Secure <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-light">
              Peer-to-Peer Transfers
            </span>
          </h1>
          <p className="text-[16px] text-text-secondary leading-relaxed">
            Share2Me was built to eliminate the middleman in file sharing. No servers storing your data, no upload limits, just direct, end-to-end encrypted connections right between browsers.
          </p>
        </div>

        {/* Latest Features Highlights */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-background-elevated border border-border flex items-center justify-center shadow-soft">
              <Zap className="w-5 h-5 text-text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary">Latest Features</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-background-card rounded-[24px] border border-border p-8 hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(255,204,0,0.05)] transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-3">Enterprise-Grade TURN</h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Version 2.6 introduces Metered TURN credentials passing through port 443 with TLS, bypassing corporate firewalls and deep-packet inspection seamlessly.
              </p>
            </div>
            
            <div className="bg-background-card rounded-[24px] border border-border p-8 hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(255,204,0,0.05)] transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-3">Next.js 15 Migration</h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Completely refactored to utilize the latest Next.js 15 runtime, dramatically improving edge-caching and patching critical upstream CVE vulnerabilities.
              </p>
            </div>
            
            <div className="bg-background-card rounded-[24px] border border-border p-8 hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(255,204,0,0.05)] transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Code2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-3">Smart Error Handling</h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                New responsive error toasts and human-readable feedback. Disconnects, invalid pins, and WebRTC failures are now beautifully presented without the technical jargon.
              </p>
            </div>
          </div>
        </section>

        {/* Features Grid (Trust Section) */}
        <div className="mb-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-background-elevated border border-border flex items-center justify-center shadow-soft">
              <Shield className="w-5 h-5 text-text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary">System Architecture</h2>
          </div>
          <div className="bg-background-elevated rounded-[32px] border border-border p-2 sm:p-4">
            <TrustSection />
          </div>
        </div>

        {/* Developer Section */}
        <section className="mb-16">
          <div className="bg-background-card rounded-[32px] border border-border overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="p-8 md:p-12 flex flex-col md:flex-row gap-10 items-center relative z-10">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[32px] bg-gradient-to-br from-background-elevated to-border flex items-center justify-center shrink-0 border border-border shadow-soft">
                <span className="text-4xl font-display font-bold text-text-primary">K</span>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background mb-4">
                  <Code2 className="w-3.5 h-3.5 text-text-secondary" />
                  <span className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">Lead Developer</span>
                </div>
                <h2 className="text-3xl font-display font-bold text-text-primary mb-3">Kamal</h2>
                <p className="text-[15px] text-text-secondary leading-relaxed max-w-2xl mb-6">
                  A passionate full-stack developer dedicated to building secure, performant, and beautiful web applications. Share2Me was engineered to solve the complex problem of frictionless peer-to-peer data transfer in restrictive network environments.
                </p>
                
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <a href="https://github.com/Kamal-dev-1999" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-primary/50 transition-all">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                  </a>
                  {/* Add more social links if needed */}
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-12 mt-auto">
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
