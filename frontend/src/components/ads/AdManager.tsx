"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";

interface ExtendedSessionUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  shareCode?: string;
  planType?: string;
}

/**
 * AdManager Gatekeeper:
 * - Free / Guest / Unauthenticated users: Loads Monetag MultiTag & Google AdSense scripts.
 * - PRO Vendors (planType === "PRO"): Completely bypasses all ad networks, prevents any popunders
 *   or ad redirects from attaching to the DOM, and unregisters any active Monetag service workers.
 */
export function AdManager() {
  const { data: session, status } = useSession();
  const sessionUser = session?.user as ExtendedSessionUser | undefined;
  const isPro =
    status === "authenticated" &&
    String(sessionUser?.planType || "").toUpperCase() === "PRO";

  useEffect(() => {
    // If user is a PRO member, proactively clean up any lingering ad service workers
    if (
      isPro &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          const scriptUrl = reg.active?.scriptURL || "";
          if (scriptUrl.includes("sw.js") || scriptUrl.includes("monetag")) {
            reg.unregister().catch(() => {});
          }
        });
      });
    }
  }, [isPro]);

  // PRO Members get 100% clean, ad-free, and redirect-free experience
  if (isPro) {
    return null;
  }

  // Free and Guest users receive standard ad tags
  return (
    <>
      {/* Monetag MultiTag (Zone 281066 for share2me.in) */}
      <Script
        src="https://quge5.com/88/tag.min.js"
        data-zone="281066"
        strategy="afterInteractive"
        data-cfasync="false"
      />

      {/* Google AdSense */}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3981074780272106"
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
    </>
  );
}
