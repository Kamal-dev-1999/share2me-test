import { Metadata } from "next";
import HowItWorksClient from "./HowItWorksClient";

export const metadata: Metadata = {
  title: "How It Works — P2P WebRTC Transfer Protocols | Share2Me",
  description: "Explore the technical details behind browser-native peer-to-peer file sharing: WebRTC DataChannels, AES-GCM-256 chunk encryption, ECDH key exchange, and STUN/TURN traversal.",
  alternates: {
    canonical: "/how-it-works",
  },
  openGraph: {
    title: "How It Works — P2P WebRTC Transfer Protocols | Share2Me",
    description: "Explore the technical details behind browser-native peer-to-peer file sharing: WebRTC DataChannels, AES-GCM-256 chunk encryption, ECDH key exchange, and STUN/TURN traversal.",
    url: "https://share2.me/how-it-works",
    type: "website",
  }
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
