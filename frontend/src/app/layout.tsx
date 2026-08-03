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
    // Brand
    "share2me", "share2", "share to", "share to me", "share 2 me", "share-to-me",

    // Core File Sharing
    "file sharing", "online file sharing", "free file sharing", "secure file sharing",
    "instant file sharing", "browser file sharing", "browser based file sharing", "web based file sharing",
    "easy file sharing", "simple file sharing", "modern file sharing", "fast file sharing",
    "real time file sharing", "direct browser file share",

    // File Transfer
    "file transfer", "online file transfer", "secure file transfer", "instant file transfer",
    "large file transfer", "fast file transfer", "free file transfer", "business file transfer",
    "cross platform file transfer", "peer to peer file transfer", "direct p2p file transfer",
    "webrtc file transfer",

    // P2P / WebRTC
    "P2P file transfer", "P2P file sharing", "peer to peer file sharing", "WebRTC file sharing",
    "WebRTC transfer", "direct browser transfer", "browser to browser transfer", "real time file transfer",
    "share files using WebRTC",

    // Large Files
    "send large files", "send large files free", "share large files", "share large files online",
    "transfer large files", "large file upload", "large file sharing", "send big files",
    "send big files free", "share large video files", "send video files", "share video online",
    "send files over 1GB", "send files over 1.5GB", "best way to send large files", "fastest way to send files",
    "how to send 10gb file free", "send large video files free", "fastest way to send large files",

    // QR Sharing
    "QR code file sharing", "QR file transfer", "share files with QR code", "upload using QR code",
    "download using QR code", "scan QR to share files", "scan QR to upload files", "QR code upload portal",
    "QR document sharing", "qr code file sharing", "scan qr to download files", "qr code upload",
    "qr code download", "share documents with qr code", "photo sharing qr code", "video sharing qr code",

    // Clipboard
    "clipboard sharing", "secure clipboard sharing", "clipboard sync", "cross device clipboard",
    "share clipboard online", "copy text between devices", "send text online", "private text sharing",
    "secure text sharing", "web clipboard", "private text share", "secure clipboard share",
    "secure send text online", "clipboard sync cross platform", "copy text between devices",

    // No Login
    "share files without login", "share files without account", "share files without signup",
    "send files without account", "send files without email", "share files without phone number",
    "anonymous file sharing", "anonymous file transfer", "temporary file sharing", "guest file upload",
    "no login file sharing",

    // Privacy
    "encrypted file sharing", "encrypted file transfer", "private file transfer", "private upload link",
    "secure upload portal", "password protected file sharing", "AES encrypted file sharing",
    "secure browser sharing", "private file sharing", "secure upload", "temp file sharing secure",

    // Cross Device
    "share files between devices", "cross device file sharing", "cross platform file sharing",
    "transfer files phone to PC", "transfer files PC to phone", "Android to iphone transfer",
    "iPhone to Android transfer", "Windows to Mac file sharing", "Mac to Windows transfer",
    "phone to laptop transfer", "laptop to phone transfer", "iphone to pc transfer free",
    "pc to mobile file transfer online", "online file transfer cross platform",

    // Receive Portal (G2P)
    "receive files online", "collect files online", "request files online", "upload portal",
    "document upload portal", "client upload portal", "resume upload portal", "assignment upload portal",
    "photo upload portal", "video upload portal", "secure upload link", "file request portal",
    "collect documents online", "collect resumes online", "collect assignments online",
    "file upload portal", "request files online",

    // Business
    "business file sharing", "enterprise file sharing", "team file sharing", "office file transfer",
    "client file sharing", "secure business file transfer", "company file sharing", "company file transfer",
    "office file sharing",

    // Education
    "share notes online", "student file sharing", "assignment sharing", "project file sharing",
    "college file sharing", "classroom file sharing", "student file transfer",

    // Photos & Videos
    "share photos online", "photo sharing", "video sharing", "image sharing", "gallery sharing",
    "photo transfer", "video transfer", "image sharing online", "high quality photo sharing",

    // Documents
    "PDF sharing", "document sharing", "share PDF online", "share documents securely",
    "share Word documents", "Excel file sharing", "PowerPoint sharing",

    // Cloud Alternatives
    "cloud storage alternative", "cloud free file sharing", "share files without cloud",
    "serverless file sharing", "file transfer without upload", "no cloud storage file sharing",
    "file transfer without upload", "send files online without server", "local file transfer web",
    "secure web drop box",

    // Search Intent
    "how to send files online", "how to share files online", "how to send large files",
    "how to share large files", "best file sharing website", "best file sharing app",
    "best secure file sharing", "best file transfer tool", "fastest file sharing website",

    // Competitors
    "WeTransfer alternative", "Send Anywhere alternative", "SwissTransfer alternative", "Smash alternative",
    "Filemail alternative", "Dropbox alternative", "Google Drive alternative", "OneDrive alternative",
    "Box alternative", "MEGA alternative", "AirDrop alternative", "AirDrop alternative for Windows",
    "AirDrop alternative for Android", "Nearby Share alternative", "wetranfer alternative",
    "wetransfer alternative", "airdrop alternative", "airdrop for windows", "airdrop for android",

    // Industries
    "HR file sharing", "recruitment file sharing", "marketing file sharing", "creative file sharing",
    "agency file sharing", "architecture file sharing", "construction file sharing", "legal document sharing",
    "healthcare file sharing", "manufacturing file sharing",

    // Collaboration
    "online collaboration", "share project files", "share work files", "team collaboration files",
    "remote file sharing", "work from home file sharing", "online collaboration tools",

    // AI & Productivity
    "productivity tools", "modern productivity app", "AI productivity tools", "online collaboration tools",
    "smart file sharing", "digital workspace", "share files with ai", "smart file sharing",
    "modern file sharing"
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
                    "https://github.com/share2me",
                    "https://www.linkedin.com/company/share2me"
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
