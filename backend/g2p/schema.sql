-- Phase 0: G2P Schema Definitions (PostgreSQL)

-- Enums
CREATE TYPE request_status AS ENUM ('pending', 'processing', 'completed', 'expired');
CREATE TYPE file_status AS ENUM ('pending_upload', 'received', 'downloaded', 'deleted');

-- Vendors Table
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  share2me_id TEXT UNIQUE NOT NULL, -- The 6-char permanent ID (e.g. "X7Y2M9")
  accepting_requests BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  auth_provider_id TEXT UNIQUE, -- e.g. "google-oauth2|12345"
  email TEXT, -- used to prefill Stripe Checkout

  -- Stripe subscription state (written by g2p/routes/webhooks.js)
  subscription_tier TEXT DEFAULT 'free',      -- 'free' | 'pro'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,                   -- Stripe status: trialing/active/past_due/canceled…
  subscription_ends_at TIMESTAMPTZ
);

-- Requests Table
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  status request_status DEFAULT 'pending',
  status_token UUID UNIQUE DEFAULT gen_random_uuid(), -- Anonymous tracking token for students
  device_metadata JSONB, -- iOS/Android, browser, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  deleted_at TIMESTAMPTZ -- Soft delete for UI, Hard deleted by janitor
);

-- Files Table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT UNIQUE NOT NULL,
  status file_status DEFAULT 'pending_upload',
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_requests_vendor_status ON requests(vendor_id, status);
CREATE INDEX idx_requests_status_token ON requests(status_token);
CREATE INDEX idx_files_request ON files(request_id);
CREATE INDEX idx_files_status_pending ON files(status) WHERE status = 'pending_upload';

-- ─────────────────────────────────────────────────────────────
-- Migration for EXISTING databases (idempotent) — Stripe billing
-- columns used by routes/billing.js and routes/webhooks.js.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is a no-op when present.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
