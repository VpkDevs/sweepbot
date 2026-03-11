import type { FastifyInstance, FastifyRequest } from 'fastify'
import Stripe from 'stripe'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { env } from '../utils/env.js'
import { sendEmail } from '../lib/email.js'
import { sendWelcomeEmail } from '../services/email.service.js'
import { createNotification } from './notifications.js'
import { logger } from '../utils/logger.js'

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })

/**
 * Stripe webhook handler.
 *
 * IMPORTANT: Fastify's body parser must be bypassed for this route — Stripe
 * requires the raw body for signature verification. We register this route
 * before the JSON content-type parser via addContentTypeParser.
 */

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Parse raw body for Stripe signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: 1_048_576 }, // 1MB limit
    (_req, body, done) => {
      done(null, body)
    }
  )

  // ─── POST /webhooks/stripe ────────────────────────────────────────────────
  app.post('/stripe', async (request: FastifyRequest, reply) => {
    const sig = request.headers['stripe-signature']

    if (!sig) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      app.log.warn({ err }, 'Stripe webhook signature verification failed')
      return reply.code(400).send({ error: 'Invalid signature' })
    }

    app.log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received')

    try {
      await handleStripeEvent(event)
    } catch (err) {
      app.log.error({ err, eventType: event.type }, 'Stripe webhook handler error')
      // Return 500 so Stripe retries
      return reply.code(500).send({ error: 'Webhook handler failed' })
    }

    return reply.code(200).send({ received: true })
  })

  // ─── POST /webhooks/supabase ─────────────────────────────────────────────
  // Supabase can be configured to POST user events (see its functions or
  // Auth > Webhooks settings). We only care about new-user creation so we
  // can trigger a welcome email.
  app.post('/supabase', async (request, reply) => {
    // The plugin-scope content-type parser returns raw Buffers for application/json,
    // so we must parse it back to an object here.
    const raw = request.body as Buffer | Record<string, unknown>
    const event: Record<string, unknown> = Buffer.isBuffer(raw)
      ? (JSON.parse(raw.toString()) as Record<string, unknown>)
      : raw
    // example payload: { "type": "user.created", "record": { email, user_metadata } }
    if (event?.['type'] === 'user.created') {
      const rec = (event['record'] as Record<string, unknown> | undefined) ?? {}
      const email = typeof rec['email'] === 'string' ? rec['email'] : undefined
      const userMetadata =
        typeof rec['user_metadata'] === 'object' && rec['user_metadata'] !== null
          ? (rec['user_metadata'] as Record<string, unknown>)
          : undefined
      const username =
        userMetadata && typeof userMetadata['display_name'] === 'string'
          ? userMetadata['display_name']
          : undefined
      if (email) {
        try {
          // deferred send; failures shouldn't block webhook response
          void sendWelcomeEmail(email, username)
        } catch (e) {
          logger.error({ error: e, email }, 'Failed to send welcome email')
        }
      }
    }
    return reply.code(200).send({ received: true })
  })
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // ── Subscription created ──────────────────────────────────────────────
    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const tier = getTierFromPriceId(subscription.items.data[0]?.price.id ?? '')

      await dbQuery(sql`
        UPDATE subscriptions
        SET
          status = ${subscription.status},
          tier = ${tier},
          stripe_subscription_id = ${subscription.id},
          current_period_start = ${new Date(subscription.current_period_start * 1000)},
          current_period_end = ${new Date(subscription.current_period_end * 1000)},
          cancel_at_period_end = ${subscription.cancel_at_period_end},
          updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)
      break
    }

    // ── Subscription updated (upgrade, downgrade, renewal) ────────────────
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const tier = getTierFromPriceId(subscription.items.data[0]?.price.id ?? '')

      await dbQuery(sql`
        UPDATE subscriptions
        SET
          status = ${subscription.status},
          tier = ${tier},
          stripe_subscription_id = ${subscription.id},
          current_period_start = ${new Date(subscription.current_period_start * 1000)},
          current_period_end = ${new Date(subscription.current_period_end * 1000)},
          cancel_at_period_end = ${subscription.cancel_at_period_end},
          updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)
      break
    }

    // ── Subscription cancelled ────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      await dbQuery(sql`
        UPDATE subscriptions
        SET
          status = 'cancelled',
          tier = 'free',
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)
      break
    }

    // ── Payment succeeded ─────────────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // Ensure subscription is marked active on successful payment
      if (invoice.subscription) {
        await dbQuery(sql`
          UPDATE subscriptions
          SET status = 'active', updated_at = NOW()
          WHERE stripe_customer_id = ${customerId}
        `)
      }

      // Log payment in billing_events for audit trail
      await dbQuery(sql`
        INSERT INTO billing_events
          (stripe_customer_id, event_type, amount_cents, currency, stripe_invoice_id, created_at)
        VALUES
          (
            ${customerId},
            'payment_succeeded',
            ${invoice.amount_paid},
            ${invoice.currency},
            ${invoice.id},
            NOW()
          )
        ON CONFLICT (stripe_invoice_id) DO NOTHING
      `)
      break
    }

    // ── Payment failed ────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // update subscription status first
      await dbQuery(sql`
        UPDATE subscriptions
        SET status = 'past_due', updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)

      // create an in-app notification for the user if we can resolve them
      try {
        const { rows } = await dbQuery<{ user_id: string }>(
          sql`SELECT user_id FROM subscriptions WHERE stripe_customer_id = ${customerId}`
        )
        if (rows[0]?.user_id) {
          void createNotification({
            userId: rows[0].user_id,
            type: 'system',
            title: 'Payment failed',
            body: 'Your subscription payment failed. Please update your billing information.',
          })
        }
      } catch (e) {
        logger.error({ error: e }, 'Unable to notify user for payment failure')
      }

      // attempt to send an email via Resend if address available
      const customerEmail = invoice.customer_email
      if (customerEmail) {
        void sendEmail({
          to: customerEmail,
          subject: 'SweepBot: Payment failed – update billing',
          html: `<p>Hi there,</p>
<p>We tried to charge your credit card but the payment failed. Please <a href="https://app.sweepbot.app/settings/billing">update your billing information</a> to avoid interruption.</p>
<p>Thanks,<br/>The SweepBot Team</p>`,
        })
      }

      break
    }

    // ── Checkout session completed (new subscription or lifetime deal) ─────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string
      const userId = session.metadata?.['userId']

      if (!userId) break

      // Upsert customer ID on profile
      await dbQuery(sql`
        UPDATE subscriptions
        SET stripe_customer_id = ${customerId}, updated_at = NOW()
        WHERE user_id = ${userId}
      `)

      // Handle lifetime purchase (one-time payment mode)
      if (session.mode === 'payment') {
        await dbQuery(sql`
          UPDATE subscriptions
          SET
            tier = 'pro',
            status = 'active',
            is_lifetime = TRUE,
            current_period_end = '2099-12-31'::timestamptz,
            updated_at = NOW()
          WHERE user_id = ${userId}
        `)
      }
      break
    }

    // ── Customer portal — payment method updated ──────────────────────────
    case 'customer.updated': {
      // No-op for now, can add billing email sync later
      break
    }

    default: {
      // Unhandled events — log and ignore (return 200 so Stripe doesn't retry)
      break
    }
  }
}

/**
 * Maps a Stripe price ID to an internal subscription tier.
 * Price IDs from env vars, set up in .env.example.
 */
function getTierFromPriceId(priceId: string): string {
  if (!priceId) return 'free'
  const entries: [string | undefined, string][] = [
    [env.STRIPE_PRICE_STARTER_MONTHLY, 'starter'],
    [env.STRIPE_PRICE_STARTER_ANNUAL, 'starter'],
    [env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [env.STRIPE_PRICE_PRO_ANNUAL, 'pro'],
    [env.STRIPE_PRICE_ANALYST_MONTHLY, 'analyst'],
    [env.STRIPE_PRICE_ANALYST_ANNUAL, 'analyst'],
    [env.STRIPE_PRICE_ELITE_MONTHLY, 'elite'],
    [env.STRIPE_PRICE_ELITE_ANNUAL, 'elite'],
  ]
  const priceMap = Object.fromEntries(entries.filter(([k]) => k) as [string, string][])
  return priceMap[priceId] ?? 'free'
}
