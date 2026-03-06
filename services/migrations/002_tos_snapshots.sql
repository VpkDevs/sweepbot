-- Migration: Terms of Service Snapshots Table
-- Description: Daily snapshots of platform ToS for change tracking
-- Data retention: 24 months (legal protection + Trust Index)
-- Expected growth: ~50KB/platform/day = 1.5MB/day for 30 platforms

CREATE TABLE IF NOT EXISTS tos_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  url TEXT,
  selector_used TEXT,
  word_count INT,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tos_snapshots_platform_time 
  ON tos_snapshots(platform_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_tos_snapshots_hash 
  ON tos_snapshots(content_hash);

CREATE INDEX IF NOT EXISTS idx_tos_snapshots_captured 
  ON tos_snapshots(captured_at DESC);

-- Full-text search index for content analysis
CREATE INDEX IF NOT EXISTS idx_tos_snapshots_content_search 
  ON tos_snapshots USING gin(to_tsvector('english', content_text));

-- Enable Row Level Security
ALTER TABLE tos_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access
CREATE POLICY IF NOT EXISTS "Service role full access on tos_snapshots" 
  ON tos_snapshots FOR ALL 
  USING (true);

-- Policy: Authenticated users can read
CREATE POLICY IF NOT EXISTS "Authenticated users can read tos_snapshots" 
  ON tos_snapshots FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE tos_snapshots IS 'Daily snapshots of platform Terms of Service for historical tracking and change detection';
COMMENT ON COLUMN tos_snapshots.content_hash IS 'SHA-256 hash of content_text for quick change detection';
COMMENT ON COLUMN tos_snapshots.selector_used IS 'CSS selector used to extract ToS content';
