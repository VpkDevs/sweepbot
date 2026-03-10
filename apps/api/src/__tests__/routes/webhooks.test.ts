import Fastify from 'fastify'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// fake stripe to bypass signature verification
vi.mock('stripe', () => {
  return {
    default: class {
      webhooks = {
        constructEvent: (body: string | Buffer, _sig: string, _secret: string) => {
          // body arrives as a Buffer due to the raw content-type parser
          const str: string = Buffer.isBuffer(body)
            ? body.toString()
            : typeof body === 'string'
              ? body
              : JSON.stringify(body)
          return JSON.parse(str)
        },
      }
    },
  }
})

// mock database client and email helper
vi.mock('../../db/client', () => ({
  query: vi.fn(),
  unsafeQuery: vi.fn(),
}))
vi.mock('../../lib/email', () => ({
  sendEmail: vi.fn(),
}))

import { webhookRoutes } from '../../routes/webhooks'
import { query as dbQuery } from '../../db/client'
import { sendEmail } from '../../lib/email'

describe('Stripe Webhook Routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    app = Fastify()
    app.register(webhookRoutes)
    await app.ready()
  })

  it('handles invoice.payment_failed by updating subs and sending email', async () => {
    ;(dbQuery as any).mockResolvedValue({ rows: [] })

    const invoice = { customer: 'cus_test', customer_email: 'foo@example.com' }
    const event = { type: 'invoice.payment_failed', data: { object: invoice } }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'test', 'content-type': 'application/json' },
      payload: JSON.stringify(event),
    })

    expect(res.statusCode).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'foo@example.com' }))
  })

  it('handles supabase user.created event by sending welcome email', async () => {
    const event = { type: 'user.created', record: { email: 'new@user.com', user_metadata: { display_name: 'Newbie' } } }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/supabase',
      payload: event,
    })

    expect(res.statusCode).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'new@user.com',
      subject: expect.stringContaining('Welcome'),
    }))
  })
})
