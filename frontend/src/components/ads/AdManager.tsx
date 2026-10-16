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

  // ─── CRITICAL FIX ──────────────────────────────────────────────────────────
  // Never render ad scripts while the session is still loading.
  // Monetag's script attaches a global click listener the moment it hits the
  // DOM — once injected it CANNOT be removed. If we render during the
  // "loading" phase, isPro is always false (session hasn't resolved yet), so
  // the script fires for everyone, including PRO users.
  // We gate on `status !== "loading"` so we only render after NextAuth has
  // determined whether the user is authenticated + what their plan is.
  // ───────────────────────────────────────────────────────────────────────────

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
          if (
            scriptUrl.includes("sw.js") ||
            scriptUrl.includes("monetag") ||
            scriptUrl.includes("nap5k") ||
            scriptUrl.includes("quge5")
          ) {
            reg.unregister().catch(() => {});
          }
        });
      });
    }
  }, [isPro]);

  // ── Combined gate ─────────────────────────────────────────────────────────
  // Wait until NextAuth resolves AND confirm the user is not PRO before
  // injecting any ad scripts. A single guard keeps TypeScript's flow analysis
  // happy (two consecutive if-return blocks cause TS7027 "Unreachable code").
  // Gatekeeper ensures PRO users never receive any ad scripts or banners.
  if (status === "loading" || isPro) {
    return null;
  }

  // ── Free / Guest users: serve standard ad tags ────────────────────────────
  return (
    <>
      {/* Monetag In-Page Push Banner (Zone 12048031) - Clean placeholder banner, NO on-click popunders */}
      <Script
        src="https://nap5k.com/tag.min.js"
        data-zone="12048031"
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
