-- Migration: Personal Records System
-- Description: Track user's personal bests across gaming sessions
-- Part of Agent 2 Quick Wins features

CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  record_type VARCHAR(50) NOT NULL CHECK (record_type IN (
    'biggest_win', 'highest_rtp', 'longest_session', 
    'most_spins', 'biggest_profit', 'fastest_bonus'
  )),
  value DECIMAL(12,2) NOT NULL CHECK (value >= 0),
  session_id UUID,
  platform_id UUID,
  game_name VARCHAR(255),
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, record_type)
);

-- Session records summary for quick access
CREATE TABLE IF NOT EXISTS session_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  session_id UUID NOT NULL,
  records_broken TEXT[] DEFAULT '{}',
  new_records_count INT DEFAULT 0,
  session_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personal_records_user 
  ON personal_records(user_id, record_type);

CREATE INDEX IF NOT EXISTS idx_personal_records_value 
  ON personal_records(record_type, value DESC);

CREATE INDEX IF NOT EXISTS idx_personal_records_achieved 
  ON personal_records(achieved_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_records_user_date 
  ON session_records(user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_session_records_count 
  ON session_records(new_records_count DESC);

-- Enable Row Level Security
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own records
CREATE POLICY IF NOT EXISTS "Users can read own records" 
  ON personal_records FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own records" 
  ON personal_records FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all records" 
  ON personal_records FOR ALL 
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can read own session records" 
  ON session_records FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all session records" 
  ON session_records FOR ALL 
  USING (true);

-- Comments
COMMENT ON TABLE personal_records IS 'User personal bests tracking across all gaming sessions';
COMMENT ON COLUMN personal_records.metadata IS 'Additional context like platform, game, conditions when record was set';
COMMENT ON TABLE session_records IS 'Summary of records broken per session for achievement notifications';