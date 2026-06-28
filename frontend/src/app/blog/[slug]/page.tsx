import { TopNav } from "@/components/TopNav";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, BookOpen, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface ArticleContent {
  title: string;
  category: string;
  readTime: string;
  date: string;
  intro: string;
  sections: {
    heading: string;
    content: string;
    bullets?: string[];
  }[];
  conclusion: string;
}

const DATABASE: Record<string, ArticleContent> = {
  "p2p-file-transfer-browser-guide": {
    title: "How to Transfer Files Peer-to-Peer in the Browser",
    category: "WebRTC",
    readTime: "6 min read",
    date: "June 28, 2026",
    intro: "File transfers traditionally require intermediate servers. You upload the file, the server saves it, and the receiver downloads it. Peer-to-peer (P2P) transfers bypass this server altogether. Using WebRTC, your browser connects directly to the receiver's browser, creating a direct data pipeline. In this guide, we explore how WebRTC coordinates peer-to-peer transfer, how direct connections bypass corporate firewalls, and why zero-storage architectures represent the future of web privacy.",
    sections: [
      {
        heading: "1. The Mechanics of WebRTC DataChannels",
        content: "WebRTC (Web Real-Time Communication) is an open-source standard enabling real-time browser communication. While commonly associated with video and audio calls, it contains a powerful component called RTCDataChannel. This channel allows the transport of arbitrary binary data directly between browsers. Unlike media feeds, DataChannels support TCP-like reliability (retransmissions) or UDP-like speed, configured to match network conditions.",
        bullets: [
          "Direct Connection: Data flows directly between peers, reducing latency and utilizing local network speeds.",
          "Low CPU Overhead: Browsers stream binary data using native low-level socket connections.",
          "Zero Server Storage: Servers are completely bypassed during data transfer, removing hosting security risks."
        ]
      },
      {
        heading: "2. The Role of Signaling, STUN, and TURN Servers",
        content: "If WebRTC is peer-to-peer, how do browsers locate each other? They use a process called signaling. Before a direct link is established, browsers must exchange connection offers, answers, and network configurations (ICE Candidates). A signaling server acts as a temporary mailbox for this handshake. Furthermore, because most devices reside behind NATs and firewalls, helper utilities are required to navigate direct traffic routing:",
        bullets: [
          "Signaling Server: A WebSocket server (e.g. Socket.io) used only to establish the initial connection.",
          "STUN Servers: Simple public servers that tell your browser its external IP address and port configuration.",
          "TURN Servers: Relay servers used as a backup. If symmetric firewalls prevent a direct peer-to-peer connection, traffic is securely routed through the TURN server. The data remains end-to-end encrypted and unreadable by the relay."
        ]
      },
      {
        heading: "3. Bypassing Size Limitations and Throttling",
        content: "Traditional cloud storage platforms restrict file sizes to control hosting bandwidth costs. Because WebRTC establishes a direct line, there are no artificial limits. The file is split into small binary chunks (e.g. 64KB - 256KB) and streamed sequentially. The browser reads files using the File System Access API or FileReader, keeping memory overhead minimal even when transferring massive multi-gigabyte archives."
      }
    ],
    conclusion: "By removing server dependencies, WebRTC DataChannels redefine internet file sharing. The transfer is only limited by physical network speeds. Share2Me harnesses this technology, providing secure, unlimited, and lightning-fast transfers directly inside your web browser."
  },
  "end-to-end-encryption-web-crypto-api": {
    title: "End-to-End Encryption in Web Apps via Web Crypto API",
    category: "Cryptography",
    readTime: "8 min read",
    date: "June 25, 2026",
    intro: "Building secure web utilities requires end-to-end encryption (E2EE), ensuring data is encrypted before leaving the sender's device and remains encrypted until decrypted by the recipient. Historically, web developers relied on heavy external JS libraries for encryption, which degraded performance and introduced security risks. Modern browsers solve this with the Web Crypto API, a fast, hardware-accelerated cryptographic framework. This article demonstrates how to build a secure E2EE pipeline using WebCrypto, ECDH key exchanges, and AES-GCM-256.",
    sections: [
      {
        heading: "1. Key Exchange via Elliptic Curve Diffie-Hellman (ECDH)",
        content: "For secure encryption, the sender and receiver must share a symmetric key without exposing it to eavesdroppers. ECDH (using the P-256 curve) solves this problem. Both parties generate an ephemeral key pair in their respective browsers. They swap public keys via the signaling server. Using their private keys and the peer's public key, both independently derive the exact same shared secret. The raw AES key never crosses the network.",
        bullets: [
          "Forward Secrecy: A new key pair is generated for each transfer, protecting past sessions.",
          "Zero Key Leakage: Only public keys are shared over the wire; private keys remain secure.",
          "Zero Server Knowledge: The signaling server only relays public keys, making decryption impossible."
        ]
      },
      {
        heading: "2. AES-GCM-256 Symmetric Encryption",
        content: "Once the shared secret is established, the file or text is encrypted using AES-GCM-256 (Advanced Encryption Standard with Galois/Counter Mode). GCM is preferred over standard CBC mode because it provides both confidentiality and authentication. This ensures that if any part of the encrypted chunk is altered in transit, the decryption process will fail immediately, preventing man-in-the-middle tampering."
      },
      {
        heading: "3. Cryptographic Web Workers for Smooth Performance",
        content: "Running cryptographic operations on the browser's main thread causes user interfaces to freeze, especially for large files. Web Workers execute code in a background thread, resolving performance issues. The file buffer is transferred to the worker, split into chunks, encrypted, and posted back as binary packages, ensuring UI responsiveness."
      }
    ],
    conclusion: "By combining ephemeral ECDH key exchange with AES-GCM-256 encryption inside Web Workers, we build a secure, browser-native file transfer pipeline. Share2Me integrates this E2EE model, ensuring your private data remains completely private."
  },
  "webrtc-vs-cloud-storage-file-transfer": {
    title: "WebRTC vs Cloud Storage: Which is Best for File Transfers?",
    category: "Architecture",
    readTime: "5 min read",
    date: "June 20, 2026",
    intro: "When you need to send a file to a colleague, you likely use a cloud service like Google Drive, Dropbox, or WeTransfer. However, direct WebRTC peer-to-peer transfers offer a compelling alternative. This article compares P2P and cloud architectures, examining performance, security, file size limits, cost, and user privacy.",
    sections: [
      {
        heading: "1. Upload and Download Speeds Compared",
        content: "Cloud storage transfers are a two-step process: you upload to the cloud, and the receiver downloads from the cloud. On a symmetric gigabit fiber connection, this doubles the total transfer time. WebRTC streams data directly. As the sender reads and encrypts chunks, they are immediately sent over the WebRTC DataChannel to the receiver, maximizing bandwidth usage."
      },
      {
        heading: "2. Privacy, Encryption, and Data Ownership",
        content: "Most cloud storage providers encrypt data 'at rest' on their servers, meaning they hold the decryption keys. This exposes your data to corporate indexing, government requests, and server breaches. WebRTC transfers are end-to-end encrypted. Data is encrypted in the sender's browser memory, sent directly over the wire, and decrypted in the receiver's memory, ensuring data ownership.",
        bullets: [
          "Zero Cloud Footprint: No residual files remain on external servers after transfer completion.",
          "No Central Keys: Decryption keys are ephemeral and reside only in browser memory.",
          "GDPR & HIPAA Compliance: Direct transfers simplify compliance by avoiding third-party processors."
        ]
      },
      {
        heading: "3. Cost, Storage, and Limits",
        content: "Cloud providers charge monthly fees for storage capacity. Sending a single 25GB virtual machine disk can exhaust free tiers or exceed file size limits. Share2Me is free and unlimited. Because the signaling server only coordinates the handshake, there is no storage cost, allowing you to send files of any size without subscriptions."
      }
    ],
    conclusion: "While cloud storage remains useful for long-term file backups, WebRTC is superior for instant, secure point-to-point transfers. Share2Me leverages WebRTC to deliver private, fast, and cost-effective file sharing directly in your browser."
  }
};

export async function generateStaticParams() {
  return [
    { slug: "p2p-file-transfer-browser-guide" },
    { slug: "end-to-end-encryption-web-crypto-api" },
    { slug: "webrtc-vs-cloud-storage-file-transfer" },
  ];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = DATABASE[slug];

  if (!article) {
    return {
      title: "Article Not Found | Share2Me Blog",
    };
  }

  const cleanDescription = article.intro.substring(0, 155) + "...";

  return {
    title: `${article.title} | Share2Me Blog`,
    description: cleanDescription,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: `${article.title} | Share2Me Blog`,
      description: cleanDescription,
      url: `https://share2.me/blog/${slug}`,
      siteName: "Share2Me",
      type: "article",
      publishedTime: new Date(article.date).toISOString(),
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
  const article = DATABASE[slug];

  if (!article) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `https://share2.me/blog/${slug}#post`,
    "headline": article.title,
    "description": article.intro.substring(0, 155) + "...",
    "datePublished": new Date(article.date).toISOString(),
    "dateModified": new Date(article.date).toISOString(),
    "author": {
      "@type": "Organization",
      "name": "Share2Me",
      "url": "https://share2.me"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Share2Me",
      "logo": {
        "@type": "ImageObject",
        "url": "https://share2.me/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://share2.me/blog/${slug}`
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Background glow elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B967FF]/10 blur-[120px] pointer-events-none" />

      <TopNav />

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
            
            <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-tertiary" />
                <span>{article.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-tertiary" />
                <span>{article.readTime}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto cursor-pointer hover:text-primary transition-colors">
                <Share2 className="w-4 h-4 text-text-tertiary" />
                <span className="font-bold">Share</span>
              </div>
            </div>
          </header>

          {/* Article Content */}
          <section className="space-y-10 text-[16px] md:text-[17px] text-text-secondary leading-relaxed font-sans">
            <p className="text-text-primary text-[18px] leading-relaxed font-medium border-l-2 border-primary pl-6 py-1">
              {article.intro}
            </p>

            {article.sections.map((section, idx) => (
              <div key={idx} className="space-y-4 mt-12">
                <h2 className="text-2xl font-bold text-text-primary pt-4">{section.heading}</h2>
                <p>{section.content}</p>
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
