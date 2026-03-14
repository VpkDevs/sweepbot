/**
 * Environment variable validation and type-safe access.
 * The app will crash on startup if required env vars are missing.
 */

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(8080),
  API_HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(32),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_ANALYST_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANALYST_ANNUAL: z.string().optional(),
  STRIPE_PRICE_ELITE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ELITE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_LIFETIME: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@sweepbot.com'),
  EMAIL_FROM_NAME: z.string().default('SweepBot'),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),

  // App
  APP_URL: z.string().url().default('https://app.sweepbot.app'),
  ADMIN_SECRET: z.string().min(1).optional(),

  // Supabase webhook shared secret (used to authenticate inbound webhook POSTs)
  // Generate with: openssl rand -hex 32 and set same value in Supabase Auth > Webhooks
  SUPABASE_WEBHOOK_SECRET: z.string().min(16).optional(),
})

const _parsed = envSchema.safeParse(process.env)

if (!_parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(_parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = _parsed.data
