"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";

export default function G2PErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If a deployment occurred and chunk hashes changed, auto-reload once to fetch fresh assets
    const msg = error?.message || "";
    if (
      error?.name === "ChunkLoadError" ||
      msg.includes("Loading chunk") ||
      msg.includes("failed to fetch")
    ) {
      const lastReload = sessionStorage.getItem("g2p_chunk_reload_ts");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("g2p_chunk_reload_ts", now.toString());
        window.location.reload();
        return;
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-on-surface font-body">
      <div className="card-brutalist p-8 max-w-md w-full flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold">Unable to load Receive Portal</h2>
        <p className="text-sm text-on-surface-variant">
          Share2Me was recently updated. Please refresh to load the latest components.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="btn-brutalist flex-1 justify-center"
          >
            <RotateCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            href="/"
            className="btn-brutalist bg-white text-ink border border-hairline hover:bg-background justify-center flex-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
