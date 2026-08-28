"use client";
import Link from "next/link";
import { Shield, Zap, Lock, BookOpen, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";


export default function BlogIndexClient({ initialArticles = [] }: { initialArticles: any[] }) {
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("webrtc") || cat.includes("tech")) return Zap;
    if (cat.includes("cryptography") || cat.includes("security")) return Lock;
    if (cat.includes("comparison")) return Shield;
    return BookOpen;
  };

  const getCategoryGlow = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("webrtc") || cat.includes("tech")) return "shadow-[0_0_15px_rgba(252,213,53,0.15)]";
    if (cat.includes("cryptography") || cat.includes("security")) return "shadow-[0_0_15px_rgba(185,103,255,0.15)]";
    return "shadow-[0_0_15px_rgba(45,212,191,0.15)]";
  };

  const articlesList = initialArticles.map((article) => {
    const cleanIntro = (article.intro || "").replace(/!\[.*?\]\((.*?)\)/g, '').trim();
    return {
      slug: article.slug,
      title: article.title,
      excerpt: cleanIntro.substring(0, 150) + "...",
      category: article.category,
      readTime: article.readTime,
      date: article.date,
      icon: getCategoryIcon(article.category),
      glowColor: getCategoryGlow(article.category)
    };
  });

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-text-primary">
      {/* Glow Backdrops */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />


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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articlesList.map((article, i) => {
              const Icon = article.icon;
              return (
                <motion.div
                  key={article.slug}
                  whileHover={{ y: -8 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="group flex flex-col justify-between bg-background-card/50 backdrop-blur-xl rounded-[32px] border border-border p-8 hover:border-primary/50 transition-all duration-300 shadow-lg"
                >
                  <div>
                    {/* Header: Category & Info */}
                    <div className="flex items-center justify-between text-xs text-text-tertiary mb-6">
                      <span className="bg-background-elevated border border-border px-3 py-1.5 rounded-full font-bold uppercase tracking-wider text-text-secondary">
                        {article.category}
                      </span>
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
