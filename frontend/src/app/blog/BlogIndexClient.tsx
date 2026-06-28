"use client";
import { TopNav } from "@/components/TopNav";
import Link from "next/link";
import { Shield, Zap, Lock, BookOpen, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface BlogCard {
  title: string;
  excerpt: string;
  slug: string;
  readTime: string;
  category: string;
  date: string;
  icon: React.ComponentType<{ className?: string }>;
  glowColor: string;
  borderColor: string;
  hoverBg: string;
}

const ARTICLES: BlogCard[] = [
  {
    title: "How to Transfer Files Peer-to-Peer in the Browser",
    excerpt: "Discover how WebRTC technology enables direct browser-to-browser data transfer with zero server storage, yielding unmatched transfer speeds and total privacy.",
    slug: "p2p-file-transfer-browser-guide",
    readTime: "6 min read",
    category: "WebRTC",
    date: "June 28, 2026",
    icon: Zap,
    glowColor: "shadow-[0_0_15px_rgba(252,213,53,0.15)]",
    borderColor: "group-hover:border-primary/50",
    hoverBg: "hover:bg-primary/5",
  },
  {
    title: "End-to-End Encryption in Web Apps via Web Crypto API",
    excerpt: "Learn how to use native in-browser cryptographic tools (AES-GCM-256 and ECDH P-256 key exchange) to encrypt file chunks before they touch the wire.",
    slug: "end-to-end-encryption-web-crypto-api",
    readTime: "8 min read",
    category: "Cryptography",
    date: "June 25, 2026",
    icon: Lock,
    glowColor: "shadow-[0_0_15px_rgba(185,103,255,0.15)]",
    borderColor: "group-hover:border-[#B967FF]/50",
    hoverBg: "hover:bg-[#B967FF]/5",
  },
  {
    title: "WebRTC vs Cloud Storage: Which is Best for File Transfers?",
    excerpt: "A deep dive comparing P2P data channels against standard cloud services (Google Drive, Dropbox) in terms of security, performance, limits, and cost.",
    slug: "webrtc-vs-cloud-storage-file-transfer",
    readTime: "5 min read",
    category: "Architecture",
    date: "June 20, 2026",
    icon: Shield,
    glowColor: "shadow-[0_0_15px_rgba(45,212,191,0.15)]",
    borderColor: "group-hover:border-[#2dd4bf]/50",
    hoverBg: "hover:bg-[#2dd4bf]/5",
  }
];

export default function BlogIndexClient() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-text-primary">
      {/* Glow Backdrops */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />

      <TopNav />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-16 relative z-10">
        
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-24 max-w-4xl mx-auto pt-16"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_20px_rgba(255,204,0,0.15)] mb-8"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-[13px] font-bold text-primary tracking-wide">SHARE2ME TECHNICAL JOURNAL</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-display font-extrabold text-text-primary mb-8 leading-[1.15] tracking-tight">
            Knowledge Base & <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#ffaa00] to-[#B967FF]">
              Engineering Guides
            </span>
          </h1>
          <p className="text-[18px] md:text-[20px] text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Deep dives into browser cryptography, peer-to-peer data channels, network architecture, and security protocols written by the Share2Me core team.
          </p>
        </motion.div>

        {/* Articles Feed */}
        <section className="mb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ARTICLES.map((article, i) => {
              const Icon = article.icon;
              return (
                <motion.div
                  key={article.slug}
                  whileHover={{ y: -8 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group flex flex-col justify-between bg-background-card/50 backdrop-blur-xl rounded-[32px] border border-border p-8 hover:border-primary/50 transition-all duration-300 shadow-lg"
                >
                  <div>
                    {/* Header: Category & Info */}
                    <div className="flex items-center justify-between text-xs text-text-tertiary mb-6">
                      <span className="bg-background-elevated border border-border px-3 py-1.5 rounded-full font-bold uppercase tracking-wider text-text-secondary">
                        {article.category}
                      </span>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{article.readTime}</span>
                      </div>
                    </div>

                    {/* Icon Display */}
                    <div className={`w-14 h-14 rounded-2xl bg-background-elevated border border-border flex items-center justify-center mb-6 group-hover:scale-115 transition-transform duration-300 ${article.glowColor}`}>
                      <Icon className="w-7 h-7 text-primary" />
                    </div>

                    {/* Article Info */}
                    <h3 className="text-xl font-bold text-text-primary mb-3 leading-snug group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-[14px] text-text-secondary leading-relaxed mb-6">
                      {article.excerpt}
                    </p>
                  </div>

                  {/* Read Link */}
                  <Link
                    href={`/blog/${article.slug}`}
                    className="inline-flex items-center gap-2 text-[14px] font-bold text-primary group-hover:text-text-primary transition-colors w-fit pt-4 border-t border-border/50 w-full"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
