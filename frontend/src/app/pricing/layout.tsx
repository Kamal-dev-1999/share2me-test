import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free & Pro Plans",
  description:
    "Start free with unlimited peer-to-peer transfers, or upgrade to Share2Me Pro for a permanent receive portal and print-shop tools.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing | Share2Me",
    description:
      "Start free with unlimited peer-to-peer transfers, or upgrade to Share2Me Pro.",
    url: "https://share2me.in/pricing",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
