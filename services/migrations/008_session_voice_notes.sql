-- Migration: Voice Notes for Sessions
-- Description: Audio recording with transcription for session annotations
-- Part of Agent 2 Quick Wins features

-- Add to existing session_notes table or create if doesn't exist
CREATE TABLE IF NOT EXISTS session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'text' CHECK (note_type IN ('text', 'voice', 'image')),
  audio_url TEXT,
  audio_duration INT,
  transcription_confidence DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_notes_session 
  ON session_notes(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_notes_user 
  ON session_notes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_notes_type 
  ON session_notes(note_type, created_at DESC);

-- Full-text search on transcribed content
CREATE INDEX IF NOT EXISTS idx_session_notes_content_search 
  ON session_notes USING gin(to_tsvector('english', content));

-- Enable Row Level Security
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only manage their own notes
CREATE POLICY IF NOT EXISTS "Users can manage own session notes" 
  ON session_notes FOR ALL 
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE session_notes IS 'Text and voice annotations for gaming sessions';
COMMENT ON COLUMN session_notes.audio_url IS 'Supabase Storage path to .webm audio file';
COMMENT ON COLUMN session_notes.transcription_confidence IS 'Speech-to-text confidence score (0.0-1.0)';
COMMENT ON COLUMN session_notes.content IS 'Transcribed text from voice note or original text input';
