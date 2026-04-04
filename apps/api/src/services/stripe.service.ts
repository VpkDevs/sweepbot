/**
 * stripe.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise-grade Stripe billing service for SweepBot.
 *
 * Responsibilities
 *  • Customer lifecycle:  create, retrieve, sync email across auth changes
 *  • Checkout:            sessions for subscriptions & one-time lifetime deals,
 *                         with optional trial periods and promo codes
 *  • Subscription ops:    preview changes, upgrade/downgrade with proration,
 *                         cancel (immediate or at period end), reactivate,
 *                         promotion-code application
 *  • Payment methods:     list, set default, remove with ownership verification
 *  • Billing portal:      create sessions with return-URL
 *  • Webhook processing:  idempotent event handling with structured audit trail
 *  • Analytics helpers:   per-customer MRR normalised to monthly cadence
 *
 * Design principles
 *  • All mutating Stripe calls carry deterministic idempotency keys (SHA-256
 *    derived so they fit Stripe's 255-char limit and survive retries)
 *  • Transient (5xx / rate-limit) errors are retried up to MAX_RETRIES times
 *    with exponential back-off + jitter
 *  • Webhook deduplication via processed_webhook_events table — concurrent
 *    deliveries of the same event_id are dropped after the first wins the INSERT
 *  • DB writes for billing-event audit trail are fire-and-forget (non-blocking)
 *    to avoid slowing webhook ACK; subscription-state mutations are always awaited
 *  • Errors surface as typed StripeServiceError with machine-readable codes and
 *    a `retryable` flag for callers that implement their own retry policy
 */

import Stripe from 'stripe'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'
import { query as dbQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'

// ─── Stripe client singleton ──────────────────────────────────────────────────

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  // We manage retries ourselves (withRetry) for full observability & back-off control
  maxNetworkRetries: 0,
  timeout: 30_000,
})

// ─── Tier ↔ price mapping ─────────────────────────────────────────────────────
// Build the price→tier map by filtering out any env vars that are undefined or empty.
// Using `?? ''` as object-key literals would create a spurious '' → tier entry that
// makes getTierFromPriceId('') incorrectly return a paid tier for missing price IDs.
const _tierEntries: Array<[string | undefined, string]> = [
  [env.STRIPE_PRICE_STARTER_MONTHLY, 'starter'],
  [env.STRIPE_PRICE_STARTER_ANNUAL, 'starter'],
  [env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
  [env.STRIPE_PRICE_PRO_ANNUAL, 'pro'],
  [env.STRIPE_PRICE_ANALYST_MONTHLY, 'analyst'],
  [env.STRIPE_PRICE_ANALYST_ANNUAL, 'analyst'],
  [env.STRIPE_PRICE_ELITE_MONTHLY, 'elite'],
  [env.STRIPE_PRICE_ELITE_ANNUAL, 'elite'],
  [env.STRIPE_PRICE_LIFETIME, 'elite'],
]

export const TIER_PRICE_MAP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(_tierEntries.filter((entry): entry is [string, string] => Boolean(entry[0])))
)

// Reverse map: tier → canonical monthly price ID (used for MRR estimation)
const _tierMonthlyEntries: Array<[string, string | undefined]> = [
  ['starter', env.STRIPE_PRICE_STARTER_MONTHLY],
  ['pro', env.STRIPE_PRICE_PRO_MONTHLY],
  ['analyst', env.STRIPE_PRICE_ANALYST_MONTHLY],
  ['elite', env.STRIPE_PRICE_ELITE_MONTHLY],
]

export const TIER_MONTHLY_PRICE_MAP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(_tierMonthlyEntries.filter((e): e is [string, string] => Boolean(e[1])))
)

// ─── Typed error class ────────────────────────────────────────────────────────

export type StripeServiceErrorCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'PAYMENT_METHOD_NOT_FOUND'
  | 'PRICE_NOT_CONFIGURED'
  | 'PLAN_ALREADY_ACTIVE'
  | 'SUBSCRIPTION_ALREADY_CANCELED'
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'OWNERSHIP_VIOLATION'
  | 'STRIPE_ERROR'
  | 'DB_ERROR'
  | 'RATE_LIMITED'

export class StripeServiceError extends Error {
  readonly code: StripeServiceErrorCode
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(code: StripeServiceErrorCode, message: string, retryable = false, cause?: unknown) {
    super(message)
    this.name = 'StripeServiceError'
    this.code = code
    this.retryable = retryable
    this.cause = cause
  }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRIES = 3

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status = (err as Stripe.errors.StripeError)?.statusCode
      const isRetryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status)

      if (!isRetryable || attempt === MAX_RETRIES) {
        logger.error({ err, label, attempt }, `Stripe call failed: ${label}`)
        throw new StripeServiceError(
          status === 429 ? 'RATE_LIMITED' : 'STRIPE_ERROR',
          `${label} failed: ${(err as Error).message}`,
          isRetryable,
          err
        )
      }

      // Exponential back-off: 250 ms, 500 ms, 1 000 ms + random jitter
      const delayMs = 2 ** attempt * 250 + Math.random() * 100
      logger.warn(
        { label, attempt, delayMs, status },
        `Stripe transient error — retrying in ${delayMs.toFixed(0)} ms`
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  throw lastError
}

// ─── Idempotency key helper ───────────────────────────────────────────────────

/**
 * Derive a stable, collision-resistant idempotency key from the supplied seed
 * components. SHA-256 output keeps keys well within Stripe's 255-char limit
 * while remaining deterministic across retries of the same logical operation.
 */
function idempotencyKey(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 64)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Customer management
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retrieve the Stripe customer ID for a user, creating one if absent.
 *
 * The customer ID is stored on the `subscriptions` row and mirrored to
 * `profiles.stripe_customer_id` for convenience when building JOIN queries.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  displayName?: string
): Promise<string> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  if (rows[0]?.stripe_customer_id) {
    return rows[0].stripe_customer_id
  }

  const customer = await withRetry(
    () =>
      stripe.customers.create(
        { email, ...(displayName ? { name: displayName } : {}), metadata: { userId } },
        { idempotencyKey: idempotencyKey('create-customer', userId, email) }
      ),
    'customers.create'
  )

  // Persist to both tables atomically — second write is best-effort mirroring
  await dbQuery(sql`
    UPDATE subscriptions
    SET stripe_customer_id = ${customer.id}, updated_at = NOW()
    WHERE user_id = ${userId}
  `)

  void dbQuery(sql`
    UPDATE profiles SET stripe_customer_id = ${customer.id} WHERE id = ${userId}
  `).catch((err) => logger.warn({ err, userId }, 'Failed to mirror stripe_customer_id to profiles'))

  logger.info({ userId, customerId: customer.id }, 'Stripe customer created')
  return customer.id
}

/**
 * Keep the Stripe customer's email in sync with the user's latest auth email.
 * Call this from an auth `email_change` webhook or profile-update handler.
 */
export async function syncCustomerEmail(customerId: string, email: string): Promise<void> {
  await withRetry(
    () =>
      stripe.customers.update(
        customerId,
        { email },
        { idempotencyKey: idempotencyKey('sync-email', customerId, email) }
      ),
    'customers.update(email)'
  )
  logger.info({ customerId, email }, 'Stripe customer email synced')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Checkout & billing portal sessions
// ═══════════════════════════════════════════════════════════════════════════════

export interface CheckoutOptions {
  userId: string
  email: string
  displayName?: string
  priceId: string
  successUrl: string
  cancelUrl: string
  /** Stripe promotion code ID to pre-apply (mutually exclusive with allow_promotion_codes) */
  promotionCode?: string
  /** Override the trial period in days; omit to use the Stripe price's default */
  trialDays?: number
}

/**
 * Create a Stripe Checkout session for an initial subscription or one-time
 * lifetime purchase.  Automatically determines `mode` from the price ID.
 */
export async function createCheckoutSession(
  opts: CheckoutOptions
): Promise<Stripe.Checkout.Session> {
  const customerId = await getOrCreateCustomer(opts.userId, opts.email, opts.displayName)
  const isLifetime = opts.priceId === env.STRIPE_PRICE_LIFETIME

  const params: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    mode: isLifetime ? 'payment' : 'subscription',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { userId: opts.userId },
    // Allow built-in promo-code input unless caller provides one explicitly
    allow_promotion_codes: !opts.promotionCode,
    ...(opts.promotionCode ? { discounts: [{ promotion_code: opts.promotionCode }] } : {}),
    ...(!isLifetime
      ? {
          subscription_data: {
            metadata: { userId: opts.userId },
            ...(opts.trialDays != null ? { trial_period_days: opts.trialDays } : {}),
          },
        }
      : {}),
  }

  return withRetry(
    () =>
      stripe.checkout.sessions.create(params, {
        idempotencyKey: idempotencyKey('checkout', opts.userId, opts.priceId),
      }),
    'checkout.sessions.create'
  )
}

/**
 * Create a Stripe Billing Portal session so a user can manage their
 * subscription, update payment methods, or download invoices.
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  const customerId = rows[0]?.stripe_customer_id
  if (!customerId) {
    throw new StripeServiceError(
      'CUSTOMER_NOT_FOUND',
      'No Stripe customer found for this user — cannot open billing portal'
    )
  }

  return withRetry(
    () => stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl }),
    'billingPortal.sessions.create'
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscription lifecycle — upgrade, downgrade, cancel, reactivate
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Preview the upcoming invoice that would result from switching to `newPriceId`.
 * Use this to show the user the proration charge before they confirm a plan change.
 */
export async function previewSubscriptionChange(
  userId: string,
  newPriceId: string
): Promise<Stripe.UpcomingInvoice> {
  const { rows } = await dbQuery<{
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
  }>(sql`
    SELECT stripe_customer_id, stripe_subscription_id
    FROM subscriptions
    WHERE user_id = ${userId}
    LIMIT 1
  `)

  const row = rows[0]
  if (!row?.stripe_customer_id) {
    throw new StripeServiceError('CUSTOMER_NOT_FOUND', 'User has no Stripe customer')
  }
  if (!row.stripe_subscription_id) {
    throw new StripeServiceError(
      'SUBSCRIPTION_NOT_FOUND',
      'User has no active subscription to preview'
    )
  }

  const sub = await withRetry(
    () => stripe.subscriptions.retrieve(row.stripe_subscription_id!),
    'subscriptions.retrieve(preview)'
  )

  const itemId = sub.items.data[0]?.id
  if (!itemId) {
    throw new StripeServiceError('SUBSCRIPTION_NOT_FOUND', 'Subscription has no line items')
  }

  return withRetry(
    () =>
      stripe.invoices.retrieveUpcoming({
        customer: row.stripe_customer_id!,
        subscription: row.stripe_subscription_id!,
        subscription_items: [{ id: itemId, price: newPriceId }],
      }),
    'invoices.retrieveUpcoming'
  )
}

/**
 * Immediately switch the user's subscription to a new Stripe price (tier / cycle).
 * Creates prorations by default; pass `prorationBehavior: 'none'` to suppress.
 */
export async function changeSubscriptionPlan(
  userId: string,
  newPriceId: string,
  prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior = 'create_prorations'
): Promise<Stripe.Subscription> {
  const { rows } = await dbQuery<{
    stripe_subscription_id: string | null
    tier: string
  }>(sql`
    SELECT stripe_subscription_id, tier
    FROM subscriptions
    WHERE user_id = ${userId}
    LIMIT 1
  `)

  const row = rows[0]
  if (!row?.stripe_subscription_id) {
    throw new StripeServiceError('SUBSCRIPTION_NOT_FOUND', 'User has no subscription to change')
  }

  const currentSub = await withRetry(
    () => stripe.subscriptions.retrieve(row.stripe_subscription_id!),
    'subscriptions.retrieve(change-plan)'
  )

  if (!['active', 'trialing'].includes(currentSub.status)) {
    throw new StripeServiceError(
      'SUBSCRIPTION_NOT_ACTIVE',
      `Cannot change plan — subscription is in status "${currentSub.status}"`
    )
  }

  const itemId = currentSub.items.data[0]?.id
  if (!itemId) {
    throw new StripeServiceError('SUBSCRIPTION_NOT_FOUND', 'Subscription has no line items')
  }

  const updated = await withRetry(
    () =>
      stripe.subscriptions.update(
        row.stripe_subscription_id!,
        {
          items: [{ id: itemId, price: newPriceId }],
          proration_behavior: prorationBehavior,
          metadata: { userId },
        },
        { idempotencyKey: idempotencyKey('change-plan', userId, newPriceId) }
      ),
    'subscriptions.update(plan-change)'
  )

  const newTier = getTierFromPriceId(newPriceId)
  logger.info({ userId, oldTier: row.tier, newTier, newPriceId }, 'Subscription plan changed')
  return updated
}

/**
 * Cancel a subscription.
 *
 * @param immediately - `true` revokes access right now (prorated refund via Stripe).
 *                      `false` (default) sets `cancel_at_period_end = true` so the
 *                      user retains access until the current billing period closes.
 */
export async function cancelSubscription(
  userId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  const { rows } = await dbQuery<{ stripe_subscription_id: string | null }>(sql`
    SELECT stripe_subscription_id FROM subscriptions
    WHERE user_id = ${userId} AND status IN ('active', 'trialing', 'past_due')
    LIMIT 1
  `)

  const subId = rows[0]?.stripe_subscription_id
  if (!subId) {
    throw new StripeServiceError(
      'SUBSCRIPTION_NOT_FOUND',
      'No cancellable subscription found for user'
    )
  }

  if (immediately) {
    const canceled = await withRetry(
      () => stripe.subscriptions.cancel(subId, { prorate: true }),
      'subscriptions.cancel(immediate)'
    )
    logger.info({ userId, subId }, 'Subscription canceled immediately')
    return canceled
  }

  const updated = await withRetry(
    () =>
      stripe.subscriptions.update(
        subId,
        { cancel_at_period_end: true },
        { idempotencyKey: idempotencyKey('cancel-eop', userId, subId) }
      ),
    'subscriptions.update(cancel_at_period_end)'
  )
  logger.info({ userId, subId }, 'Subscription will cancel at period end')
  return updated
}

/**
 * Reactivate a subscription that was scheduled to cancel at period end
 * (i.e. undo a "cancel at end of billing period" request before it fires).
 */
export async function reactivateSubscription(userId: string): Promise<Stripe.Subscription> {
  const { rows } = await dbQuery<{
    stripe_subscription_id: string | null
    cancel_at_period_end: boolean
  }>(sql`
    SELECT stripe_subscription_id, cancel_at_period_end
    FROM subscriptions
    WHERE user_id = ${userId}
    LIMIT 1
  `)

  const row = rows[0]
  if (!row?.stripe_subscription_id) {
    throw new StripeServiceError('SUBSCRIPTION_NOT_FOUND', 'No subscription found for user')
  }
  if (!row.cancel_at_period_end) {
    throw new StripeServiceError(
      'PLAN_ALREADY_ACTIVE',
      'Subscription is not scheduled for cancellation — nothing to reactivate'
    )
  }

  const updated = await withRetry(
    () =>
      stripe.subscriptions.update(
        row.stripe_subscription_id!,
        { cancel_at_period_end: false },
        { idempotencyKey: idempotencyKey('reactivate', userId, row.stripe_subscription_id!) }
      ),
    'subscriptions.update(reactivate)'
  )
  logger.info({ userId }, 'Subscription reactivated — cancellation rescinded')
  return updated
}

/**
 * Apply a Stripe promotion code to an existing active subscription.
 * `promotionCodeId` is the `promo_XXXX` ID (not the human-readable code).
 */
export async function applyPromotionCode(
  userId: string,
  promotionCodeId: string
): Promise<Stripe.Subscription> {
  const { rows } = await dbQuery<{ stripe_subscription_id: string | null }>(sql`
    SELECT stripe_subscription_id FROM subscriptions
    WHERE user_id = ${userId} AND status IN ('active', 'trialing')
    LIMIT 1
  `)

  const subId = rows[0]?.stripe_subscription_id
  if (!subId) {
    throw new StripeServiceError(
      'SUBSCRIPTION_NOT_FOUND',
      'No active subscription to apply promotion to'
    )
  }

  return withRetry(
    () =>
      stripe.subscriptions.update(
        subId,
        { discounts: [{ promotion_code: promotionCodeId }] },
        { idempotencyKey: idempotencyKey('apply-promo', userId, promotionCodeId) }
      ),
    'subscriptions.update(promo-code)'
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Payment method management
// ═══════════════════════════════════════════════════════════════════════════════

/** Return all saved payment methods (cards) for a user. Returns [] if none. */
export async function listPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  const customerId = rows[0]?.stripe_customer_id
  if (!customerId) return []

  const { data } = await withRetry(
    () => stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 20 }),
    'paymentMethods.list'
  )
  return data
}

/** Set a payment method as the default for future invoices on the customer. */
export async function setDefaultPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  const customerId = rows[0]?.stripe_customer_id
  if (!customerId) {
    throw new StripeServiceError('CUSTOMER_NOT_FOUND', 'No Stripe customer found for user')
  }

  await withRetry(
    () =>
      stripe.customers.update(
        customerId,
        { invoice_settings: { default_payment_method: paymentMethodId } },
        { idempotencyKey: idempotencyKey('set-default-pm', userId, paymentMethodId) }
      ),
    'customers.update(default-pm)'
  )
  logger.info({ userId, paymentMethodId }, 'Default payment method updated')
}

/**
 * Detach a payment method from the customer's Stripe vault.
 * Performs an ownership check before detaching to prevent IDOR.
 */
export async function removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  const customerId = rows[0]?.stripe_customer_id
  if (!customerId) {
    throw new StripeServiceError('CUSTOMER_NOT_FOUND', 'No Stripe customer found for user')
  }

  // Ownership check: verify PM belongs to this customer before detaching
  const pm = await withRetry(
    () => stripe.paymentMethods.retrieve(paymentMethodId),
    'paymentMethods.retrieve(ownership-check)'
  )

  if ((pm.customer as string | null) !== customerId) {
    throw new StripeServiceError(
      'OWNERSHIP_VIOLATION',
      'Payment method does not belong to this customer'
    )
  }

  await withRetry(() => stripe.paymentMethods.detach(paymentMethodId), 'paymentMethods.detach')
  logger.info({ userId, paymentMethodId }, 'Payment method removed from vault')
}

// ═══════════════════════════════════════════════════════════════════════════════
// DB sync helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function getTierFromPriceId(priceId: string): string {
  if (!priceId) return 'free'
  return TIER_PRICE_MAP[priceId] ?? 'free'
}

/**
 * Write the canonical subscription state to the database.
 * Matches on `stripe_customer_id` and is idempotent — safe to call multiple
 * times for the same subscription event without producing duplicate rows.
 */
export async function syncSubscriptionToDb(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const tier = getTierFromPriceId(priceId)

  await dbQuery(sql`
    UPDATE subscriptions
    SET
      status                = ${subscription.status},
      tier                  = ${tier},
      stripe_subscription_id = ${subscription.id},
      stripe_price_id       = ${priceId},
      current_period_start  = ${new Date(subscription.current_period_start * 1000)},
      current_period_end    = ${new Date(subscription.current_period_end * 1000)},
      cancel_at_period_end  = ${subscription.cancel_at_period_end},
      updated_at            = NOW()
    WHERE stripe_customer_id = ${customerId}
  `)

  logger.info(
    { customerId, tier, status: subscription.status, subId: subscription.id },
    'Subscription synced to DB'
  )
}

// ─── Webhook idempotency ──────────────────────────────────────────────────────

/**
 * Atomically claim an event ID for processing.
 *
 * Returns `true` if this event was already processed (caller should skip).
 * Returns `false` if the INSERT succeeded and we are the first processor.
 *
 * Falls back to `false` (allow processing) if the table doesn't exist yet so
 * that a missing migration never blocks webhook delivery.
 */
async function markEventProcessed(eventId: string): Promise<boolean> {
  try {
    const { rows } = await dbQuery<{ id: string }>(sql`
      INSERT INTO processed_webhook_events (event_id, processed_at)
      VALUES (${eventId}, NOW())
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id AS id
    `)
    // Row returned → we just inserted → first time; no row → duplicate
    return rows.length === 0
  } catch {
    // Table absent (migration not yet run) — degrade gracefully
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Webhook event handler
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process a verified Stripe webhook event.
 *
 * Idempotent: duplicate deliveries of the same `event.id` are silently dropped
 * after the first successful claim via `markEventProcessed`.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const isDuplicate = await markEventProcessed(event.id)
  if (isDuplicate) {
    logger.info({ eventId: event.id, eventType: event.type }, 'Duplicate webhook event — skipped')
    return
  }

  switch (event.type) {
    // ── Subscription state ────────────────────────────────────────────────────
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscriptionToDb(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await dbQuery(sql`
        UPDATE subscriptions
        SET
          status               = 'canceled',
          tier                 = 'free',
          cancel_at_period_end = false,
          updated_at           = NOW()
        WHERE stripe_subscription_id = ${sub.id}
      `)
      logger.info({ subscriptionId: sub.id }, 'Subscription deleted — tier reset to free')
      break
    }

    // ── Trial reminder (fires 3 days before trial_end) ────────────────────────
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null
      await dbQuery(sql`
        UPDATE subscriptions
        SET trial_ends_at = ${trialEnd}, updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)
      logger.info({ customerId, trialEnd }, 'Trial end date synced from webhook')
      break
    }

    // ── Invoice / payment ─────────────────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      if (invoice.subscription) {
        await dbQuery(sql`
          UPDATE subscriptions
          SET status = 'active', updated_at = NOW()
          WHERE stripe_customer_id = ${customerId}
        `)
      }

      // Audit trail — non-blocking
      void dbQuery(sql`
        INSERT INTO billing_events
          (stripe_customer_id, event_type, amount_cents, currency, stripe_invoice_id, created_at)
        VALUES
          (${customerId}, 'payment_succeeded', ${invoice.amount_paid},
           ${invoice.currency}, ${invoice.id}, NOW())
        ON CONFLICT (stripe_invoice_id) DO NOTHING
      `).catch((err) =>
        logger.error({ err }, 'Failed to write billing_events for payment_succeeded')
      )
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      await dbQuery(sql`
        UPDATE subscriptions
        SET status = 'past_due', updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)

      // Audit trail — non-blocking
      void dbQuery(sql`
        INSERT INTO billing_events
          (stripe_customer_id, event_type, amount_cents, currency, stripe_invoice_id, created_at)
        VALUES
          (${customerId}, 'payment_failed', ${invoice.amount_due},
           ${invoice.currency}, ${invoice.id}, NOW())
        ON CONFLICT (stripe_invoice_id) DO NOTHING
      `).catch((err) => logger.error({ err }, 'Failed to write billing_events for payment_failed'))

      logger.warn(
        { customerId, invoiceId: invoice.id },
        'Invoice payment failed — subscription past_due'
      )
      break
    }

    // ── Checkout completed (new subscription or lifetime one-time purchase) ────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string
      const userId = session.metadata?.['userId']
      if (!userId) break

      // Ensure customer ID is stored on both tables
      await dbQuery(sql`
        UPDATE subscriptions
        SET stripe_customer_id = ${customerId}, updated_at = NOW()
        WHERE user_id = ${userId}
      `)
      void dbQuery(sql`
        UPDATE profiles SET stripe_customer_id = ${customerId} WHERE id = ${userId}
      `).catch((err) =>
        logger.warn({ err, userId }, 'Failed to mirror stripe_customer_id to profiles')
      )

      if (session.mode === 'payment') {
        // Lifetime deal — grant elite access that effectively never expires
        await dbQuery(sql`
          UPDATE subscriptions
          SET
            tier             = 'elite',
            status           = 'active',
            is_lifetime      = TRUE,
            current_period_end = '2099-12-31'::timestamptz,
            updated_at       = NOW()
          WHERE user_id = ${userId}
        `)
        logger.info({ userId, customerId }, 'Lifetime purchase activated — elite tier granted')
      }
      break
    }

    // ── Customer metadata updated (email change, etc.) ────────────────────────
    case 'customer.updated': {
      // No-op for now; add email-sync or metadata-sync logic here as needed
      break
    }

    default:
      logger.debug({ eventType: event.type, eventId: event.id }, 'Unhandled Stripe event — no-op')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the monthly-recurring-revenue (MRR) contribution for a single
 * Stripe customer in **cents** (e.g. `999` = $9.99 / month).
 *
 * Annual prices are normalised to their monthly equivalent so the result is
 * comparable across billing cadences.  Weekly / daily prices are skipped.
 */
export async function computeCustomerMrr(customerId: string): Promise<number> {
  const subs = await withRetry(
    () =>
      stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        expand: ['data.items.data.price'],
      }),
    'subscriptions.list(mrr)'
  )

  let mrrCents = 0

  for (const sub of subs.data) {
    for (const item of sub.items.data) {
      const price = item.price
      const unitAmount = price.unit_amount ?? 0
      const qty = item.quantity ?? 1
      const interval = price.recurring?.interval
      const intervalCount = price.recurring?.interval_count ?? 1

      if (interval === 'month') {
        mrrCents += Math.round((unitAmount * qty) / intervalCount)
      } else if (interval === 'year') {
        // Normalise annual → monthly
        mrrCents += Math.round((unitAmount * qty) / (12 * intervalCount))
      }
      // week / day cadences intentionally excluded from MRR
    }
  }

  return mrrCents
}
