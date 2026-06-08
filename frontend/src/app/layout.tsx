import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Share2Me — Secure P2P File Transfer",
  description:
    "Send files peer-to-peer with end-to-end AES-GCM encryption and ECDH key exchange. No cloud. No middleman.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas-dark text-body antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

