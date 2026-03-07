import Stripe from 'stripe'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'
import { query as dbQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })

export const TIER_PRICE_MAP: Record<string, string> = {
  [env.STRIPE_PRICE_STARTER_MONTHLY ?? '']: 'starter',
  [env.STRIPE_PRICE_STARTER_ANNUAL ?? '']: 'starter',
  [env.STRIPE_PRICE_PRO_MONTHLY ?? '']: 'pro',
  [env.STRIPE_PRICE_PRO_ANNUAL ?? '']: 'pro',
  [env.STRIPE_PRICE_ANALYST_MONTHLY ?? '']: 'analyst',
  [env.STRIPE_PRICE_ANALYST_ANNUAL ?? '']: 'analyst',
  [env.STRIPE_PRICE_ELITE_MONTHLY ?? '']: 'elite',
  [env.STRIPE_PRICE_ELITE_ANNUAL ?? '']: 'elite',
  [env.STRIPE_PRICE_LIFETIME ?? '']: 'elite',
}

export function getTierFromPriceId(priceId: string): string {
  return TIER_PRICE_MAP[priceId] ?? 'free'
}

export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  if (rows[0]?.stripe_customer_id) {
    return rows[0].stripe_customer_id
  }

  const customer = await stripe.customers.create({ email, metadata: { userId } })

  await dbQuery(sql`
    UPDATE subscriptions SET stripe_customer_id = ${customer.id} WHERE user_id = ${userId}
  `)

  return customer.id
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const customerId = await getOrCreateCustomer(userId, email)

  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: priceId === env.STRIPE_PRICE_LIFETIME ? 'payment' : 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
  })
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const { rows } = await dbQuery<{ stripe_customer_id: string | null }>(sql`
    SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `)

  const customerId = rows[0]?.stripe_customer_id
  if (!customerId) throw new Error('No Stripe customer found for user')

  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
}

export async function syncSubscriptionToDb(subscription: Stripe.Subscription): Promise<void> {
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

  logger.info({ customerId, tier, status: subscription.status }, 'Subscription synced to DB')
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscriptionToDb(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await dbQuery(sql`
        UPDATE subscriptions
        SET status = 'canceled', tier = 'free', cancel_at_period_end = false, updated_at = NOW()
        WHERE stripe_subscription_id = ${sub.id}
      `)
      logger.info({ subscriptionId: sub.id }, 'Subscription canceled')
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await dbQuery(sql`
        UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
        WHERE stripe_customer_id = ${invoice.customer as string}
      `)
      logger.warn({ customerId: invoice.customer }, 'Invoice payment failed')
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      await dbQuery(sql`
        UPDATE subscriptions SET status = 'active', updated_at = NOW()
        WHERE stripe_customer_id = ${invoice.customer as string}
      `)
      break
    }

    default:
      logger.debug({ eventType: event.type }, 'Unhandled Stripe event')
  }
}
