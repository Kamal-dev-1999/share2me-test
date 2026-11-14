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
  "https://share2me-backend-916674186483.asia-south1.run.app";

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    // 1. Direct OCI IP access: connect to same host
    if (host === "130.210.22.28") {
      return window.location.origin;
    }

    // 2. If client is on Cloud Run (*.run.app), route directly to Cloud Run backend
    if (host.endsWith(".run.app")) {
      return CLOUD_RUN_BACKEND_URL;
    }

    // 3. Local development
    if (host === "localhost" || host === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
    }

    // 4. Custom domain production: allow api.share2.me / api.share2me.in now that OCI hosts them
    const envUrl =
      process.env.NEXT_PUBLIC_EXPRESS_URL ||
      process.env.NEXT_PUBLIC_SIGNAL_URL ||
      process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL;

    if (
      envUrl &&
      envUrl.trim() &&
      !envUrl.includes("onrender.com")
    ) {
      return envUrl.trim();
    }

    return CLOUD_RUN_BACKEND_URL;
  }

  // Next.js server-side (Node.js runtime / SSR)
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  const envUrl =
    process.env.NEXT_PUBLIC_EXPRESS_URL ||
    process.env.NEXT_PUBLIC_SIGNAL_URL ||
    process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;

  if (
    envUrl &&
    envUrl.trim() &&
    !envUrl.includes("onrender.com")
  ) {
    return envUrl.trim();
  }

  // Docker internal network default
  return "http://backend:8000";
}
