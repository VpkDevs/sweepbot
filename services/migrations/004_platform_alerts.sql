-- Migration: Platform Alerts Table
-- Description: User-facing alerts for ToS changes, outages, and important events
-- Shared by multiple services (ToS monitor, health checker, jackpot analyzer)
-- Data retention: 90 days

CREATE TABLE IF NOT EXISTS platform_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'tos_change',
    'platform_outage',
    'slow_response',
    'jackpot_spike',
    'jackpot_won',
    'maintenance'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_alerts_platform 
  ON platform_alerts(platform_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_type 
  ON platform_alerts(alert_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_severity 
  ON platform_alerts(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_unresolved 
  ON platform_alerts(created_at DESC)
  WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_platform_alerts_created 
  ON platform_alerts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access
CREATE POLICY IF NOT EXISTS "Service role full access on platform_alerts" 
  ON platform_alerts FOR ALL 
  USING (true);

-- Policy: Authenticated users can read
CREATE POLICY IF NOT EXISTS "Authenticated users can read platform_alerts" 
  ON platform_alerts FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE platform_alerts IS 'System-generated alerts about platform events requiring user attention';
COMMENT ON COLUMN platform_alerts.metadata IS 'Additional context specific to alert type (diff for ToS, endpoint details for outage, etc.)';
COMMENT ON COLUMN platform_alerts.is_resolved IS 'Auto-set to true when issue is no longer active';
