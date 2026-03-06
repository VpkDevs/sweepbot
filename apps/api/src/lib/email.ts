import Resend from 'resend'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

// initialize Resend client only if key is present
const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export async function sendEmail(opts: SendEmailOptions) {
  if (!resendClient) {
    logger.warn('sendEmail called but RESEND_API_KEY is not configured')
    return
  }

  try {
    await resendClient.emails.send({
      from: opts.from ?? `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })
  } catch (err) {
    logger.error({ err }, 'Failed to send email via Resend')
    // swallow errors so they don't break the caller; notifications will still fire
  }
}
