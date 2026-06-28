import { Metadata } from "next";
import BlogIndexClient from "./BlogIndexClient";

export const metadata: Metadata = {
  title: "Share2Me Technical Journal & Guides — WebRTC & Cryptography",
  description: "Read technical guides on browser-native file sharing, ephemeral ECDH key derivations, AES-GCM-256 chunk encryption, WebRTC data channels, and secure data pipelines.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Share2Me Technical Journal & Guides — WebRTC & Cryptography",
    description: "Read technical guides on browser-native file sharing, ephemeral ECDH key derivations, AES-GCM-256 chunk encryption, WebRTC data channels, and secure data pipelines.",
    url: "https://share2.me/blog",
    type: "website",
  }
};

export default function BlogPage() {
  return <BlogIndexClient />;
}
