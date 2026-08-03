import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";

import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  metadataBase: new URL('https://share2.me'),
  title: {
    default: "Share2Me — Secure P2P File Transfer & Send Large Files Free",
    template: "%s | Share2Me"
  },
  description: "Send large files and text clipboard data instantly between any device using Share2Me (also known as Share 2 Me, Share To, or Share2). Secure, end-to-end encrypted (AES-GCM-256) peer-to-peer (P2P) WebRTC. Zero file limits, no sign-ups, and zero cloud storage.",
  keywords: [
    "share2", "share to", "share 2 me", "share2me", "share to me", "share-to-me",
    "file sharing", "P2P file transfer", "WebRTC file sharing", "secure file transfer",
    "share files between devices", "peer to peer file sharing", "send large files free",
    "secure file transfer online", "send big files free", "online text sharing",
    "private text share", "secure clipboard share", "encrypted file sharing",
    "no limit file transfer", "cross platform file sharing", "iphone to pc transfer free",
    "how to send 10gb file free", "direct browser file share", "secure send text online",
    "file transfer without upload", "browser file sharing", "send files online without server",
    "direct p2p file transfer", "webrtc file transfer", "send files anonymously",
    "anonymous file sharing", "secure web clipboard", "local file transfer web",
    "send large video files free", "pc to mobile file transfer online", "online file transfer cross platform",
    "fastest way to send large files", "no login file sharing", "secure web drop box",
    "clipboard sync cross platform", "share files webrtc", "temp file sharing secure",
    "real time file sharing browser",

    // General File Sharing
    "online file sharing", "free file sharing", "instant file sharing", "best file sharing app",
    "best file sharing website", "online file transfer", "easy file sharing", "fast file sharing",
    "quick file transfer", "simple file sharing",

    // Large File Transfer
    "share large files online", "transfer large files", "large file upload", "free large file transfer",
    "large video transfer", "share 1gb file online", "share 2gb file online", "share 5gb file online",
    "send files over 1gb", "best way to send large files",

    // QR Code Sharing
    "qr code file sharing", "share files with qr code", "scan qr to download files", "qr file transfer",
    "qr code upload", "qr code download", "share documents with qr code", "photo sharing qr code",
    "video sharing qr code",

    // Device Transfer
    "transfer files from phone to pc", "transfer files from pc to phone", "android to iphone transfer",
    "iphone to android file transfer", "mac to windows transfer", "windows to mac file sharing",
    "share files between phone and laptop", "cross device file transfer", "wifi file transfer",

    // Browser Based
    "browser based file sharing", "browser file transfer", "share files without app",
    "send files without installing software", "web based file transfer", "online transfer without app",

    // No Account
    "share files without account", "share files without email", "share files without phone number",
    "anonymous file transfer", "temporary file sharing", "guest file upload",

    // Receive Portal / G2P
    "collect files online", "receive files online", "upload portal", "file upload portal",
    "document upload portal", "client upload portal", "resume upload portal", "assignment upload portal",
    "secure upload link", "request files online",

    // Team & Business
    "business file sharing", "team file sharing", "company file transfer", "enterprise file sharing",
    "office file sharing", "secure business file transfer",

    // Students
    "share notes online", "assignment sharing", "college file sharing", "project file sharing",
    "student file transfer",

    // Photos & Videos
    "share photos online", "share videos online", "photo transfer", "video transfer",
    "image sharing online", "gallery sharing", "high quality photo sharing",

    // Clipboard
    "copy text between devices", "clipboard sharing", "share clipboard online", "send text between devices",
    "cross device clipboard",

    // Privacy
    "private file sharing", "encrypted file transfer", "secure upload", "private upload link",
    "password protected file sharing",

    // Competitor Keywords
    "wetranfer alternative", "wetransfer alternative", "send anywhere alternative", "smash alternative",
    "swisstransfer alternative", "filemail alternative", "google drive alternative", "dropbox alternative",
    "airdrop alternative", "airdrop for windows", "airdrop for android",

    // AI & Productivity
    "share files with ai", "smart file sharing", "modern file sharing", "productivity tools",
    "online collaboration tools"
  ],
  authors: [{ name: "Share2Me" }],
  creator: "Share2Me",
  publisher: "Share2Me",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Share2Me — Secure P2P File Transfer & Send Large Files Free",
    description: "Send large files and text clipboard data instantly between any device using Share2Me (also known as Share 2 Me, Share To, or Share2) secure, end-to-end encrypted (AES-GCM-256) P2P WebRTC.",
    url: 'https://share2.me',
    siteName: 'Share2Me',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Share2Me — Secure P2P File Transfer & Send Large Files Free",
    description: "Send large files and text clipboard data instantly between any device using Share2Me (also known as Share 2 Me, Share To, or Share2) secure, end-to-end encrypted (AES-GCM-256) P2P WebRTC.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport = {
  themeColor: "#F2F0EF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://share2.me/#website",
                  "url": "https://share2.me",
                  "name": "Share2Me",
                  "alternateName": ["Share 2 Me", "Share To", "Share2", "ShareToMe", "Share-To-Me"],
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://share2.me/?q={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "Organization",
                  "@id": "https://share2.me/#organization",
                  "name": "Share2Me",
                  "url": "https://share2.me",
                  "logo": "https://share2.me/logo.png",
                  "brand": {
                    "@type": "Brand",
                    "name": "Share2Me",
                    "alternateName": ["Share 2 Me", "Share To", "Share2", "ShareToMe", "Share-To-Me"]
                  },
                  "sameAs": [
                    "https://github.com/share2me"
                  ]
                },
                {
                  "@type": "WebApplication",
                  "@id": "https://share2.me/#webapp",
                  "name": "Share2Me",
                  "alternateName": ["Share 2 Me", "Share To", "Share2", "ShareToMe", "Share-To-Me"],
                  "url": "https://share2.me",
                  "description": "Secure, unlimited P2P file sharing and text sharing directly in your browser. No cloud storage, no sign-ups required.",
                  "applicationCategory": "UtilitiesApplication",
                  "operatingSystem": "All",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD"
                  }
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": "https://share2.me/#softwareapp",
                  "name": "Share2Me",
                  "alternateName": ["Share 2 Me", "Share To", "Share2", "ShareToMe", "Share-To-Me"],
                  "url": "https://share2.me",
                  "applicationCategory": "UtilitiesApplication",
                  "operatingSystem": "All",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD"
                  },
                  "featureList": [
                    "Peer-to-Peer file transfer",
                    "End-to-End Encryption (AES-GCM-256)",
                    "Ephemeral key exchange (ECDH P-256)",
                    "No file size limit",
                    "Text clipboard sharing",
                    "Cross-platform WebRTC streaming"
                  ]
                },
                {
                  "@type": "FAQPage",
                  "@id": "https://share2.me/#faq",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "What is the maximum file size limit on Share2Me?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "There are absolutely no file size limits on Share2Me. Because the transfer is established directly peer-to-peer (P2P) between the sender and receiver browsers via WebRTC, the data does not pass through or store on any intermediate cloud server."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Is my data secure when transferring files and text?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes, completely secure. All transfers are end-to-end encrypted using military-grade AES-GCM-256 encryption. The encryption key is derived locally on your device via ephemeral ECDH (P-256) key exchange, meaning the raw key never leaves your browser and cannot be read by anyone, including the signaling server."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Do both devices need to be online at the same time?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Because Share2Me uses direct WebRTC peer-to-peer tunnels to transfer data, both the sending device and the receiving device must have the page open and be online concurrently to perform the transfer."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Can I transfer files between different operating systems?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Absolutely. Share2Me is entirely browser-native and cross-platform. It works seamlessly between iOS, Android, macOS, Windows, Linux, and any other operating system running a modern web browser, without needing any software installations."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Can I send clipboard text and messages securely?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Share2Me offers a dedicated Text Transfer mode. Copy-paste any text, passwords, or code snippets, and it will be encrypted and streamed securely through the same WebRTC pipeline, complete with a convenient 'Copy All' button for the receiver."
                      }
                    }
                  ]
                }
              ]
            })
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6158699724091217"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-background text-on-surface font-body antialiased" suppressHydrationWarning>
        {/* Hand-drawn / manga-panel wobble filter, referenced from CSS via url(#wobble). */}
        <svg
          aria-hidden="true"
          focusable="false"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>
            <filter id="wobble">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" />
              <feDisplacementMap in="SourceGraphic" scale="3" />
            </filter>
            <filter id="wobble-soft">
              <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="2" />
            </filter>
          </defs>
        </svg>
        <SplashScreen />
        {children}
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics gaId="G-8XDS75JXYK" />
        <GoogleTagManager gtmId="GTM-KS4LVZSF" />
      </body>
    </html>
  );
}
