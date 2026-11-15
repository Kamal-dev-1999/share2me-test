/**
 * Centralized backend URL resolver.
 *
 * Production architecture (OCI):
 *   Browser → share2.me (Caddy) → backend:8000 internally
 *   getBackendUrl() returns "" so all fetch('/api/...') calls are same-origin.
 *   The backend IP, port, and api.share2.me subdomain are NEVER sent to the browser.
 *
 * Local development:
 *   Returns http://localhost:3000 (dev Express server).
 *
 * Cloud Run (GCP legacy):
 *   Returns the Cloud Run backend URL directly (no Caddy proxy in that env).
 */

export const CLOUD_RUN_BACKEND_URL =
  process.env.NEXT_PUBLIC_CLOUD_RUN_BACKEND_URL ||
  process.env.CLOUD_RUN_BACKEND_URL ||
  "https://share2me-backend-916674186483.asia-south1.run.app";

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    // 1. Local development — connect directly to dev backend
    if (host === "localhost" || host === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
    }

    // 2. Cloud Run (GCP legacy) — route directly to Cloud Run backend
    if (host.endsWith(".run.app")) {
      return CLOUD_RUN_BACKEND_URL;
    }

    // 3. All production hosts: OCI IP (130.210.22.28), share2.me, share2me.in
    //    Return "" = same-origin relative URLs.
    //    Caddy proxies /api/* and /socket.io/* to backend:8000 internally.
    //    The browser never sees: 130.210.22.28, :8000, api.share2.me, backend:8000
    return "";
  }

  // Server-side rendering (Node.js / Next.js SSR)
  // BACKEND_URL is a server-side-only env var — never embedded in the browser bundle.
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  // Private VCN backend on VM 2 (fallback)
  return "http://10.0.1.218:8000";
}
