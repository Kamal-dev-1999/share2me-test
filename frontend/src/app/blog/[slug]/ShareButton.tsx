"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";

export default function ShareButton({ url, title }: { url: string, title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: title,
      text: `Check out this article: ${title}`,
      url: url,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Error sharing", err);
        }
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div 
      onClick={handleShare}
      className="flex items-center gap-2 ml-auto cursor-pointer text-text-tertiary hover:text-primary transition-colors bg-background-elevated px-3 py-1.5 rounded-full border border-border hover:border-primary/50"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Share2 className="w-4 h-4" />
      )}
      <span className="font-bold text-sm text-text-secondary">{copied ? "Copied!" : "Share"}</span>
    </div>
  );
}
