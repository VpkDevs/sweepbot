/**
 * Shared Validation Schemas
 * Zod schemas for API contracts and form validation
 * Ensures consistency between frontend and backend
 */

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────────
// User Schemas
// ──────────────────────────────────────────────────────────────────────

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(100).nullable(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(500).nullable(),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']),
  timezone: z.string(),
  locale: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const updateProfileSchema = userProfileSchema.pick({
  displayName: true,
  avatarUrl: true,
  bio: true,
  timezone: true,
  locale: true,
}).partial()

// ──────────────────────────────────────────────────────────────────────
// Session Schemas (Note: Full schema exported from session module)
// ──────────────────────────────────────────────────────────────────────

// Re-export createSessionSchema for form validation
export const createSessionSchema = z.object({
  platformId: z.string().uuid(),
  gameId: z.string().uuid().nullable(),
  openingBalance: z.number().nonnegative(),
  startedAt: z.string().datetime().optional(),
})

// ──────────────────────────────────────────────────────────────────────
// Platform Schemas (Note: Full schema exported from platform module)
// ──────────────────────────────────────────────────────────────────────

// Re-export platformSchema for form validation (simplified for forms)
export const platformSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  url: z.string().url(),
  affiliateUrl: z.string().url().nullable(),
  logoUrl: z.string().url().nullable(),
  description: z.string().nullable(),
  foundedYear: z.number().int().min(2000).max(new Date().getFullYear()).nullable(),
  status: z.enum(['active', 'maintenance', 'deprecated']),
  countryCodes: z.array(z.string().length(2)),
  isFeatured: z.boolean(),
  sortOrder: z.number().int(),
})

// ──────────────────────────────────────────────────────────────────────
// Flow Schemas
// ──────────────────────────────────────────────────────────────────────

export const flowStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])

export const flowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  definition: z.record(z.unknown()), // FlowDefinition AST
  trigger: z.record(z.unknown()),
  status: flowStatusSchema,
  version: z.number().int().positive(),
  guardrails: z.array(z.record(z.unknown())),
  isShared: z.boolean(),
  executionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastExecutedAt: z.string().datetime().nullable(),
})

export const createFlowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  definition: z.record(z.unknown()),
  trigger: z.record(z.unknown()),
  guardrails: z.array(z.record(z.unknown())).optional(),
})

// ──────────────────────────────────────────────────────────────────────
// Subscription Schemas
// ──────────────────────────────────────────────────────────────────────

export const subscriptionStatusSchema = z.enum([
  'active',
  'trialing',
  'past_due',
  'canceled',
  'paused',
])

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripeSubscriptionId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']),
  status: subscriptionStatusSchema,
  currentPeriodStart: z.string().datetime().nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  trialEnd: z.string().datetime().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  trialConverted: z.boolean(),
})

// ──────────────────────────────────────────────────────────────────────
// Notification Schemas
// ──────────────────────────────────────────────────────────────────────

export const notificationTypeSchema = z.enum([
  'achievement',
  'streak',
  'milestone',
  'big_win',
  'system',
  'tos_change',
  'platform_outage',
  'jackpot_alert',
])

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  icon: z.string().max(100).nullable(),
  href: z.string().max(500).nullable(),
  isRead: z.boolean(),
  readAt: z.string().datetime().nullable(),
  data: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
})

// ──────────────────────────────────────────────────────────────────────
// Form Validation Schemas
// ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signupSchema = loginSchema.extend({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

// ──────────────────────────────────────────────────────────────────────
// Type Exports (Note: Core types are exported from domain modules)
// ──────────────────────────────────────────────────────────────────────

export type UserProfile = z.infer<typeof userProfileSchema>
export type UpdateProfile = z.infer<typeof updateProfileSchema>
export type CreateSession = z.infer<typeof createSessionSchema>
export type Flow = z.infer<typeof flowSchema>
export type CreateFlow = z.infer<typeof createFlowSchema>
export type Notification = z.infer<typeof notificationSchema>
export type LoginForm = z.infer<typeof loginSchema>
export type SignupForm = z.infer<typeof signupSchema>
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>
