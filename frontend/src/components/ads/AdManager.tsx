"use client";

import { useEffect } from "react";

/**
 * AdManager (Disabled):
 * All ad networks (Monetag, Google AdSense) are commented out.
 * Proactively unregisters any lingering ad service workers from visitors' browsers.
 */
export function AdManager() {
  useEffect(() => {
    // Proactively clean up any lingering ad service workers from any visitor's browser
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          const scriptUrl = reg.active?.scriptURL || "";
          if (
            scriptUrl.includes("sw.js") ||
            scriptUrl.includes("monetag") ||
            scriptUrl.includes("nap5k") ||
            scriptUrl.includes("n6wxm") ||
            scriptUrl.includes("5gvci") ||
            scriptUrl.includes("quge5") ||
            scriptUrl.includes("3nbf4")
          ) {
            reg.unregister().catch(() => {});
          }
        });
      });
    }
  }, []);

  // Ads disabled for now — return null so no scripts or banners are injected
  return null;

  /*
  // ─── ADS DISABLED (Re-enable below when ad monetization is needed) ───────────
  return (
    <>
      <Script
        id="monetag-in-page-push"
        src="https://nap5k.com/tag.min.js"
        data-zone="12048031"
        strategy="afterInteractive"
        data-cfasync="false"
      />
      <Script
        id="monetag-vignette"
        src="https://n6wxm.com/vignette.min.js"
        data-zone="12048272"
        strategy="lazyOnload"
        data-cfasync="false"
      />
      <Script
        id="monetag-push-tag"
        src="https://5gvci.com/act/files/tag.min.js?z=12048270"
        strategy="lazyOnload"
        data-cfasync="false"
      />
      <Script
        id="google-adsense"
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3981074780272106"
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
    </>
  );
  */
}
