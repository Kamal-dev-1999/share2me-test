"use client";

import { useReportWebVitals } from "next/web-vitals";
import { trackEvent } from "@/lib/analytics";

/**
 * Metric payload structure from Next.js web-vitals
 */
interface WebVitalMetric {
  id: string;
  name: string;
  value: number;
  rating?: "good" | "needs-improvement" | "poor";
  delta?: number;
}

/**
 * Stable metric reporting handler declared outside the component.
 *
 * CRITICAL FIX: Next.js useReportWebVitals has `[reportWebVitalsFn]` in its
 * internal useEffect dependency array. Defining the callback outside the
 * component guarantees a stable reference identity across re-renders, preventing
 * duplicate listeners and repeated metric beacons from being sent to GA4.
 */
function reportWebVitalsMetric(metric: WebVitalMetric) {
  // GA4 standard precision: CLS is a decimal score (e.g. 0.05), so multiply by 1000
  // for integer representation as recommended by Google Chrome Web Vitals docs.
  const formattedValue = Math.round(
    metric.name === "CLS" ? metric.value * 1000 : metric.value
  );

  // Group under standard 'web_vital' event to avoid burning through GA4's 50 custom event quota
  trackEvent("web_vital", {
    metric_name: metric.name,
    metric_id: metric.id,
    value: formattedValue,
    metric_rating: metric.rating,
    metric_value: metric.value,
  });
}

/**
 * Real User Monitoring (RUM) Core Web Vitals to GA4
 * Tracks real-world LCP, FID, CLS, INP, FCP, TTFB metrics.
 */
export function WebVitals() {
  useReportWebVitals(reportWebVitalsMetric);
  return null;
}

/**
 * Note on SPA Route Navigation:
 * Next.js `@next/third-parties/google` (<GoogleAnalytics />) combined with
 * GA4 Enhanced Measurement automatically handles browser history changes
 * (pushState / replaceState) natively.
 *
 * A manual useEffect route listener would trigger duplicate page_view hits
 * per navigation. Therefore, AnalyticsTracker is kept as a lightweight no-op
 * mount point for layout backward-compatibility.
 */
export function AnalyticsTracker() {
  return null;
}
