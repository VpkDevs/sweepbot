import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/client', () => ({
  query: vi.fn(),
}))

vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn(),
}))

import { query as dbQuery } from '../../db/client'
import { requireAuth } from '../../middleware/auth'
import { notificationsRoutes } from '../../routes/notifications'

describe('Notification preference routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()

    vi.mocked(requireAuth).mockImplementation(async (req: any) => {
      req.user = { id: 'user-test-001', email: null, tier: 'free' }
    })

    app = Fastify()
    app.decorateRequest('user', null)
    app.register(notificationsRoutes, { prefix: '/notifications' })
    await app.ready()
  })

  it('returns camelCase notification preferences without non-boolean fields', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-test-001',
            jackpot_alerts: true,
            tos_changes: false,
            platform_outages: true,
            flow_errors: false,
            trial_reminders: true,
            daily_summary: false,
            weekly_report: true,
            updated_at: '2026-03-16T00:00:00.000Z',
          },
        ],
      })

    const response = await app.inject({
      method: 'GET',
      url: '/notifications/preferences',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      data: {
        jackpotAlerts: true,
        tosChanges: false,
        platformOutages: true,
        flowErrors: false,
        trialReminders: true,
        dailySummary: false,
        weeklyReport: true,
      },
    })
  })

  it('returns null when no notification preferences row is found', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })

    const response = await app.inject({
      method: 'GET',
      url: '/notifications/preferences',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      data: null,
    })
  })
})
