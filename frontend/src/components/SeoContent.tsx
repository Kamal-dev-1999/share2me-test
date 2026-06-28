"use client";
import { useState } from "react";
import { Shield, Zap, Lock, HardDrive, Wifi, Smartphone, ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    q: "What is the maximum file size limit on Share2Me?",
    a: "There are absolutely no file size limits on Share2Me. Because the transfer is established directly peer-to-peer (P2P) between the sender and receiver browsers via WebRTC, the data does not pass through or store on any intermediate cloud server."
  },
  {
    q: "Is my data secure when transferring files and text?",
    a: "Yes, completely secure. All transfers are end-to-end encrypted using military-grade AES-GCM-256 encryption. The encryption key is derived locally on your device via ephemeral ECDH (P-256) key exchange, meaning the raw key never leaves your browser and cannot be read by anyone, including the signaling server."
  },
  {
    q: "Do both devices need to be online at the same time?",
    a: "Yes. Because Share2Me uses direct WebRTC peer-to-peer tunnels to transfer data, both the sending device and the receiving device must have the page open and be online concurrently to perform the transfer."
  },
  {
    q: "Can I transfer files between different operating systems?",
    a: "Absolutely. Share2Me is entirely browser-native and cross-platform. It works seamlessly between iOS, Android, macOS, Windows, Linux, and any other operating system running a modern web browser, without needing any software installations."
  },
  {
    q: "Can I send clipboard text and messages securely?",
    a: "Yes. Share2Me offers a dedicated Text Transfer mode. Copy-paste any text, passwords, or code snippets, and it will be encrypted and streamed securely through the same WebRTC pipeline, complete with a convenient 'Copy All' button for the receiver."
  }
];

export function SeoContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 pb-24 text-text-primary">
      <div className="flex flex-col gap-16">
        
        {/* Main SEO Header */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-text-primary leading-tight">
            The Secure, Zero-Cloud Way to Share Large Files & Text Online
          </h2>
          <p className="text-[16px] md:text-[18px] text-text-secondary leading-relaxed">
            Share2Me is a next-generation peer-to-peer (P2P) file sharing and text sharing platform that connects devices directly in the browser. 
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
                  Share2Me uses a technology called <strong>WebRTC</strong>. When you enter a 6-digit code, our signaling server introduces the two devices to each other. Once connected, a secure, direct tunnel is created. 
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

        {/* Premium Interactive FAQ Accordion Component */}
        <div className="mt-8">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-4">
            <h2 className="text-2xl md:text-3xl font-display font-bold">Frequently Asked Questions</h2>
            <p className="text-text-secondary text-sm md:text-base">
              Got questions about browser-native P2P file transfers? We have answers.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-background-elevated border border-border rounded-[16px] overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => toggleFAQ(idx)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-border/20 transition-all focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-4">
                      <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-bold text-text-primary text-[15px] md:text-[16px]">{item.q}</span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-text-tertiary transition-transform duration-300 flex-shrink-0 ${
                        isOpen ? "transform rotate-180 text-primary" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isOpen ? "max-h-[300px] border-t border-border" : "max-h-0"
                    }`}
                  >
                    <div className="p-6 text-[14px] md:text-[15px] text-text-secondary leading-relaxed bg-background/30">
                      {item.a}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
