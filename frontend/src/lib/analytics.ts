/**
 * Production-Grade Google Analytics 4 (GA4) Telemetry & Event Tracking
 * Property: share2me.in
 * Measurement ID: G-CCBEZ2KK0S
 */

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-CCBEZ2KK0S";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: Object[];
  }
}

/**
 * Low-level safe wrapper around window.gtag and window.dataLayer.
 * If gtag.js is still loading asynchronously, events are safely queued in window.dataLayer.
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, string | number | boolean | undefined | null>
) {
  if (typeof window === "undefined") return;

  const cleaned = eventParams
    ? Object.fromEntries(
        Object.entries(eventParams).filter(
          ([, v]) => v !== undefined && v !== null
        )
      )
    : undefined;

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, cleaned);
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...cleaned,
    });
  }
}

/**
 * Manual Pageview tracking.
 * Note: GA4 Enhanced Measurement already tracks history changes automatically.
 * Only call this if manual override is required.
 */
export function trackPageView(url: string, title?: string) {
  if (typeof window === "undefined") return;
  const pageTitle = title || (typeof document !== "undefined" ? document.title : "");

  trackEvent("page_view", {
    page_path: url,
    page_location: window.location.href,
    page_title: pageTitle,
  });
}

/**
 * AI & Productivity Tools tracking (Background Remover, PDF Tools, QR Code)
 */
export function trackToolUse(params: {
  toolName: string;
  action:
    | "select_file"
    | "process_start"
    | "process_success"
    | "process_error"
    | "download"
    | "reset"
    | "view";
  durationMs?: number;
  model?: string;
  fileSizeBytes?: number;
  errorReason?: string;
}) {
  trackEvent("tool_interaction", {
    tool_name: params.toolName,
    tool_action: params.action,
    duration_ms: params.durationMs,
    duration_sec: params.durationMs ? Number((params.durationMs / 1000).toFixed(2)) : undefined,
    model: params.model,
    file_size_bytes: params.fileSizeBytes,
    file_size_mb: params.fileSizeBytes
      ? Number((params.fileSizeBytes / (1024 * 1024)).toFixed(2))
      : undefined,
    error_reason: params.errorReason ? params.errorReason.slice(0, 100) : undefined,
  });
}

/**
 * File Transfer (P2P / Cloud Relay / Text) Tracking
 */
export function trackTransferStart(params: {
  transferType: "p2p" | "cloud" | "text";
  fileCount?: number;
  totalSizeBytes?: number;
}) {
  trackEvent("transfer_start", {
    transfer_type: params.transferType,
    file_count: params.fileCount ?? 1,
    total_size_bytes: params.totalSizeBytes ?? 0,
    total_size_mb: params.totalSizeBytes
      ? Number((params.totalSizeBytes / (1024 * 1024)).toFixed(2))
      : 0,
  });
}

export function trackTransferComplete(params: {
  transferType: "p2p" | "cloud" | "text";
  fileCount?: number;
  totalSizeBytes?: number;
  durationMs?: number;
}) {
  trackEvent("transfer_complete", {
    transfer_type: params.transferType,
    file_count: params.fileCount ?? 1,
    total_size_bytes: params.totalSizeBytes ?? 0,
    duration_sec: params.durationMs
      ? Number((params.durationMs / 1000).toFixed(1))
      : 0,
    transfer_speed_mbps:
      params.durationMs && params.totalSizeBytes && params.durationMs > 0
        ? Number(
            (
              ((params.totalSizeBytes * 8) / (params.durationMs / 1000)) /
              1000000
            ).toFixed(2)
          )
        : undefined,
  });
}

export function trackTransferError(params: {
  transferType: "p2p" | "cloud" | "text";
  errorReason: string;
}) {
  trackEvent("transfer_error", {
    transfer_type: params.transferType,
    error_reason: params.errorReason.slice(0, 100),
  });
}

/**
 * User Engagement (Copy to clipboard, Downloads, Shares)
 */
export function trackCopy(params: {
  type: "text" | "link" | "code" | "qr";
  length?: number;
}) {
  trackEvent("copy_content", {
    copy_type: params.type,
    content_length: params.length,
  });
}

export function trackDownload(params: {
  fileName?: string;
  fileType?: string;
  source?: string;
}) {
  trackEvent("file_download", {
    file_name: params.fileName,
    file_extension: params.fileType,
    download_source: params.source,
  });
}
