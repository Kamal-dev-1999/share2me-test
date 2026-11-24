'use strict';

/**
 * Central runtime configuration contract.
 *
 * Historical note: different parts of the app used AUTH_JWT_SECRET, JWT_SECRET
 * and AUTH_SECRET for the same shared vendor-JWT. All of them are still
 * accepted so existing deployments keep working, but AUTH_JWT_SECRET is now
 * the canonical name. Set exactly one of them in every new deployment.
 *
 * This module never logs secret values — only which variable supplied one.
 */

const SHARED_SECRET_KEYS = ['AUTH_JWT_SECRET', 'JWT_SECRET', 'AUTH_SECRET'];
const DEV_PLACEHOLDER = 'placeholder_jwt_secret_local_dev_only';
let conflictWarned = false;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** Which shared-secret variables are set, and do they disagree? */
function inspectSharedSecrets() {
  const present = SHARED_SECRET_KEYS.filter((key) => !!process.env[key]);
  const distinctValues = new Set(present.map((key) => process.env[key]));
  const conflicting = distinctValues.size > 1;

  if (conflicting && !conflictWarned) {
    // Warn loudly once, but never print the values themselves.
    conflictWarned = true;
    console.error(
      '[Config] CRITICAL: shared JWT secret variables disagree. ' +
      `Set (${present.join(', ')}) to the same value. ` +
      'Frontend-signed vendor tokens will be rejected by the backend.'
    );
  }

  return {
    present,
    source: present[0] || null,
    conflicting,
  };
}

/** Resolve the secret used to sign/verify vendor and internal JWTs. */
function getSharedJwtSecret() {
  const { source, conflicting } = inspectSharedSecrets();

  if (source) {
    return process.env[source];
  }

  if (isProduction()) {
    throw new Error(
      '[FATAL] No shared JWT secret configured. Set AUTH_JWT_SECRET on both ' +
      'the frontend and backend (JWT_SECRET / AUTH_SECRET remain accepted aliases).'
    );
  }

  console.warn(
    '[Config] WARNING: no shared JWT secret set. Using an insecure development ' +
    'placeholder. Never use this outside local development.'
  );
  return DEV_PLACEHOLDER;
}

/**
 * Resolve the secret used by the admin-protected endpoints.
 * Admin historically used AUTH_SECRET; accept AUTH_JWT_SECRET as a fallback so
 * a single deployment secret can serve both purposes.
 */
function getAdminSecret() {
  const direct = process.env.AUTH_SECRET || process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if (direct) return direct;

  if (isProduction()) {
    throw new Error('[FATAL] AUTH_SECRET (or AUTH_JWT_SECRET) is missing.');
  }
  console.warn('[Config] WARNING: no admin secret set; using development placeholder.');
  return DEV_PLACEHOLDER;
}

/**
 * Validate required/recommended configuration at process boot.
 * Fails closed only on the two things the service cannot run without.
 * Returns a report that can be exposed on /health (without secret values).
 */
function validateRuntimeConfig(serviceName = 'backend') {
  const report = {
    service: serviceName,
    environment: process.env.NODE_ENV || 'development',
    ok: true,
    missing: [],
    warnings: [],
    sharedSecretSource: null,
  };

  const secrets = inspectSharedSecrets();
  report.sharedSecretSource = secrets.source;

  if (secrets.conflicting) {
    report.ok = false;
    report.warnings.push('shared JWT secret variables disagree');
  }
  if (!secrets.source) {
    if (isProduction()) {
      report.ok = false;
      report.missing.push('AUTH_JWT_SECRET (or JWT_SECRET / AUTH_SECRET)');
    } else {
      report.warnings.push('shared JWT secret missing; development placeholder in use');
    }
  }

  if (!process.env.DATABASE_URL) {
    if (isProduction()) {
      report.ok = false;
      report.missing.push('DATABASE_URL');
    } else {
      report.warnings.push('DATABASE_URL missing; DB-backed routes will fail');
    }
  }

  // Recommended in production — warn rather than crash so monitoring can report it.
  for (const key of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'ALLOWED_ORIGINS',
  ]) {
    if (isProduction() && !process.env[key]) {
      report.warnings.push(`${key} is not set`);
    }
  }

  if (isProduction() && !process.env.METRICS_TOKEN) {
    report.warnings.push('METRICS_TOKEN is not set; /metrics will be disabled');
  }

  if (isProduction() && !report.ok) {
    throw new Error(
      `[FATAL] Invalid ${serviceName} configuration. Missing: ${report.missing.join(', ')}`
    );
  }

  if (report.warnings.length) {
    console.warn(`[Config] ${serviceName} warnings:`, report.warnings.join(' | '));
  }

  return report;
}

module.exports = {
  DEV_PLACEHOLDER,
  getAdminSecret,
  getSharedJwtSecret,
  inspectSharedSecrets,
  isProduction,
  validateRuntimeConfig,
};
