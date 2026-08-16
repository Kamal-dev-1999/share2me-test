/**
 * Print-shop domain — Phase 1 (frontend-only).
 *
 * All state is localStorage-backed so every screen is clickable end-to-end
 * without a backend. Phase 2 swaps these helpers for API calls; the
 * component-facing types stay identical.
 *
 * NOTE (Phase-1 limitation, by design): shopkeeper settings and print jobs
 * live in THIS browser's localStorage, so demoing the full journey means
 * playing both roles in the same browser. Real cross-user state arrives
 * with the backend.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type UserRole = "shopkeeper" | "student" | "assistant";

export interface PrintShopSettings {
  /** Data-URL of the uploaded UPI payment QR image. */
  paymentQr: string | null;
  /** Price per page in ₹. */
  bwPrice: number;
  colorPrice: number;
  /** Optional shop/location label shown to senders. */
  locationName: string;
}

export type PrintType = "bw" | "color";
export type PaymentStatus = "pending" | "paid" | "failed";
export type PaymentMethod = "online" | "cash";

export interface PrintJob {
  id: string;
  documentName: string;
  fileSizeBytes: number;
  fileType: string;
  pages: number;
  senderName: string;
  printType: PrintType;
  pricePerPage: number;
  totalAmount: number;
  /** "online" = paid via the shop's UPI QR, "cash" = pays at the counter. */
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Set when the shopkeeper confirms payment. */
  paymentId: string | null;
  paidAt: string | null;   // ISO
  createdAt: string;       // ISO
}

// ─────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────

const KEY_ROLE = "s2m_role";
const KEY_SETTINGS = "s2m_printshop_settings";
const KEY_JOBS = "s2m_print_jobs";

const isBrowser = () => typeof window !== "undefined";

// ─────────────────────────────────────────────────────────────
// Role
// ─────────────────────────────────────────────────────────────

/**
 * Roles are stored PER Google account (keyed by email), so signing in with a
 * different account on the same browser asks the question again.
 */
const roleKey = (account?: string | null) =>
  account ? `${KEY_ROLE}:${account.trim().toLowerCase()}` : KEY_ROLE;

export function getRole(account?: string | null): UserRole | null {
  if (!isBrowser()) return null;
  const r = localStorage.getItem(roleKey(account));
  return r === "shopkeeper" || r === "student" || r === "assistant" ? r : null;
}

export function setRole(role: UserRole, account?: string | null): void {
  if (!isBrowser()) return;
  localStorage.setItem(roleKey(account), role);
}

// ─────────────────────────────────────────────────────────────
// Shop settings
// ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: PrintShopSettings = {
  paymentQr: null,
  bwPrice: 2,
  colorPrice: 5,
  locationName: "",
};

export function getShopSettings(): PrintShopSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveShopSettings(settings: PrintShopSettings): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
}

// ─────────────────────────────────────────────────────────────
// Print jobs
// ─────────────────────────────────────────────────────────────

export function getPrintJobs(): PrintJob[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY_JOBS);
    if (!raw) return [];
    // Jobs stored before the cash option existed default to "online".
    return (JSON.parse(raw) as PrintJob[]).map((j) => ({ ...j, paymentMethod: j.paymentMethod ?? "online" }));
  } catch {
    return [];
  }
}

function persistJobs(jobs: PrintJob[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEY_JOBS, JSON.stringify(jobs));
}

export function addPrintJob(
  job: Omit<PrintJob, "id" | "createdAt" | "paymentStatus" | "paymentId" | "paidAt">
): PrintJob {
  const full: PrintJob = {
    ...job,
    id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    paymentStatus: "pending",
    paymentId: null,
    paidAt: null,
  };
  persistJobs([full, ...getPrintJobs()]);
  return full;
}

export function getPrintJob(id: string): PrintJob | undefined {
  return getPrintJobs().find((j) => j.id === id);
}

/** Shopkeeper action — "Confirm payment received". */
export function confirmJobPayment(id: string): PrintJob | undefined {
  const jobs = getPrintJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return undefined;
  job.paymentStatus = "paid";
  job.paymentId = `pay_${Date.now().toString(36).toUpperCase()}`;
  job.paidAt = new Date().toISOString();
  persistJobs(jobs);
  return job;
}

export function markJobFailed(id: string): PrintJob | undefined {
  const jobs = getPrintJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return undefined;
  job.paymentStatus = "failed";
  persistJobs(jobs);
  return job;
}

// ─────────────────────────────────────────────────────────────
// Derived analytics (KPIs + revenue series)
// ─────────────────────────────────────────────────────────────

export interface PrintShopKpis {
  totalDocuments: number;
  paidDocuments: number;
  pendingPayments: number;
  totalRevenue: number;
  colorPrints: number;
  bwPrints: number;
}

export function computeKpis(jobs: PrintJob[]): PrintShopKpis {
  const paid = jobs.filter((j) => j.paymentStatus === "paid");
  return {
    totalDocuments: jobs.length,
    paidDocuments: paid.length,
    pendingPayments: jobs.filter((j) => j.paymentStatus === "pending").length,
    totalRevenue: paid.reduce((sum, j) => sum + j.totalAmount, 0),
    colorPrints: paid.filter((j) => j.printType === "color").length,
    bwPrints: paid.filter((j) => j.printType === "bw").length,
  };
}

export type RevenueRange = "daily" | "weekly" | "monthly";

/** Buckets paid revenue for the chart: last 7 days / 8 weeks / 6 months. */
export function revenueSeries(jobs: PrintJob[], range: RevenueRange): { label: string; revenue: number }[] {
  const paid = jobs.filter((j) => j.paymentStatus === "paid" && j.paidAt);
  const now = new Date();
  const buckets: { label: string; from: Date; to: Date }[] = [];

  if (range === "daily") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const from = new Date(d); from.setHours(0, 0, 0, 0);
      const to = new Date(d); to.setHours(23, 59, 59, 999);
      buckets.push({ label: d.toLocaleDateString("en-IN", { weekday: "short" }), from, to });
    }
  } else if (range === "weekly") {
    for (let i = 7; i >= 0; i--) {
      const to = new Date(now); to.setDate(now.getDate() - i * 7);
      const from = new Date(to); from.setDate(to.getDate() - 6);
      buckets.push({ label: `W${8 - i}`, from, to });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = d;
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      buckets.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), from, to });
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    revenue: paid
      .filter((j) => {
        const t = new Date(j.paidAt as string).getTime();
        return t >= b.from.getTime() && t <= b.to.getTime();
      })
      .reduce((s, j) => s + j.totalAmount, 0),
  }));
}

// ─────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${["B", "KB", "MB", "GB"][i]}`;
}
