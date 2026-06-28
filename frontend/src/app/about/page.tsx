import { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About Share2Me — Secure P2P Serverless File & Text Sharing",
  description: "Learn about the mission behind Share2Me: building a secure, serverless peer-to-peer file sharing utility using WebRTC and hardware-accelerated WebCrypto.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Share2Me — Secure P2P Serverless File & Text Sharing",
    description: "Learn about the mission behind Share2Me: building a secure, serverless peer-to-peer file sharing utility using WebRTC and hardware-accelerated WebCrypto.",
    url: "https://share2.me/about",
    type: "website",
  }
};

export default function AboutPage() {
  return <AboutPageClient />;
}
