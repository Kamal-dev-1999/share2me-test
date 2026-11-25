import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/pdfTools";

interface MetadataProps {
  params: Promise<{ slug: string }>;
}

interface LayoutProps extends MetadataProps {
  children: React.ReactNode;
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  const title = tool ? `${tool.title} | Share2Me` : "Tool Not Found | Share2Me";
  const description =
    tool?.description || "Convert, edit and share documents securely in your browser.";

  return {
    title,
    description,
    alternates: {
      canonical: `/tools/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://share2me.in/tools/${slug}`,
      type: "website",
    },
  };
}

export default function ToolDetailLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
