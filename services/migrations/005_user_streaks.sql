-- Migration: User Streaks System
-- Description: Daily activity streak tracking for gamification
-- Part of Agent 2 Quick Wins features

CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL UNIQUE,
  current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INT NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_activity_date DATE,
  freeze_credits INT NOT NULL DEFAULT 0 CHECK (freeze_credits >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Streak milestones achievement tracking
CREATE TABLE IF NOT EXISTS streak_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  milestone INT NOT NULL CHECK (milestone IN (7, 30, 100, 365)),
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, milestone)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_streaks_user 
  ON user_streaks(user_id);

CREATE INDEX IF NOT EXISTS idx_user_streaks_longest 
  ON user_streaks(longest_streak DESC);

CREATE INDEX IF NOT EXISTS idx_user_streaks_current 
  ON user_streaks(current_streak DESC);

CREATE INDEX IF NOT EXISTS idx_streak_milestones_user 
  ON streak_milestones(user_id, milestone DESC);

CREATE INDEX IF NOT EXISTS idx_streak_milestones_achieved 
  ON streak_milestones(achieved_at DESC);

-- Enable Row Level Security
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_milestones ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own streaks
CREATE POLICY IF NOT EXISTS "Users can read own streak" 
  ON user_streaks FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own streak" 
  ON user_streaks FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all streaks" 
  ON user_streaks FOR ALL 
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can read own milestones" 
  ON streak_milestones FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all milestones" 
  ON streak_milestones FOR ALL 
  USING (true);

-- Comments
COMMENT ON TABLE user_streaks IS 'Daily activity streak tracking for user engagement gamification';
COMMENT ON COLUMN user_streaks.freeze_credits IS 'Pro users get 3/month to protect streaks from breaking';
COMMENT ON TABLE streak_milestones IS 'Achievement tracking for 7, 30, 100, and 365 day milestones';
