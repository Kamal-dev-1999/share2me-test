import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";

import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  metadataBase: new URL('https://share2.me'),
  title: {
    default: "Share2Me — Secure P2P File Transfer in Browser",
    template: "%s | Share2Me"
  },
  description: "Send large files instantly between devices using secure peer-to-peer (P2P) WebRTC technology. No file size limits, no sign-ups, and no cloud storage middleman.",
  keywords: ["file sharing", "P2P file transfer", "WebRTC file sharing", "secure file transfer", "share files between devices", "peer to peer file sharing", "send large files free"],
  authors: [{ name: "Share2Me" }],
  creator: "Share2Me",
  publisher: "Share2Me",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Share2Me — Secure P2P File Transfer",
    description: "Send large files instantly between devices using secure peer-to-peer (P2P) WebRTC technology. No limits, no sign-ups.",
    url: 'https://share2.me',
    siteName: 'Share2Me',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Share2Me — Secure P2P File Transfer",
    description: "Send large files instantly between devices using secure peer-to-peer (P2P) WebRTC technology. No limits, no sign-ups.",
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
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Share2Me",
              "url": "https://share2.me",
              "description": "Secure, unlimited P2P file sharing directly in your browser. No cloud storage, no sign-ups required.",
              "applicationCategory": "UtilitiesApplication",
              "operatingSystem": "All",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              }
            })
          }}
        />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8XDS75JXYK" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8XDS75JXYK');
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <SplashScreen />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
