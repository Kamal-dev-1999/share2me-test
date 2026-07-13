"use client";
import { Shield, Zap, Lock, HardDrive, Wifi, Smartphone } from "lucide-react";

export function SeoContent() {
  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 pb-24 text-text-primary">
      <div className="flex flex-col gap-16">
        
        {/* Main SEO Header */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-text-primary leading-tight">
            The Secure, Zero-Cloud Way to Share Large Files & Text Online
          </h2>
          <p className="text-[16px] md:text-[18px] text-text-secondary leading-relaxed">
            Share2Me (also commonly searched as Share 2 Me, Share To, or Share2) is a next-generation peer-to-peer (P2P) file sharing and text sharing platform that connects devices directly in the browser. 
            By utilizing modern WebRTC technology, your files and text clipboard data travel straight from your browser to the receiver&apos;s browser. 
            Enjoy unlimited file transfers, zero sign-ups, and military-grade encryption without the cloud storage middleman.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-background-elevated border border-border rounded-[20px] p-8 shadow-soft hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-[12px] flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">No File Size Limits</h3>
            <p className="text-text-secondary text-[15px] leading-relaxed">
              Why pay for premium cloud storage to send a 20GB video? Because Share2Me transfers files directly between devices without uploading them to a middleman server, there are absolutely zero file size restrictions or bandwidth throttling.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-background-elevated border border-border rounded-[20px] p-8 shadow-soft hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-[12px] flex items-center justify-center mb-6">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">End-to-End Encrypted (AES-256)</h3>
            <p className="text-text-secondary text-[15px] leading-relaxed">
              Every file sharing and text sharing session is secured with military-grade AES-GCM-256 encryption. We don&apos;t store your files, we can&apos;t see your data, and nobody else can intercept it. Your keys are derived locally via ECDH key exchange.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-background-elevated border border-border rounded-[20px] p-8 shadow-soft hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-[12px] flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">Absolute User Privacy</h3>
            <p className="text-text-secondary text-[15px] leading-relaxed">
              Unlike traditional file transfer apps or cloud drives, Share2Me requires no account registration, no sign-ups, and no passwords. Just generate a secure 6-digit one-time code, share it, and start transferring your data instantly.
            </p>
          </div>
        </div>

        {/* Deep Dive SEO Text section */}
        <div className="bg-background-elevated border border-border rounded-[24px] p-8 md:p-12 mt-8 shadow-soft">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-display font-bold">
                How Peer-to-Peer (P2P) File Transfer Works
              </h2>
              <div className="space-y-4 text-text-secondary text-[15px] leading-relaxed">
                <p>
                  Traditional file sharing websites force you to upload your sensitive data to their cloud servers. Then, the receiver has to download it from that server. This wastes time, compromises your privacy, and imposes strict file size limits.
                </p>
                <p>
                  Share2Me (also known as Share 2 Me, Share To, or Share2) uses a technology called <strong>WebRTC</strong>. When you enter a 6-digit code, our signaling server introduces the two devices to each other. Once connected, a secure, direct tunnel is created. 
                </p>
                <ul className="list-disc pl-5 space-y-2 mt-4 text-text-primary">
                  <li><strong>Fastest Transfer Speeds:</strong> Share files over your local WiFi network instantly at maximum bandwidth.</li>
                  <li><strong>Cross-Platform Compatibility:</strong> Send files from iPhone to PC, Android to Mac, or anywhere else.</li>
                  <li><strong>Secure Text Sharing:</strong> Send secure clipboard text, links, code, and passwords instantly.</li>
                </ul>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="bg-background p-6 rounded-[16px] border border-border/80 flex flex-col items-center text-center gap-3 shadow-inner">
                 <Wifi className="w-8 h-8 text-primary/80" />
                 <span className="font-semibold text-text-primary">Local WiFi Sync</span>
               </div>
               <div className="bg-background p-6 rounded-[16px] border border-border/80 flex flex-col items-center text-center gap-3 shadow-inner">
                 <HardDrive className="w-8 h-8 text-primary/80" />
                 <span className="font-semibold text-text-primary">No Server Storage</span>
               </div>
               <div className="bg-background p-6 rounded-[16px] border border-border/80 flex flex-col items-center text-center gap-3 sm:col-span-2 shadow-inner">
                 <Smartphone className="w-8 h-8 text-primary/80" />
                 <span className="font-semibold text-text-primary">Works on all Desktop & Mobile Browsers</span>
               </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
