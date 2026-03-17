-- ============================================================================
-- SweepBot Audit Logs Migration
-- Generated: 2026-03-15
-- Creates audit_logs table consumed by apps/api/src/middleware/audit.ts
--
-- Column names match the INSERT statement in audit.ts exactly:
--   INSERT INTO audit_logs (user_id, action, client_ip, user_agent, status_code, timestamp)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action      VARCHAR(500) NOT NULL,
  client_ip   VARCHAR(45)  NOT NULL,
  user_agent  TEXT,
  status_code INTEGER      NOT NULL,
  timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- RLS: audit logs are internal — no user-facing access, service role only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_no_user_access" ON audit_logs USING (false);

-- Indexes for common query patterns (user history lookups, time-range scans)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp  ON audit_logs (timestamp DESC);
