/**
 * @sweepbot/types
 * Shared TypeScript types and Zod schemas for all SweepBot apps.
 * Every type that crosses a package boundary lives here.
 */

export * from './platform'
export * from './user'
export * from './session'
export * from './analytics'
export * from './subscription'
export * from './jackpot'
export * from './game'
export * from './redemption'
export * from './trust'
export * from './api'
// Export notification and form types from validation (without re-exporting types
// already covered by the dedicated modules above)
export type {
  Notification,
  LoginForm,
  SignupForm,
  ResetPasswordForm,
  ChangePasswordForm,
} from './validation'
export {
  notificationSchema,
  notificationTypeSchema,
  loginSchema,
  signupSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './validation'
