"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { trackPageView, GA_MEASUREMENT_ID } from "@/lib/analytics";

function TrackerContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render because @next/third-parties/google's
    // <GoogleAnalytics /> already handles the initial page_view beacon.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const queryString = searchParams?.toString();
    const url = pathname + (queryString ? `?${queryString}` : "");
    trackPageView(url);
  }, [pathname, searchParams]);

  return null;
}

/**
 * SPA Route Navigation Analytics Tracker
 * Wrapped in Suspense to satisfy Next.js useSearchParams requirements.
 */
export function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerContent />
    </Suspense>
  );
}

/**
 * Real User Monitoring (RUM) Core Web Vitals to GA4
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", metric.name, {
        value: Math.round(
          metric.name === "CLS" ? metric.value * 1000 : metric.value
        ),
        event_label: metric.id,
        non_interaction: true,
        metric_rating: metric.rating,
        metric_value: metric.value,
        metric_delta: metric.delta,
        send_to: GA_MEASUREMENT_ID,
      });
    }
  });

  return null;
}
