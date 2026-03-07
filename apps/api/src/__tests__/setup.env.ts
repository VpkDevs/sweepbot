/**
 * Test environment setup — sets required environment variables before any
 * test module is evaluated.  Prevents env.ts from calling process.exit(1).
 */

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/sweepbot_test',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-for-vitest-only',
  SUPABASE_ANON_KEY: 'test-anon-key-for-vitest-only',
  JWT_SECRET: 'test-jwt-secret-that-is-at-least-thirty-two-characters-long',
  STRIPE_SECRET_KEY: 'sk_test_vitest_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_vitest_placeholder',
})
