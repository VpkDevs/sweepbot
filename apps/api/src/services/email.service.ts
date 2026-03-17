import { sendEmail } from '../lib/email.js'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

const APP_URL = env.APP_URL

export async function sendWelcomeEmail(to: string, username?: string) {
  await sendEmail({
    to,
    subject: 'Welcome to SweepBot — Your Edge Starts Here',
    html: `
      <h1>Welcome${username ? `, ${username}` : ''}!</h1>
      <p>Your SweepBot account is ready. Start tracking your sweepstakes casino sessions, monitor redemptions, and get crowdsourced trust scores.</p>
      <p><a href="${APP_URL}/dashboard">Go to Dashboard →</a></p>
      <p style="color:#888;font-size:12px;">SweepBot • Transparency tools for sweepstakes casino players</p>
    `,
    text: `Welcome${username ? `, ${username}` : ''}!\n\nYour SweepBot account is ready.\n\nGo to Dashboard: ${APP_URL}/dashboard`,
  })
}

export async function sendSubscriptionConfirmationEmail(
  to: string,
  tier: string,
  renewalDate?: Date
) {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)

  await sendEmail({
    to,
    subject: `Your SweepBot ${tierLabel} subscription is active`,
    html: `
      <h1>You're on ${tierLabel}!</h1>
      <p>Your subscription is now active and all ${tierLabel} features are unlocked.</p>
      ${renewalDate ? `<p>Next renewal: <strong>${renewalDate.toLocaleDateString()}</strong></p>` : ''}
      <p><a href="${APP_URL}/settings">Manage subscription →</a></p>
    `,
    text: `Your SweepBot ${tierLabel} subscription is active.\n\nManage: ${APP_URL}/settings`,
  })
}

export async function sendSubscriptionCanceledEmail(to: string, endDate: Date) {
  await sendEmail({
    to,
    subject: 'Your SweepBot subscription has been canceled',
    html: `
      <h1>Subscription Canceled</h1>
      <p>Your subscription has been canceled. You'll retain access until <strong>${endDate.toLocaleDateString()}</strong>.</p>
      <p>We hope to see you back. <a href="${APP_URL}/pricing">View plans →</a></p>
    `,
    text: `Your SweepBot subscription has been canceled. Access continues until ${endDate.toLocaleDateString()}.`,
  })
}

export async function sendPaymentFailedEmail(to: string) {
  await sendEmail({
    to,
    subject: 'Action required: SweepBot payment failed',
    html: `
      <h1>Payment Failed</h1>
      <p>We couldn't process your latest payment. Please update your payment method to keep your subscription active.</p>
      <p><a href="${APP_URL}/settings">Update payment method →</a></p>
    `,
    text: `SweepBot payment failed. Update your payment method: ${APP_URL}/settings`,
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendEmail({
    to,
    subject: 'Reset your SweepBot password',
    html: `
      <h1>Password Reset</h1>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password →</a></p>
      <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    text: `Reset your SweepBot password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  })
}

export async function sendAchievementEmail(
  to: string,
  achievementName: string,
  description: string
) {
  await sendEmail({
    to,
    subject: `Achievement unlocked: ${achievementName}`,
    html: `
      <h1>🏆 Achievement Unlocked!</h1>
      <h2>${achievementName}</h2>
      <p>${description}</p>
      <p><a href="${APP_URL}/achievements">View all achievements →</a></p>
    `,
    text: `Achievement Unlocked: ${achievementName}\n${description}\n\nView all: ${APP_URL}/achievements`,
  })
}

export async function sendTrialStartEmail(to: string, trialEndsAt: Date, username?: string) {
  const endDateStr = trialEndsAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  await sendEmail({
    to,
    subject: 'Your SweepBot Pro trial has started — 14 days free',
    html: `
      <h1>Welcome to Pro${username ? `, ${username}` : ''}!</h1>
      <p>Your 14-day SweepBot Pro trial is now active. You have full access to all Pro features until <strong>${endDateStr}</strong>.</p>
      <p>Explore what's included: advanced analytics, flow automation, priority redemption tracking, and more.</p>
      <p><a href="${APP_URL}/dashboard">Go to Dashboard →</a></p>
      <p style="color:#888;font-size:12px;">No charge until your trial ends. You can cancel anytime in Settings.</p>
    `,
    text: `Welcome to Pro${username ? `, ${username}` : ''}!\n\nYour 14-day SweepBot Pro trial is active until ${endDateStr}.\n\nDashboard: ${APP_URL}/dashboard`,
  })
}

export async function sendTrialEndingEmail(to: string, daysLeft: number) {
  await sendEmail({
    to,
    subject: `Your SweepBot Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    html: `
      <h1>Your trial is ending soon</h1>
      <p>You have <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> left on your SweepBot Pro trial.</p>
      <p>Upgrade now to keep your Pro features and avoid any interruption.</p>
      <p><a href="${APP_URL}/pricing">Upgrade to Pro →</a></p>
      <p style="color:#888;font-size:12px;">If you don't upgrade, your account will revert to the Free plan.</p>
    `,
    text: `Your SweepBot Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.\n\nUpgrade: ${APP_URL}/pricing`,
  })
}

export async function sendTrialExpiredEmail(to: string) {
  await sendEmail({
    to,
    subject: 'Your SweepBot Pro trial has ended',
    html: `
      <h1>Your trial has ended</h1>
      <p>Your 14-day SweepBot Pro trial has expired. Your account is now on the Free plan.</p>
      <p>You can upgrade anytime to regain access to Pro features.</p>
      <p><a href="${APP_URL}/pricing">View Pro plans →</a></p>
    `,
    text: `Your SweepBot Pro trial has expired. Upgrade to keep Pro features: ${APP_URL}/pricing`,
  })
}

export async function sendRedemptionStatusEmail(
  to: string,
  platform: string,
  amount: number,
  status: 'approved' | 'declined' | 'paid',
  notes?: string
) {
  const statusMessages = {
    approved: {
      emoji: '✅',
      label: 'Approved',
      text: 'Your redemption has been approved and is being processed.',
    },
    declined: {
      emoji: '❌',
      label: 'Declined',
      text: 'Unfortunately your redemption was declined.',
    },
    paid: { emoji: '💰', label: 'Paid', text: 'Your redemption has been paid!' },
  }

  const { emoji, label, text } = statusMessages[status]

  await sendEmail({
    to,
    subject: `${emoji} Redemption ${label}: ${platform} $${amount.toFixed(2)}`,
    html: `
      <h1>${emoji} Redemption ${label}</h1>
      <p><strong>Platform:</strong> ${platform}</p>
      <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
      <p>${text}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p><a href="${APP_URL}/redemptions">View redemptions →</a></p>
    `,
    text: `Redemption ${label}: ${platform} $${amount.toFixed(2)}\n${text}`,
  })
}
