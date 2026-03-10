-- Migration: Jackpot Snapshots Table with Quarterly Partitioning
-- Description: Stores progressive jackpot values captured every 60 seconds
-- Data retention: Indefinite (core data moat)
-- Expected growth: ~21MB/day for 30 platforms = 630MB/month

-- Main partitioned table
CREATE TABLE IF NOT EXISTS jackpot_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  jackpot_type TEXT NOT NULL CHECK (jackpot_type IN ('mega', 'major', 'minor', 'mini', 'progressive', 'mystery', 'daily', 'hourly')),
  current_value DECIMAL(12,2) NOT NULL CHECK (current_value >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB,
  snapshot_hash TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (captured_at);

-- Create quarterly partitions for 2025-2026
CREATE TABLE IF NOT EXISTS jackpot_snapshots_2025_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2025_q2 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2025_q3 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2025_q4 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2026_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2026_q2 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2026_q3 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS jackpot_snapshots_2026_q4 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_jackpot_snapshots_platform_time 
  ON jackpot_snapshots(platform_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_jackpot_snapshots_type_time 
  ON jackpot_snapshots(jackpot_type, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_jackpot_snapshots_hash 
  ON jackpot_snapshots(snapshot_hash);

CREATE INDEX IF NOT EXISTS idx_jackpot_snapshots_value 
  ON jackpot_snapshots(current_value DESC, captured_at DESC);

-- Enable Row Level Security
ALTER TABLE jackpot_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything (needed for Replit services)
CREATE POLICY IF NOT EXISTS "Service role full access on jackpot_snapshots" 
  ON jackpot_snapshots FOR ALL 
  USING (true);

-- Policy: Authenticated users can read
CREATE POLICY IF NOT EXISTS "Authenticated users can read jackpot_snapshots" 
  ON jackpot_snapshots FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Comments for documentation
COMMENT ON TABLE jackpot_snapshots IS 'Progressive jackpot values captured every 60 seconds. Partitioned quarterly for performance.';
COMMENT ON COLUMN jackpot_snapshots.snapshot_hash IS 'SHA-256 hash of platform_id + jackpot_type + current_value for deduplication';
COMMENT ON COLUMN jackpot_snapshots.metadata IS 'Additional platform-specific data (game name, progressive pool, etc.)';
