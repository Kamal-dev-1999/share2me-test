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

export default async function BlogPage() {
  const backendUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || 'http://localhost:3000';
  let articlesList = [];

  try {
    const res = await fetch(`${backendUrl}/api/blogs`, {
      next: { revalidate: 60 } // Revalidate every 60 seconds
    });
    
    if (res.ok) {
      articlesList = await res.json();
    } else {
      console.error('Failed to fetch blogs from backend:', res.status);
    }
  } catch (err) {
    console.error('Error fetching blogs:', err);
  }

  return <BlogIndexClient initialArticles={articlesList} />;
}
