"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";
import { getBackendUrl } from "@/lib/backendUrl";

interface ExtendedSessionUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  shareCode?: string;
  planType?: string;
}

const EXPRESS_BACKEND_URL = getBackendUrl();

/**
 * AdManager Gatekeeper:
 * - Free / Guest / Unauthenticated users: Loads Monetag MultiTag & Google AdSense scripts.
 * - PRO Vendors (planType === "PRO"): Completely bypasses all ad networks, prevents any popunders
 *   or ad redirects from attaching to the DOM, and unregisters any active Monetag service workers.
 */
export function AdManager() {
  const { data: session, status, update } = useSession();
  const sessionUser = session?.user as ExtendedSessionUser | undefined;

  // 1. Check NextAuth session planType
  const sessionIsPro =
    status === "authenticated" &&
    String(sessionUser?.planType || "").toUpperCase() === "PRO";

  // 2. Client-side state that also checks localStorage cache immediately
  const [localIsPro, setLocalIsPro] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("share2me_is_pro") === "true";
    }
    return false;
  });

  const isPro = sessionIsPro || localIsPro;

  // Sync sessionIsPro into localStorage
  useEffect(() => {
    if (sessionIsPro && typeof window !== "undefined") {
      localStorage.setItem("share2me_is_pro", "true");
      setLocalIsPro(true);
    }
  }, [sessionIsPro]);

  // Proactive background check for authenticated users to detect upgrades immediately
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/g2p-token")
        .then((res) => (res.ok ? res.json() : null))
        .then((tokenData) => {
          if (tokenData?.token) {
            fetch(`${EXPRESS_BACKEND_URL}/g2p/vendor/me`, {
              headers: { Authorization: `Bearer ${tokenData.token}` },
              cache: "no-store",
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((profile) => {
                if (
                  profile?.is_pro ||
                  String(profile?.plan_type || "").toUpperCase() === "PRO"
                ) {
                  setLocalIsPro(true);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("share2me_is_pro", "true");
                  }
                  if (
                    String(sessionUser?.planType || "").toUpperCase() !== "PRO"
                  ) {
                    update?.({ planType: "PRO" });
                  }
                } else if (profile?.plan_type === "FREE") {
                  setLocalIsPro(false);
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("share2me_is_pro");
                  }
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    } else if (status === "unauthenticated") {
      setLocalIsPro(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("share2me_is_pro");
      }
    }
  }, [status, sessionUser?.planType, update]);

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
