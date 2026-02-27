import type { FastifyInstance, FastifyRequest } from 'fastify'
import Stripe from 'stripe'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { env } from '../utils/env.js'

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
  app.post('/webhooks/stripe', async (request: FastifyRequest, reply) => {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
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

      await dbQuery(sql`
        UPDATE subscriptions
        SET status = 'past_due', updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `)

      // TODO: trigger Resend email — "Payment failed, please update billing"
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
  const priceMap: Record<string, string> = {
    [env.STRIPE_PRICE_STARTER_MONTHLY]: 'starter',
    [env.STRIPE_PRICE_STARTER_YEARLY]: 'starter',
    [env.STRIPE_PRICE_PRO_MONTHLY]: 'pro',
    [env.STRIPE_PRICE_PRO_YEARLY]: 'pro',
    [env.STRIPE_PRICE_ANALYST_MONTHLY]: 'analyst',
    [env.STRIPE_PRICE_ANALYST_YEARLY]: 'analyst',
    [env.STRIPE_PRICE_ELITE_MONTHLY]: 'elite',
    [env.STRIPE_PRICE_ELITE_YEARLY]: 'elite',
  }
  return priceMap[priceId] ?? 'free'
}
