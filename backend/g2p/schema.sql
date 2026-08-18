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
  subscription_ends_at TIMESTAMPTZ,

  -- User tiering / profile (v3.5)
  persona VARCHAR(20) DEFAULT 'PERSONAL',
  persona_selected BOOLEAN DEFAULT false,
  plan_type VARCHAR(20) DEFAULT 'FREE',
  phone TEXT,
  company TEXT,
  website TEXT,
  bio TEXT,

  -- Stripe Connect (Print Shop Payments)
  stripe_account_id TEXT,
  charges_enabled BOOLEAN DEFAULT false,
  price_per_page_bw NUMERIC(10, 2),
  price_per_page_color NUMERIC(10, 2),

  -- Print Agent
  print_agent_token UUID UNIQUE DEFAULT gen_random_uuid()
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

-- Stripe Connect (Print Shop Payments)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS charges_enabled BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_per_page_bw NUMERIC(10, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_per_page_color NUMERIC(10, 2);

-- Print Shop Jobs Table
CREATE TABLE IF NOT EXISTS printshop_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  pages INTEGER NOT NULL,
  print_type TEXT NOT NULL, -- 'bw' or 'color'
  price_per_page NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'online' or 'cash'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
  payment_id TEXT, -- Razorpay Payment ID or Stripe ID
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'printing', 'printed', 'cancelled'
  r2_key TEXT, -- physical file in S3/R2
  printer_name TEXT,
  print_error TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_printshop_jobs_vendor ON printshop_jobs(vendor_id, created_at DESC);
ALTER TABLE printshop_jobs ADD COLUMN IF NOT EXISTS r2_key TEXT;
ALTER TABLE printshop_jobs ADD COLUMN IF NOT EXISTS printer_name TEXT;
ALTER TABLE printshop_jobs ADD COLUMN IF NOT EXISTS print_error TEXT;
ALTER TABLE printshop_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Print Agent Token
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS print_agent_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Print Shop Settings Table
CREATE TABLE IF NOT EXISTS printshop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  bw_price NUMERIC(10, 2) DEFAULT 2.00,
  color_price NUMERIC(10, 2) DEFAULT 10.00,
  location_name TEXT,
  qr_r2_key TEXT,
  is_accepting BOOLEAN DEFAULT true,
  retention_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Razorpay Fields
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;

-- Print Shop Data Retention
ALTER TABLE printshop_settings ADD COLUMN IF NOT EXISTS retention_hours INTEGER DEFAULT 24;
