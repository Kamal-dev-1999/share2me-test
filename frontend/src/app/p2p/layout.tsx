import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Direct P2P File & Text Transfer Workspace",
  description: "Transfer files and clipboard text directly between any two devices using browser-to-browser WebRTC encryption (AES-GCM-256). Zero size limits and no cloud storage.",
  alternates: {
    canonical: "/p2p",
  },
  openGraph: {
    title: "Direct P2P File & Text Transfer Workspace | Share2Me",
    description: "Transfer files and clipboard text directly between any two devices using browser-to-browser WebRTC encryption (AES-GCM-256). Zero size limits and no cloud storage.",
    url: "https://www.share2me.in/p2p",
  },
};

export default function P2PLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
