-- Migration 010: Webhook idempotency + billing events audit table
-- Description: Prevent duplicate processing of Stripe webhook events and provide
--              a full audit trail of all billing transactions.
-- Depends on:  001 (profiles), subscriptions table (initial schema)

-- ─────────────────────────────────────────────────────────────────────────────
-- processed_webhook_events
-- ─────────────────────────────────────────────────────────────────────────────
-- Each Stripe webhook event is inserted here exactly once.  The UNIQUE constraint
-- on event_id means concurrent INSERT…ON CONFLICT calls guarantee at-most-once
-- processing even under parallel pod deployments.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT        NOT NULL,           -- e.g. evt_1ABC…  (Stripe event ID)
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index — the key to idempotent webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id
  ON processed_webhook_events (event_id);

-- Allow purging old records without a sequential scan
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_processed_at
  ON processed_webhook_events (processed_at DESC);

COMMENT ON TABLE processed_webhook_events IS
  'Idempotency ledger for Stripe webhooks. Each event_id is inserted once; '
  'concurrent duplicate deliveries are silently dropped via ON CONFLICT DO NOTHING.';

COMMENT ON COLUMN processed_webhook_events.event_id IS
  'Stripe event ID (e.g. evt_1Abc23…). Globally unique per Stripe account.';


-- ─────────────────────────────────────────────────────────────────────────────
-- billing_events
-- ─────────────────────────────────────────────────────────────────────────────
-- Immutable append-only audit log of every billing action.  Rows are written
-- by the webhook handler on every payment_succeeded / payment_failed event.
-- ON CONFLICT (stripe_invoice_id) DO NOTHING guards against double-writes from
-- duplicate webhook deliveries that slip through before dedup is seeded.

CREATE TABLE IF NOT EXISTS billing_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id  TEXT        NOT NULL,
  event_type          TEXT        NOT NULL
    CHECK (event_type IN (
      'payment_succeeded',
      'payment_failed',
      'refund_issued',
      'dispute_opened',
      'dispute_won',
      'dispute_lost',
      'subscription_created',
      'subscription_canceled',
      'trial_started',
      'trial_converted'
    )),
  amount_cents        INTEGER,                 -- in the invoice's currency minor unit
  currency            TEXT,                    -- e.g. 'usd', 'eur'
  stripe_invoice_id   TEXT        UNIQUE,      -- NULL for non-invoice events
  stripe_event_id     TEXT,                    -- back-reference to processed_webhook_events
  metadata            JSONB,                   -- arbitrary extra context (promo code, tier, etc.)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary lookup pattern: "show me all billing history for customer X"
CREATE INDEX IF NOT EXISTS idx_billing_events_customer
  ON billing_events (stripe_customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_type_created
  ON billing_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_created
  ON billing_events (created_at DESC);

COMMENT ON TABLE billing_events IS
  'Immutable billing audit log. One row per billing action. '
  'Used for revenue reporting, dunning analysis, and support tooling.';

COMMENT ON COLUMN billing_events.amount_cents IS
  'Transaction amount in the smallest currency unit (cents for USD). '
  'NULL for non-monetary events such as trial_started.';

COMMENT ON COLUMN billing_events.stripe_invoice_id IS
  'Stripe invoice ID when the event originated from an invoice. '
  'UNIQUE constraint prevents duplicate rows from repeated webhook delivery.';


-- ─────────────────────────────────────────────────────────────────────────────
-- subscriptions — add missing columns referenced by stripe.service.ts
-- ─────────────────────────────────────────────────────────────────────────────

-- Stripe customer ID lives on the subscriptions row for fast webhook lookups
-- (profiles.stripe_customer_id mirrors this for convenience joins)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id     TEXT,
  ADD COLUMN IF NOT EXISTS is_lifetime         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ;

-- Fast lookups by Stripe IDs (used in every webhook handler)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN subscriptions.is_lifetime IS
  'TRUE for users who purchased the one-time lifetime deal via checkout session mode=payment.';

COMMENT ON COLUMN subscriptions.stripe_customer_id IS
  'Stripe customer ID (cus_…). Indexed uniquely for O(1) webhook → subscription lookups.';

COMMENT ON COLUMN subscriptions.cancelled_at IS
  'Timestamp of immediate cancellation (set when status changes to cancelled).';


-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — mirror stripe_customer_id for convenience
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN profiles.stripe_customer_id IS
  'Mirror of subscriptions.stripe_customer_id. Kept in sync by stripe.service.ts '
  'for fast profile→Stripe lookups without a JOIN.';


-- ─────────────────────────────────────────────────────────────────────────────
-- flow_conversations — full_state column for ConversationManager persistence
-- ─────────────────────────────────────────────────────────────────────────────
-- Added here because stripe.service.ts was the last service touched and
-- this column is required by the onStateSave fix from bug-fix session.

ALTER TABLE flow_conversations
  ADD COLUMN IF NOT EXISTS full_state JSONB;

COMMENT ON COLUMN flow_conversations.full_state IS
  'Complete serialised ConversationState JSON. Written by onStateSave so that '
  'ConversationManager.continue() can fully restore currentFlow, pendingQuestions, '
  'and sessionId on reload instead of reconstructing a partial skeleton.';

CREATE INDEX IF NOT EXISTS idx_flow_conversations_full_state_gin
  ON flow_conversations USING GIN (full_state)
  WHERE full_state IS NOT NULL;
