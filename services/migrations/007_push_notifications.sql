-- Migration: Push Notifications System
-- Description: Web Push subscription management and preferences
-- Part of Agent 2 Quick Wins features

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  jackpot_alerts BOOLEAN DEFAULT true,
  tos_changes BOOLEAN DEFAULT true,
  platform_outages BOOLEAN DEFAULT true,
  flow_errors BOOLEAN DEFAULT true,
  trial_reminders BOOLEAN DEFAULT true,
  daily_summary BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
  ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
  ON push_subscriptions(endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active 
  ON push_subscriptions(user_id, is_active)
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies: Users manage their own subscriptions
CREATE POLICY IF NOT EXISTS "Users can manage own push subscriptions" 
  ON push_subscriptions FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage own notification preferences" 
  ON notification_preferences FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can read all subscriptions" 
  ON push_subscriptions FOR SELECT 
  USING (true);

-- Comments
COMMENT ON TABLE push_subscriptions IS 'Web Push API subscription endpoints per user device';
COMMENT ON COLUMN push_subscriptions.keys IS 'VAPID keys: { p256dh, auth }';
COMMENT ON COLUMN push_subscriptions.is_active IS 'False if subscription returned 410 Gone (expired)';
COMMENT ON TABLE notification_preferences IS 'User preferences for which alert types to receive';
