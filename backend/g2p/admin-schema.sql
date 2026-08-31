-- PostgreSQL Schema for Share2Me Blog Admin Portal

-- 1. Admin Blogs Table
CREATE TABLE IF NOT EXISTS admin_blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  meta_description TEXT,
  keywords TEXT[] DEFAULT '{}',
  author TEXT DEFAULT 'Share2Me Team',
  featured_image TEXT,
  canonical_url TEXT,
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  html_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'publishing', 'published', 'failed', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- 2. Publishing Records Table (Tracks target destinations like share2.me & share2me.in)
CREATE TABLE IF NOT EXISTS admin_publishing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES admin_blogs(id) ON DELETE CASCADE,
  destination VARCHAR(50) NOT NULL, -- 'share2me', 'share2me_in'
  status VARCHAR(20) NOT NULL, -- 'published', 'failed', 'publishing'
  published_url TEXT,
  error_message TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Blog Revisions Table (Version control and rollback)
CREATE TABLE IF NOT EXISTS admin_blog_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES admin_blogs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  metadata_snapshot JSONB NOT NULL,
  created_by TEXT NOT NULL, -- admin email
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Admin Activity Logs Table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'CREATE_DRAFT', 'PUBLISH_BLOG', 'RESTORE_REVISION', 'DELETE_BLOG'
  blog_title TEXT,
  destination TEXT,
  status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'WARNING'
  error_details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performant querying
CREATE INDEX IF NOT EXISTS idx_admin_blogs_slug ON admin_blogs(slug);
CREATE INDEX IF NOT EXISTS idx_admin_blogs_status ON admin_blogs(status);
CREATE INDEX IF NOT EXISTS idx_admin_publishing_records_blog ON admin_publishing_records(blog_id);
CREATE INDEX IF NOT EXISTS idx_admin_revisions_blog ON admin_blog_revisions(blog_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_email ON admin_activity_logs(admin_email, timestamp DESC);
