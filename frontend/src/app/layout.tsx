import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";

import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  title: "Share2Me — Secure P2P File Transfer",
  description:
    "Send files peer-to-peer with end-to-end AES-GCM encryption and ECDH key exchange. No cloud. No middleman.",
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
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <SplashScreen />
        {children}
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics gaId="G-8XDS75JXYK" />
      </body>
    </html>
  );
}
