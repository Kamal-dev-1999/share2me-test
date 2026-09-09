/**
 * Centralized backend URL resolver with fallback mechanism.
 * Priority:
 * 1. If loaded from a Cloud Run domain (*.run.app), automatically connect to the Cloud Run backend domain.
 * 2. If loaded from localhost, use localhost dev backend.
 * 3. If loaded from production custom domain (share2me.in), use custom backend domain (api.share2me.in) or fallback to Cloud Run domain.
 */

export const CLOUD_RUN_BACKEND_URL =
  process.env.NEXT_PUBLIC_CLOUD_RUN_BACKEND_URL ||
  process.env.CLOUD_RUN_BACKEND_URL ||
  "https://share2me-backend-ic7b2itmta-el.a.run.app";

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    // 1. If client is on Cloud Run (*.run.app), route directly to Cloud Run backend
    if (host.endsWith(".run.app")) {
      return CLOUD_RUN_BACKEND_URL;
    }

    // 2. Local development
    if (host === "localhost" || host === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
    }

    // 3. Custom domain production: if custom domain backend URL is set,
    // use it unless it is the unmapped api.share2me.in or onrender
    const envUrl =
      process.env.NEXT_PUBLIC_EXPRESS_URL ||
      process.env.NEXT_PUBLIC_SIGNAL_URL ||
      process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL;

    if (
      envUrl &&
      envUrl.trim() &&
      !envUrl.includes("onrender.com") &&
      !envUrl.includes("api.share2me.in")
    ) {
      return envUrl.trim();
    }

    return CLOUD_RUN_BACKEND_URL;
  }

  // Next.js server-side (Node.js runtime / SSR)
  const envUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_EXPRESS_URL ||
    process.env.NEXT_PUBLIC_SIGNAL_URL ||
    process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;

  if (
    envUrl &&
    envUrl.trim() &&
    !envUrl.includes("onrender.com") &&
    !envUrl.includes("api.share2me.in")
  ) {
    return envUrl.trim();
  }

  // Fallback to Cloud Run backend
  return CLOUD_RUN_BACKEND_URL;
}
