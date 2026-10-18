"use client";

import { useState } from "react";

interface ClientImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function ClientImage({ src, alt, className }: ClientImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  if (failed) return null;

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!fallbackAttempted) {
          setFallbackAttempted(true);
          setImgSrc("https://www.sourcesplash.com/i/random?q=technology,workspace&w=1200&h=630");
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
