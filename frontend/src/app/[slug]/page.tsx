import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { ArrowLeft, Zap, Sparkles } from "lucide-react";
import { LANDING_PAGES } from "./data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(LANDING_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = LANDING_PAGES[slug];

  if (!page) {
    return {
      title: "Page Not Found | Share2Me",
    };
  }

  return {
    title: page.title,
    description: page.metaDesc,
    keywords: [page.keyword, "file transfer", "send files online", "Share2Me", "Share 2 Me", "AirDrop alternative"],
    alternates: {
      canonical: `/${slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.metaDesc,
      url: `https://share2.me/${slug}`,
      siteName: "Share2Me",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.metaDesc,
    }
  };
}

export default async function NicheLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const page = LANDING_PAGES[slug];

  if (!page) {
    notFound();
  }

  // Generate Schemas dynamically
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `https://share2.me/${slug}#webpage`,
        "url": `https://share2.me/${slug}`,
        "name": page.title,
        "description": page.metaDesc,
        "breadcrumb": {
          "@id": `https://share2.me/${slug}#breadcrumb`
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `https://share2.me/${slug}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://share2.me"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": page.keyword,
            "item": `https://share2.me/${slug}`
          }
        ]
      },
      {
        "@type": "WebApplication",
        "@id": `https://share2.me/${slug}#webapp`,
        "name": "Share2Me",
        "alternateName": ["Share 2 Me", "Share To", "Share2", "ShareToMe"],
        "url": "https://share2.me",
        "description": "Secure, unlimited P2P file sharing and text clipboard sharing directly in your browser.",
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "HowTo",
        "@id": `https://share2.me/${slug}#howto`,
        "name": page.howto.title,
        "description": `Step-by-step guide on how to perform ${page.keyword} transfers using Share2Me.`,
        "step": page.howto.steps.map((step, idx) => ({
          "@type": "HowToStep",
          "position": idx + 1,
          "name": step.name,
          "text": step.text
        }))
      },
      {
        "@type": "FAQPage",
        "@id": `https://share2.me/${slug}#faq`,
        "mainEntity": page.faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.a
          }
        }))
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Background radial glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />

      <TopNav />

      <main className="flex-1 w-full max-w-[900px] mx-auto px-6 py-16 relative z-10 pt-28">
        
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors text-sm font-bold mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        {/* Semantic Header */}
        <article className="space-y-12">
          <header className="space-y-6 border-b border-border pb-10">
            <span className="bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider text-[12px] w-fit block">
              Guides & Solutions
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-text-primary leading-[1.2] tracking-tight">
              {page.h1}
            </h1>
            <p className="text-[18px] text-text-secondary leading-relaxed font-sans border-l-2 border-primary pl-6 py-1">
              {page.intro}
            </p>
          </header>

          {/* Article Paragraph Sections */}
          {page.sections.map((section, idx) => (
            <section key={idx} className="space-y-6">
              <h2 className="text-2xl font-bold text-text-primary">{section.title}</h2>
              {section.paragraphs.map((para, pIdx) => (
                <p key={pIdx} className="text-text-secondary leading-relaxed text-[16px]">
                  {para}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc pl-6 space-y-3 mt-4 text-text-secondary">
                  {section.bullets.map((bullet, bidx) => {
                    const [boldText, normalText] = bullet.split(":");
                    return (
                      <li key={bidx}>
                        {normalText ? (
                          <>
                            <strong className="text-text-primary">{boldText}:</strong>
                            {normalText}
                          </>
                        ) : (
                          bullet
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}

          {/* Competitor Comparison Section */}
          <section className="space-y-6 pt-6">
            <h2 className="text-2xl font-bold text-text-primary">Feature Comparison</h2>
            <p className="text-text-secondary text-[15px]">
              How does Share2Me (Share 2 Me) P2P compare against traditional file-hosting solutions?
            </p>
            <div className="overflow-x-auto rounded-[20px] border border-border bg-background-elevated/40 backdrop-blur-md">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-elevated text-text-primary font-bold">
                    <th className="p-4">Platform</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Speed</th>
                    <th className="p-4">File Size Limit</th>
                    <th className="p-4">Privacy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-text-secondary">
                  {page.comparison.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-background-elevated/20 transition-colors">
                      <td className="p-4 font-semibold text-text-primary">{row.competitor}</td>
                      <td className="p-4">{row.method}</td>
                      <td className="p-4">{row.speed}</td>
                      <td className="p-4">{row.limit}</td>
                      <td className="p-4">{row.privacy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* How-To Step-by-Step Guide Section */}
          <section className="space-y-6 pt-6">
            <h2 className="text-2xl font-bold text-text-primary">{page.howto.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {page.howto.steps.map((step, sIdx) => (
                <div key={sIdx} className="bg-background-elevated border border-border p-6 rounded-[24px] shadow-soft space-y-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                    {sIdx + 1}
                  </div>
                  <h3 className="font-bold text-text-primary">{step.name}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQs Accordion Section */}
          <section className="space-y-6 pt-6">
            <h2 className="text-2xl font-bold text-text-primary">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {page.faqs.map((faq, fIdx) => (
                <div key={fIdx} className="bg-background-elevated border border-border/80 rounded-[20px] p-6 space-y-2">
                  <h3 className="font-bold text-text-primary flex items-start gap-2.5">
                    <span className="text-primary font-extrabold text-[15px]">Q:</span>
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-[14px] text-text-secondary leading-relaxed pl-5 border-l border-primary/20">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Footer Block */}
          <footer className="border-t border-border pt-12 mt-16 text-center space-y-6">
            <h2 className="text-3xl font-bold text-text-primary">Ready to Share Securely?</h2>
            <p className="text-text-secondary max-w-md mx-auto text-sm md:text-base">
              Try Share2Me (Share 2 Me) now for unlimited peer-to-peer file transfers and text clipboard sync.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Link
                href="/p2p"
                className="inline-flex items-center justify-center gap-2 bg-primary text-background font-bold px-8 py-4 rounded-[12px] hover:bg-opacity-90 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(252,213,53,0.3)]"
              >
                <span>P2P Transfer</span>
                <Zap className="w-4 h-4" />
              </Link>
              <Link
                href="/g2p"
                className="inline-flex items-center justify-center gap-2 bg-background-elevated border border-border text-text-primary font-bold px-8 py-4 rounded-[12px] hover:border-primary/40 active:scale-[0.98] transition-all"
              >
                <span>G2P Workspace</span>
                <Sparkles className="w-4 h-4 text-primary" />
              </Link>
            </div>
          </footer>
        </article>

      </main>
    </div>
  );
}
