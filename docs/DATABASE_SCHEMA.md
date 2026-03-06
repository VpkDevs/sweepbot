# SweepBot — Database Schema

**Database:** PostgreSQL 16 (Supabase)
**Version:** 1.0.0

---

## Overview

All user data is protected by Row Level Security (RLS). Public/aggregate data is accessible without authentication. The schema is designed to scale to 1B+ transaction records via monthly partitioning.

---

## Migration: 001_initial_schema.sql

```sql
-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro', 'analyst', 'elite', 'lifetime');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'paused');
CREATE TYPE session_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE redemption_status AS ENUM ('pending', 'processing', 'approved', 'rejected', 'received', 'cancelled');
CREATE TYPE payment_method AS ENUM ('paypal', 'check', 'ach', 'venmo', 'cashapp', 'giftcard', 'crypto', 'other');
CREATE TYPE volatility_class AS ENUM ('low', 'medium', 'high', 'very_high');
CREATE TYPE platform_status AS ENUM ('active', 'inactive', 'suspended', 'closed');

-- =============================================================================
-- PROFILES (extends Supabase auth.users)
-- =============================================================================

CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  display_name   TEXT,
  avatar_url     TEXT,
  bio            TEXT,
  tier           subscription_tier NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT UNIQUE,
  timezone       TEXT NOT NULL DEFAULT 'America/New_York',
  locale         TEXT NOT NULL DEFAULT 'en-US',
  onboarded_at   TIMESTAMPTZ,
  last_seen_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE subscriptions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id   TEXT UNIQUE,
  stripe_price_id          TEXT,
  tier                     subscription_tier NOT NULL DEFAULT 'free',
  status                   subscription_status NOT NULL DEFAULT 'active',
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- =============================================================================
-- PLATFORMS
-- =============================================================================

CREATE TABLE platforms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT NOT NULL UNIQUE,           -- e.g. 'chumba-casino'
  name            TEXT NOT NULL,                  -- e.g. 'Chumba Casino'
  display_name    TEXT NOT NULL,
  url             TEXT NOT NULL,
  affiliate_url   TEXT,
  logo_url        TEXT,
  description     TEXT,
  founded_year    INTEGER,
  status          platform_status NOT NULL DEFAULT 'active',
  country_codes   TEXT[] NOT NULL DEFAULT '{"US"}',  -- Supported countries
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platforms_slug ON platforms(slug);
CREATE INDEX idx_platforms_status ON platforms(status);

-- =============================================================================
-- USER_PLATFORMS (tracked platforms per user)
-- =============================================================================

CREATE TABLE user_platforms (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id      UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  nickname         TEXT,           -- User's custom name for the account
  added_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at   TIMESTAMPTZ,
  UNIQUE(user_id, platform_id)
);

-- =============================================================================
-- FLOWS (automation definitions)
-- =============================================================================

CREATE TABLE flows (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,           -- original natural language
  definition       JSONB NOT NULL,           -- parsed FlowDefinition AST
  trigger          JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  version          INTEGER NOT NULL DEFAULT 1,
  guardrails       JSONB NOT NULL,           -- Responsible play limits
  is_shared        BOOLEAN NOT NULL DEFAULT FALSE,
  shared_flow_id   UUID REFERENCES shared_flows(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_executed_at TIMESTAMPTZ,
  execution_count  INTEGER NOT NULL DEFAULT 0,
  performance_stats JSONB
);

CREATE TABLE flow_conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow_id       UUID REFERENCES flows(id) ON DELETE SET NULL,
  turns         JSONB NOT NULL,                -- ConversationTurn[]
  status        TEXT NOT NULL,                 -- building, confirming, complete
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE flow_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own conversations" ON flow_conversations FOR ALL USING (auth.uid() = user_id);


ALTER TABLE user_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own platform connections" ON user_platforms FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_user_platforms_user ON user_platforms(user_id);
CREATE INDEX idx_user_platforms_platform ON user_platforms(platform_id);

-- =============================================================================
-- GAME PROVIDERS
-- =============================================================================

CREATE TABLE game_providers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  website      TEXT,
  logo_url     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- GAMES
-- =============================================================================

CREATE TABLE games (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id        UUID REFERENCES game_providers(id),
  external_game_id   TEXT,    -- Platform's internal game ID
  platform_id        UUID REFERENCES platforms(id),
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  thumbnail_url      TEXT,
  theoretical_rtp    NUMERIC(5,2),   -- e.g. 96.50 (%)
  volatility_class   volatility_class,
  min_bet            NUMERIC(10,2),
  max_bet            NUMERIC(10,2),
  max_win_multiplier INTEGER,
  has_bonus_round    BOOLEAN NOT NULL DEFAULT FALSE,
  has_free_spins     BOOLEAN NOT NULL DEFAULT FALSE,
  has_jackpot        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_platform ON games(platform_id);
CREATE INDEX idx_games_provider ON games(provider_id);
CREATE INDEX idx_games_slug ON games(slug);

-- =============================================================================
-- SESSIONS
-- =============================================================================

CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id      UUID NOT NULL REFERENCES platforms(id),
  game_id          UUID REFERENCES games(id),
  status           session_status NOT NULL DEFAULT 'active',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  opening_balance  NUMERIC(12,2),
  closing_balance  NUMERIC(12,2),
  total_wagered    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_won        NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_result       NUMERIC(12,2) GENERATED ALWAYS AS (total_won - total_wagered) STORED,
  rtp              NUMERIC(7,4),    -- e.g. 0.9650 = 96.50%
  spin_count       INTEGER NOT NULL DEFAULT 0,
  bonus_triggers   INTEGER NOT NULL DEFAULT 0,
  largest_win      NUMERIC(12,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_platform ON sessions(platform_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- =============================================================================
-- TRANSACTIONS (HIGH VOLUME — PARTITIONED)
-- =============================================================================

CREATE TABLE transactions (
  id             UUID NOT NULL DEFAULT uuid_generate_v4(),
  session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL,     -- denormalized for RLS without join
  platform_id    UUID NOT NULL,     -- denormalized for fast queries
  game_id        UUID,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  bet_amount     NUMERIC(10,2) NOT NULL,
  win_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_after  NUMERIC(12,2),
  is_bonus_spin  BOOLEAN NOT NULL DEFAULT FALSE,
  is_bonus_trigger BOOLEAN NOT NULL DEFAULT FALSE,
  is_jackpot     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create initial partitions
CREATE TABLE transactions_2026_01 PARTITION OF transactions
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE transactions_2026_02 PARTITION OF transactions
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE transactions_2026_03 PARTITION OF transactions
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_session ON transactions(session_id, occurred_at DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, occurred_at DESC);

-- =============================================================================
-- JACKPOT SNAPSHOTS (TIME SERIES)
-- =============================================================================

CREATE TABLE jackpot_snapshots (
  id           UUID NOT NULL DEFAULT uuid_generate_v4(),
  platform_id  UUID NOT NULL REFERENCES platforms(id),
  game_id      UUID REFERENCES games(id),
  game_slug    TEXT,    -- denormalized for games not yet in DB
  value        NUMERIC(14,2) NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

CREATE TABLE jackpot_snapshots_2026_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE jackpot_snapshots_2026_q2 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE INDEX idx_jackpot_game_time ON jackpot_snapshots(game_id, captured_at DESC);
CREATE INDEX idx_jackpot_platform_time ON jackpot_snapshots(platform_id, captured_at DESC);

-- =============================================================================
-- REDEMPTIONS
-- =============================================================================

CREATE TABLE redemptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id         UUID NOT NULL REFERENCES platforms(id),
  requested_at        TIMESTAMPTZ NOT NULL,
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  amount_sc           NUMERIC(12,2),    -- Sweep Coins amount
  amount_usd          NUMERIC(10,2),    -- USD equivalent
  payment_method      payment_method,
  status              redemption_status NOT NULL DEFAULT 'pending',
  rejection_reason    TEXT,
  processing_days     INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (received_at - requested_at))::INTEGER
  ) STORED,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own redemptions" ON redemptions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_redemptions_user ON redemptions(user_id, requested_at DESC);
CREATE INDEX idx_redemptions_platform ON redemptions(platform_id);

-- =============================================================================
-- TRUST INDEX SCORES
-- =============================================================================

CREATE TABLE trust_index_scores (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id          UUID NOT NULL REFERENCES platforms(id),
  score                NUMERIC(5,2) NOT NULL,    -- 0-100
  redemption_score     NUMERIC(5,2),             -- Component scores
  rejection_score      NUMERIC(5,2),
  tos_stability_score  NUMERIC(5,2),
  community_score      NUMERIC(5,2),
  support_score        NUMERIC(5,2),
  longevity_score      NUMERIC(5,2),
  bonus_score          NUMERIC(5,2),
  data_points          INTEGER NOT NULL DEFAULT 0,
  calculated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version              TEXT NOT NULL DEFAULT '1.0'
);

CREATE INDEX idx_trust_platform ON trust_index_scores(platform_id, calculated_at DESC);

-- =============================================================================
-- TOS SNAPSHOTS
-- =============================================================================

CREATE TABLE tos_snapshots (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id       UUID NOT NULL REFERENCES platforms(id),
  url               TEXT NOT NULL,
  content_hash      TEXT NOT NULL,
  content           TEXT,          -- Full text (can be large)
  changes_detected  BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary    TEXT,          -- AI-generated plain-English diff summary
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tos_platform_time ON tos_snapshots(platform_id, captured_at DESC);

-- =============================================================================
-- PLATFORM UPTIME LOGS
-- =============================================================================

CREATE TABLE platform_uptime_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id      UUID NOT NULL REFERENCES platforms(id),
  is_up            BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  status_code      INTEGER,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uptime_platform_time ON platform_uptime_logs(platform_id, checked_at DESC);

-- =============================================================================
-- USER SETTINGS
-- =============================================================================

CREATE TABLE user_settings (
  user_id                    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Notifications
  notify_jackpot_alerts       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_tos_changes          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_redemption_updates   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_weekly_summary       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_bonus_alerts         BOOLEAN NOT NULL DEFAULT FALSE,
  -- Responsible Play
  session_time_limit_mins     INTEGER,
  daily_loss_limit_usd        NUMERIC(10,2),
  weekly_loss_limit_usd       NUMERIC(10,2),
  cooldown_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Display
  currency_display            TEXT NOT NULL DEFAULT 'USD',
  theme                       TEXT NOT NULL DEFAULT 'dark',
  dashboard_layout            JSONB,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

-- Auto-create settings row on profile creation
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  INSERT INTO subscriptions (user_id, tier, status) VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON redemptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Seed Data

### Platform Seed (002_seed_platforms.sql)

```sql
INSERT INTO platforms (slug, name, display_name, url, affiliate_url, status) VALUES
  ('chumba-casino',       'Chumba Casino',       'Chumba Casino',       'https://www.chumbacasino.com',      NULL, 'active'),
  ('luckylandslots',      'LuckyLand Slots',     'LuckyLand Slots',     'https://www.luckylandslots.com',    NULL, 'active'),
  ('stake-us',            'Stake.us',            'Stake.us',            'https://stake.us',                  NULL, 'active'),
  ('pulsz',               'Pulsz',               'Pulsz Casino',        'https://www.pulsz.com',             NULL, 'active'),
  ('wow-vegas',           'WOW Vegas',           'WOW Vegas',           'https://wowvegas.com',              NULL, 'active'),
  ('fortune-coins',       'Fortune Coins',       'Fortune Coins',       'https://fortunecoins.com',          NULL, 'active'),
  ('funrize',             'Funrize',             'Funrize',             'https://funrize.com',               NULL, 'active'),
  ('zula-casino',         'Zula Casino',         'Zula Casino',         'https://www.zulacasino.com',        NULL, 'active'),
  ('crown-coins-casino',  'Crown Coins Casino',  'Crown Coins Casino',  'https://crowncoins.com',            NULL, 'active'),
  ('mcluck',              'McLuck',              'McLuck',              'https://mcluck.com',                NULL, 'active'),
  ('nolimitcoins',        'NoLimitCoins',        'NoLimitCoins',        'https://nolimitcoins.com',          NULL, 'active'),
  ('modo-casino',         'Modo Casino',         'Modo Casino',         'https://modo.us',                   NULL, 'active'),
  ('sweeptastic',         'Sweeptastic',         'Sweeptastic',         'https://sweeptastic.com',           NULL, 'active'),
  ('global-poker',        'Global Poker',        'Global Poker',        'https://www.globalpoker.com',       NULL, 'active'),
  ('betrivers-net',       'BetRivers.net',       'BetRivers.net',       'https://www.betrivers.net',         NULL, 'active'),
  ('high5casino',         'High 5 Casino',       'High 5 Casino',       'https://high5casino.com',           NULL, 'active'),
  ('jackpota',            'Jackpota',            'Jackpota',            'https://jackpota.com',              NULL, 'active'),
  ('spree-casino',        'Spree Casino',        'Spree Casino',        'https://www.spreecasino.com',       NULL, 'active'),
  ('sportzino',           'Sportzino',           'Sportzino',           'https://sportzino.com',             NULL, 'active')
ON CONFLICT (slug) DO NOTHING;
```

---

## Analytics Views

```sql
-- User portfolio overview
CREATE OR REPLACE VIEW user_portfolio AS
SELECT
  s.user_id,
  COUNT(DISTINCT s.platform_id)                     AS platforms_active,
  COUNT(s.id)                                        AS total_sessions,
  SUM(s.total_wagered)                              AS lifetime_wagered,
  SUM(s.net_result)                                 AS lifetime_net,
  ROUND(SUM(s.total_won) / NULLIF(SUM(s.total_wagered), 0) * 100, 2) AS lifetime_rtp_pct,
  MAX(s.started_at)                                 AS last_session_at
FROM sessions s
WHERE s.status = 'completed'
GROUP BY s.user_id;

-- Platform RTP leaderboard (anonymous aggregate)
CREATE OR REPLACE VIEW platform_rtp_aggregate AS
SELECT
  p.id            AS platform_id,
  p.name          AS platform_name,
  COUNT(s.id)     AS session_count,
  SUM(s.spin_count)                                  AS total_spins,
  ROUND(SUM(s.total_won) / NULLIF(SUM(s.total_wagered), 0) * 100, 2) AS community_rtp_pct,
  ROUND(AVG(s.rtp) * 100, 2)                         AS avg_session_rtp_pct
FROM sessions s
JOIN platforms p ON p.id = s.platform_id
WHERE s.status = 'completed' AND s.spin_count >= 50
GROUP BY p.id, p.name
HAVING COUNT(s.id) >= 10;
```
