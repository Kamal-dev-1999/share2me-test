import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receive Portal & Permanent Inbox",
  description: "Claim your permanent Share Code and receive secure file uploads from anyone directly into your personal inbox.",
  alternates: {
    canonical: "/g2p",
  },
  openGraph: {
    title: "Receive Portal & Permanent Inbox | Share2Me",
    description: "Claim your permanent Share Code and receive secure file uploads from anyone directly into your personal inbox.",
    url: "https://share2.me/g2p",
  },
};

export default function G2PLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
