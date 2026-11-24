/**
 * Shared secret used to sign the vendor JWT consumed by the Express backend.
 *
 * AUTH_JWT_SECRET is canonical. AUTH_SECRET is still accepted because the
 * NextAuth configuration already uses it, and JWT_SECRET is a legacy alias on
 * the backend. Keeping all three resolvable prevents a redeploy from silently
 * invalidating every vendor dashboard session.
 *
 * Server-side only: this file must never be imported into client components.
 */

const DEV_PLACEHOLDER = "placeholder_jwt_secret_local_dev_only";

export function getSharedJwtSecret(): string {
  const canonical = process.env.AUTH_JWT_SECRET;
  const legacy = process.env.JWT_SECRET;
  const nextAuth = process.env.AUTH_SECRET;

  if (
    process.env.NODE_ENV === "production" &&
    canonical &&
    nextAuth &&
    canonical !== nextAuth
  ) {
    console.warn(
      "[Config] AUTH_JWT_SECRET and AUTH_SECRET differ. The backend and " +
        "frontend must resolve the same value for vendor auth to work.",
    );
  }

  const secret = canonical || legacy || nextAuth;
  if (secret) return secret;

  if (
    process.env.NODE_ENV === "production" &&
    !process.env.DOCKER_BUILD &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "[FATAL] No shared JWT secret configured. Set AUTH_JWT_SECRET on both " +
        "the frontend and backend.",
    );
  }

  console.warn(
    "[Config] No shared JWT secret set; using insecure development placeholder.",
  );
  return DEV_PLACEHOLDER;
}
