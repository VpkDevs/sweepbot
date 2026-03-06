-- Migration: 14-Day Trial System
-- Description: Free trial tracking with lifecycle events
-- Part of Agent 2 Quick Wins features

-- Add trial columns to existing subscriptions table
ALTER TABLE subscriptions 
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS trial_converted BOOLEAN DEFAULT false;

-- Create index for trial expiration checks
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_expiring 
  ON subscriptions(trial_ends_at)
  WHERE status = 'trialing' AND trial_ends_at IS NOT NULL;

-- Trial lifecycle event tracking
CREATE TABLE IF NOT EXISTS trial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trial_started',
    'trial_reminder_sent',
    'trial_ending_soon',
    'trial_converted',
    'trial_expired',
    'trial_cancelled'
  )),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_events_user 
  ON trial_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_events_type 
  ON trial_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_events_created 
  ON trial_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE trial_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Users can read own trial events" 
  ON trial_events FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all trial events" 
  ON trial_events FOR ALL 
  USING (true);

-- Comments
COMMENT ON COLUMN subscriptions.trial_ends_at IS '14 days from trial start. NULL = no trial or trial already converted';
COMMENT ON COLUMN subscriptions.trial_converted IS 'True if trial successfully converted to paid subscription';
COMMENT ON TABLE trial_events IS 'Audit log for trial lifecycle events and email sends';
