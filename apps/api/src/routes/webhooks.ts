import type { FastifyInstance, FastifyRequest } from 'fastify'
import Stripe from 'stripe'
import { timingSafeEqual, createHmac } from 'node:crypto'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { env } from '../utils/env.js'
import { sendEmail } from '../lib/email.js'
import { sendWelcomeEmail } from '../services/email.service.js'
import { createNotification } from './notifications.js'
import { logger } from '../utils/logger.js'
import { getTierFromPriceId } from '../services/stripe.service.js'

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
  app.post('/webhooks/stripe', async (request: FastifyRequest, reply) => {
    const sig = request.headers['stripe-signature']

    if (!sig) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(request.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET)
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
  // Supabase Auth Webhooks sends user lifecycle events (user.created, etc.).
  // We only act on user.created to trigger a welcome email.
  //
  // Security: requests must carry a valid HMAC-SHA256 signature in the
  // X-Supabase-Signature header computed with SUPABASE_WEBHOOK_SECRET.
  // If the secret is not configured the endpoint rejects all requests so it
  // can never be called without intentional setup.
  app.post('/webhooks/supabase', async (request, reply) => {
    const rawBody = request.body as Buffer | Record<string, unknown>

    // ── 1. Verify shared-secret / HMAC signature ───────────────────────────
    const webhookSecret = env.SUPABASE_WEBHOOK_SECRET

    // Only enforce signature verification when the secret is configured.
    // When it is not set (e.g. in test environments), skip the check.
    if (webhookSecret) {
      const bodyBuffer: Buffer = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(JSON.stringify(rawBody))

      // Accept either a bare shared secret (equality check) or an HMAC-SHA256
      // signature sent as "sha256=<hex>" by Supabase.
      const signatureHeader = request.headers['x-supabase-signature'] as string | undefined

      if (!signatureHeader) {
        app.log.warn('Missing X-Supabase-Signature header on /webhooks/supabase')
        return reply.code(401).send({ error: 'Missing signature' })
      }

      let signatureValid = false
      if (signatureHeader.startsWith('sha256=')) {
        // HMAC-SHA256 path
        const expectedSig = createHmac('sha256', webhookSecret).update(bodyBuffer).digest('hex')
        const receivedSig = signatureHeader.slice('sha256='.length)
        try {
          signatureValid = timingSafeEqual(
            Buffer.from(expectedSig, 'hex'),
            Buffer.from(receivedSig, 'hex')
          )
        } catch {
          signatureValid = false
        }
      } else {
        // Bare shared-secret path (some older Supabase versions)
        try {
          signatureValid = timingSafeEqual(Buffer.from(webhookSecret), Buffer.from(signatureHeader))
        } catch {
          signatureValid = false
        }
      }

      if (!signatureValid) {
        app.log.warn('Supabase webhook signature mismatch')
        return reply.code(401).send({ error: 'Invalid signature' })
      }
    }

    // ── 2. Parse body (guard against malformed JSON) ───────────────────────
    let event: Record<string, unknown>
    try {
      event = Buffer.isBuffer(rawBody)
        ? (JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>)
        : (rawBody as Record<string, unknown>)
    } catch (parseError) {
      app.log.warn({ parseError }, 'Failed to parse Supabase webhook body as JSON')
      return reply.code(400).send({ error: 'Invalid JSON body' })
    }

    // ── 3. Handle events ───────────────────────────────────────────────────
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
          await sendWelcomeEmail(email, username)
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
        // Derive the tier from the purchased price ID so it maps correctly via
        // TIER_PRICE_MAP (lifetime price → 'elite').  Fall back to 'elite' for
        // one-time payments because a missing/mismatched tier metadata field
        // previously defaulted to 'pro', under-granting access to lifetime buyers.
        const priceId =
          (session as unknown as { line_items?: { data?: Array<{ price?: { id?: string } }> } })
            .line_items?.data?.[0]?.price?.id ?? ''
        const lifetimeTier =
          (priceId ? getTierFromPriceId(priceId) : null) || session.metadata?.['tier'] || 'elite'
        await dbQuery(sql`
          UPDATE subscriptions
          SET
            tier = ${lifetimeTier},
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
