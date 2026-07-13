import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
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
    "how to send 10gb file free", "direct browser file share", "secure send text online"
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
  themeColor: "#0b0e11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
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
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8XDS75JXYK" strategy="afterInteractive" />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-8XDS75JXYK');
            `
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-text-primary antialiased" suppressHydrationWarning>
        <SplashScreen />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
