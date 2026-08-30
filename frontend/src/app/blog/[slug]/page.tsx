import Link from "next/link";
import { ArrowLeft, Calendar, BookOpen, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import ClientImage from "./ClientImage";
import ShareButton from "./ShareButton";


interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const backendUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || 'http://localhost:3000';
  let article = null;
  try {
    const res = await fetch(`${backendUrl}/api/blogs/${slug}`, {
      next: { revalidate: 60 }
    });
    if (res.ok) {
      article = await res.json();
    }
  } catch (err) {
    console.error('Error fetching blog:', err);
  }

  if (!article) {
    return {
      title: "Article Not Found — Blog",
    };
  }

  // Strip markdown images for SEO description
  const textOnlyIntro = (article.intro || "").replace(/!\[.*?\]\((.*?)\)/g, '').trim();
  const cleanDescription = textOnlyIntro.substring(0, 155) + "...";

  let publishedTime = new Date().toISOString();
  const slugDateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  const displayDate = slugDateMatch ? slugDateMatch[1] : article.date;
  try {
    if (displayDate) {
      publishedTime = new Date(displayDate).toISOString();
    }
  } catch (e) {
    // Ignore invalid dates
  }
  
  // Overwrite article.date with displayDate so the UI uses it below
  article.date = displayDate;

  return {
    title: `${article.title || 'Blog Post'} — Blog`,
    description: cleanDescription,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: `${article.title || 'Blog Post'} | Share2Me Blog`,
      description: cleanDescription,
      url: `https://www.share2me.in/blog/${slug}`,
      siteName: "Share2Me",
      type: "article",
      publishedTime: publishedTime,
      authors: ["Share2Me Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | Share2Me Blog`,
      description: cleanDescription,
    }
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  
  const backendUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || 'http://localhost:3000';
  let article = null;
  try {
    const res = await fetch(`${backendUrl}/api/blogs/${slug}`, {
      next: { revalidate: 60 }
    });
    if (res.ok) {
      article = await res.json();
    }
  } catch (err) {
    console.error('Error fetching blog:', err);
  }

  if (!article) {
    notFound();
  }

  let publishedTime = new Date().toISOString();
  try {
    if (article.date) {
      publishedTime = new Date(article.date).toISOString();
    }
  } catch (e) {
    // Ignore invalid dates
  }

  const textOnlyIntro = (article.intro || "").replace(/!\[.*?\]\((.*?)\)/g, '').trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `https://www.share2me.in/blog/${slug}#post`,
    "headline": article.title || 'Blog Post',
    "description": textOnlyIntro.substring(0, 155) + "...",
    "datePublished": publishedTime,
    "dateModified": publishedTime,
    "author": {
      "@type": "Organization",
      "name": "Share2Me",
      "url": "https://www.share2me.in"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Share2Me",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.share2me.in/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://www.share2me.in/blog/${slug}`
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      {/* Background glow elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />


      <main className="flex-1 w-full max-w-[800px] mx-auto px-6 py-16 relative z-10 pt-28">
        
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors text-sm font-bold mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back to Articles</span>
        </Link>

        {/* Article Meta */}
        <article className="space-y-10">
          <header className="space-y-6 border-b border-border pb-10">
            <span className="bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider text-[12px] w-fit block">
              {article.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-text-primary leading-[1.2] tracking-tight">
              {article.title}
            </h1>
            
              <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary w-full">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-tertiary" />
                  <span>{article.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-text-tertiary" />
                  <span>{article.readTime}</span>
                </div>
                <ShareButton url={`https://www.share2me.in/blog/${slug}`} title={article.title} />
              </div>
          </header>

          {/* Article Content */}
          <section className="space-y-10 text-[16px] md:text-[17px] text-text-secondary leading-relaxed font-sans">
            {/* Intro Rendering */}
            <div className="space-y-6">
              {(() => {
                const imgMatch = article.intro.match(/!\[(.*?)\]\((.*?)\)/);
                const textOnly = article.intro.replace(/!\[.*?\]\((.*?)\)/g, '').trim();
                
                let safeUrl = "";
                if (imgMatch) {
                  try {
                    safeUrl = encodeURI(decodeURI(imgMatch[2]));
                  } catch (e) {
                    safeUrl = imgMatch[2].replace(/ /g, '%20');
                  }
                }

                return (
                  <>
                    {imgMatch && (
                      <ClientImage 
                        src={safeUrl} 
                        alt={imgMatch[1]} 
                        className="w-full rounded-[24px] border border-border/40 shadow-xl object-cover mb-8 aspect-[2/1]" 
                      />
                    )}
                    <p className="text-text-primary text-[18px] leading-relaxed font-medium border-l-2 border-primary pl-6 py-1">
                      {textOnly}
                    </p>
                  </>
                );
              })()}
            </div>

            {(article.sections || []).map((section: any, idx: number) => (
              <div key={idx} className="space-y-6 mt-12">
                <h2 className="text-2xl font-bold text-text-primary pt-4">{section.heading || ''}</h2>
                
                {/* Section Content Rendering */}
                <div>
                  {(() => {
                    const contentStr = section.content || "";
                    const imgMatch = contentStr.match(/!\[(.*?)\]\((.*?)\)/);
                    const textOnly = contentStr.replace(/!\[.*?\]\((.*?)\)/g, '').trim();
                    const parts = textOnly.split(/(\*\*.*?\*\*)/g);
                    
                    let safeUrl = "";
                    if (imgMatch) {
                      try {
                        safeUrl = encodeURI(decodeURI(imgMatch[2]));
                      } catch (e) {
                        safeUrl = imgMatch[2].replace(/ /g, '%20');
                      }
                    }

                    return (
                      <>
                        {imgMatch && (
                          <ClientImage 
                            src={safeUrl} 
                            alt={imgMatch[1]} 
                            className="w-full rounded-[16px] border border-border/40 shadow-lg object-cover mb-6 mt-4"
                          />
                        )}
                        <p>
                          {parts.map((part: string, i: number) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={i} className="text-text-primary font-bold">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={i}>{part}</span>;
                          })}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {section.bullets && section.bullets.length > 0 && (
                  <ul className="list-disc pl-6 space-y-3 mt-4 text-text-secondary">
                    {section.bullets.map((bullet: string, bidx: number) => {
                      const [boldText, ...rest] = bullet.split(":");
                      const normalText = rest.join(":");
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
              </div>
            ))}

            <div className="bg-background-elevated border border-border rounded-[24px] p-8 mt-16 space-y-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-primary" />
                <span>Conclusion</span>
              </h3>
              <p className="text-sm md:text-base">{article.conclusion}</p>
            </div>
          </section>

          {/* Footer Call to Action */}
          <footer className="border-t border-border pt-12 mt-16 text-center space-y-6">
            <h4 className="text-2xl font-bold text-text-primary">Ready to Share Securely?</h4>
            <p className="text-text-secondary max-w-md mx-auto text-sm md:text-base">
              Try Share2Me now for unlimited peer-to-peer file and text transfers. Secure, serverless, and fast.
            </p>
            <Link
              href="/#transfer"
              className="inline-flex items-center gap-2 bg-primary text-background font-bold px-8 py-4 rounded-[12px] hover:bg-opacity-90 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(252,213,53,0.3)]"
            >
              <span>Start Transfer</span>
            </Link>
          </footer>
        </article>

      </main>
    </div>
  );
}
