"use client";

import { useState } from "react";

interface ClientImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function ClientImage({ src, alt, className }: ClientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
