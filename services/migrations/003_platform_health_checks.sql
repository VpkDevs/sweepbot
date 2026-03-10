-- Migration: Platform Health Checks Table
-- Description: 5-minute uptime checks with response time tracking
-- Data retention: 6 months (shorter retention, high volume)
-- Expected growth: ~4.3MB/day for 30 platforms = 130MB/month

CREATE TABLE IF NOT EXISTS platform_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'error')),
  avg_response_time_ms DECIMAL(10,2),
  endpoint_results JSONB NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_platform_health_platform_time 
  ON platform_health_checks(platform_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_health_status 
  ON platform_health_checks(status, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_health_checked 
  ON platform_health_checks(checked_at DESC);

-- Partial index for outages only (fast alerting queries)
CREATE INDEX IF NOT EXISTS idx_platform_health_outages 
  ON platform_health_checks(platform_id, checked_at DESC)
  WHERE status = 'down';

-- Partial index for degraded performance
CREATE INDEX IF NOT EXISTS idx_platform_health_degraded 
  ON platform_health_checks(platform_id, checked_at DESC)
  WHERE status = 'degraded';

-- Enable Row Level Security
ALTER TABLE platform_health_checks ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access
CREATE POLICY IF NOT EXISTS "Service role full access on platform_health_checks" 
  ON platform_health_checks FOR ALL 
  USING (true);

-- Policy: Authenticated users can read
CREATE POLICY IF NOT EXISTS "Authenticated users can read platform_health_checks" 
  ON platform_health_checks FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE platform_health_checks IS 'Platform uptime and response time checks every 5 minutes';
COMMENT ON COLUMN platform_health_checks.endpoint_results IS 'JSON object with results per endpoint: homepage, login, api';
COMMENT ON COLUMN platform_health_checks.avg_response_time_ms IS 'Average response time across all checked endpoints';
