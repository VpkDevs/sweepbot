-- ============================================================================
-- SweepBot Gap Analysis Migration
-- Generated: 2026-03-09
-- Implements: all CRITICAL and HIGH severity items from docs/GAP_ANALYSIS.md
--
-- RUN ORDER: Execute this entire script in one transaction against Supabase.
-- All new tables have RLS ENABLED and default-deny policies.
-- ============================================================================

BEGIN;

-- ── 1. trust_index_scores ────────────────────────────────────────────────────
-- Computed Trust Index scores per platform per recalculation run.
CREATE TABLE IF NOT EXISTS trust_index_scores (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id                     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  overall_score                   NUMERIC(5, 2) NOT NULL,
  redemption_speed_score          NUMERIC(5, 2) NOT NULL DEFAULT 50,
  redemption_rejection_rate_score NUMERIC(5, 2) NOT NULL DEFAULT 50,
  tos_stability_score             NUMERIC(5, 2) NOT NULL DEFAULT 100,
  bonus_generosity_score          NUMERIC(5, 2) NOT NULL DEFAULT 50,
  community_satisfaction_score    NUMERIC(5, 2) NOT NULL DEFAULT 50,
  support_responsiveness_score    NUMERIC(5, 2) NOT NULL DEFAULT 50,
  regulatory_standing_score       NUMERIC(5, 2) NOT NULL DEFAULT 75,
  sample_size                     INTEGER DEFAULT 0,
  calculated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trust_index_scores_platform_time_idx
  ON trust_index_scores (platform_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS trust_index_scores_score_idx
  ON trust_index_scores (overall_score DESC);

ALTER TABLE trust_index_scores ENABLE ROW LEVEL SECURITY;
-- Trust scores are public-read (no auth required) but only writable by service role
CREATE POLICY "trust_index_scores_public_read"
  ON trust_index_scores FOR SELECT USING (true);

-- ── 2. trust_index_alerts ────────────────────────────────────────────────────
-- User alert subscriptions for Trust Index score changes.
CREATE TABLE IF NOT EXISTS trust_index_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id         UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  threshold_direction VARCHAR(10) NOT NULL DEFAULT 'any',  -- 'above' | 'below' | 'any'
  threshold_score     NUMERIC(5, 2),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_count       INTEGER NOT NULL DEFAULT 0,
  last_triggered_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform_id)
);

CREATE INDEX IF NOT EXISTS trust_index_alerts_user_idx ON trust_index_alerts (user_id);
CREATE INDEX IF NOT EXISTS trust_index_alerts_platform_idx ON trust_index_alerts (platform_id);

ALTER TABLE trust_index_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_index_alerts_own"
  ON trust_index_alerts USING (user_id = auth.uid());

-- ── 3. platform_ratings ──────────────────────────────────────────────────────
-- Community star ratings (1–5) per user per platform.
CREATE TABLE IF NOT EXISTS platform_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review      VARCHAR(1000),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform_id)
);

CREATE INDEX IF NOT EXISTS platform_ratings_platform_idx ON platform_ratings (platform_id);
CREATE INDEX IF NOT EXISTS platform_ratings_created_at_idx ON platform_ratings (created_at DESC);

ALTER TABLE platform_ratings ENABLE ROW LEVEL SECURITY;
-- Ratings are public-read; users can only write/update their own
CREATE POLICY "platform_ratings_public_read"  ON platform_ratings FOR SELECT USING (true);
CREATE POLICY "platform_ratings_own_write"    ON platform_ratings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "platform_ratings_own_update"   ON platform_ratings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "platform_ratings_own_delete"   ON platform_ratings FOR DELETE USING (user_id = auth.uid());

-- ── 4. platform_bonuses ──────────────────────────────────────────────────────
-- Community-reported bonus wagering requirements.
CREATE TABLE IF NOT EXISTS platform_bonuses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id          UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_type           VARCHAR(50),
  bonus_amount         NUMERIC(12, 2) NOT NULL,
  wagering_requirement NUMERIC(12, 2) NOT NULL,
  currency             VARCHAR(10) DEFAULT 'SC',
  notes                VARCHAR(500),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_bonuses_platform_idx ON platform_bonuses (platform_id);
CREATE INDEX IF NOT EXISTS platform_bonuses_created_at_idx ON platform_bonuses (created_at DESC);

ALTER TABLE platform_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_bonuses_public_read" ON platform_bonuses FOR SELECT USING (true);
CREATE POLICY "platform_bonuses_own_write"   ON platform_bonuses FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 5. platform_community_signals ───────────────────────────────────────────
-- Sentiment votes used for community analytics and trust signals.
CREATE TABLE IF NOT EXISTS platform_community_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sentiment   VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  category    VARCHAR(50) NOT NULL CHECK (category IN ('redemption', 'support', 'bonus', 'fairness', 'general')),
  comment     VARCHAR(500),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  -- One vote per user per platform per day per category
  UNIQUE (platform_id, user_id, category, DATE(created_at))
);

CREATE INDEX IF NOT EXISTS platform_community_signals_platform_idx ON platform_community_signals (platform_id);
CREATE INDEX IF NOT EXISTS platform_community_signals_created_at_idx ON platform_community_signals (created_at DESC);

ALTER TABLE platform_community_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_community_signals_public_read" ON platform_community_signals FOR SELECT USING (true);
CREATE POLICY "platform_community_signals_own_write"   ON platform_community_signals FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 6. game_providers ────────────────────────────────────────────────────────
-- Software providers (NetEnt, Pragmatic Play, etc.)
CREATE TABLE IF NOT EXISTS game_providers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(100) NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL,
  logo_url   VARCHAR(500),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_providers_slug_idx ON game_providers (slug);

ALTER TABLE game_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_providers_public_read" ON game_providers FOR SELECT USING (true);

-- ── 7. redemptions ───────────────────────────────────────────────────────────
-- Sweeps Coin redemption requests with full lifecycle tracking.
CREATE TABLE IF NOT EXISTS redemptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id           UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  amount_sc             NUMERIC(12, 4) NOT NULL,
  amount_usd            NUMERIC(12, 2),
  payment_method        VARCHAR(100),
  status                VARCHAR(30) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,       -- When funds actually arrived (replaces old received_at)
  rejected_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  rejection_reason      TEXT,
  external_reference_id VARCHAR(255),
  notes                 TEXT,
  consent_to_share      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS redemptions_user_idx             ON redemptions (user_id);
CREATE INDEX IF NOT EXISTS redemptions_platform_idx         ON redemptions (platform_id);
CREATE INDEX IF NOT EXISTS redemptions_status_idx           ON redemptions (status);
CREATE INDEX IF NOT EXISTS redemptions_submitted_at_idx     ON redemptions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_completed_at_idx     ON redemptions (completed_at DESC);
-- Composite for Trust Index scoring queries
CREATE INDEX IF NOT EXISTS redemptions_platform_status_idx  ON redemptions (platform_id, status, submitted_at DESC);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions_own" ON redemptions USING (user_id = auth.uid());

-- ── 8. tos_snapshots: add missing change-detection columns ──────────────────
-- These columns are queried by trust.ts (tos_stability scoring) and
-- platforms.ts (tos-history endpoint) but were absent from the schema.
ALTER TABLE tos_snapshots
  ADD COLUMN IF NOT EXISTS changes_detected  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS change_severity   TEXT,
  ADD COLUMN IF NOT EXISTS change_summary    TEXT,
  ADD COLUMN IF NOT EXISTS affected_sections TEXT[];

CREATE INDEX IF NOT EXISTS idx_tos_snapshots_changes
  ON tos_snapshots (changes_detected, captured_at DESC);

-- ── 9. sessions: add missing durationSeconds + metadata columns ─────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}';

-- ── 10. jackpot_snapshots: add missing fields, rename value→amount ───────────
-- Rename if column still called 'value' (idempotent guard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jackpot_snapshots' AND column_name = 'value'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jackpot_snapshots' AND column_name = 'amount'
  ) THEN
    ALTER TABLE jackpot_snapshots RENAME COLUMN value TO amount;
  END IF;
END;
$$;

ALTER TABLE jackpot_snapshots
  ADD COLUMN IF NOT EXISTS jackpot_name    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_hit_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_hit_amount NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS jackpot_snapshots_platform_game_idx
  ON jackpot_snapshots (platform_id, game_id);

-- ── 11. games: add missing fields queried by platforms.ts ───────────────────
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS provider_id      UUID,
  ADD COLUMN IF NOT EXISTS thumbnail_url    TEXT,
  ADD COLUMN IF NOT EXISTS is_featured      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS jackpot_eligible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS release_date     DATE;

COMMIT;
