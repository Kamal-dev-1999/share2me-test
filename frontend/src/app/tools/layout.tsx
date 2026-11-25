import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF Tools — Merge, Split, Convert & Edit PDFs Online",
  description:
    "Free browser-based PDF tools: merge, split, rotate, convert, sign, protect and compress PDFs without uploading private files.",
  alternates: {
    canonical: "/tools",
  },
  openGraph: {
    title: "PDF Tools | Share2Me",
    description:
      "Free browser-based PDF tools: merge, split, rotate, convert, sign, protect and compress PDFs.",
    url: "https://share2me.in/tools",
    type: "website",
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
