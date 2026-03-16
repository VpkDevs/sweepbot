import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/client', () => ({
  query: vi.fn(),
}))

vi.mock('../../routes/notifications', () => ({
  createNotification: vi.fn(),
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

import { query } from '../../db/client'
import { streakManager } from '../../services/streak-manager'
import { logger } from '../../utils/logger'

function collectSqlStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectSqlStrings(entry))
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((entry) => collectSqlStrings(entry))
  }

  return []
}

describe('StreakManagerService.processNightlyCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('advances last_activity_date when a freeze protects the streak overnight', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: 1 }] })

    await streakManager.processNightlyCheck()

    expect(query).toHaveBeenCalledTimes(1)

    const statement = vi.mocked(query).mock.calls[0]?.[0]
    const normalizedSql = collectSqlStrings(statement)
      .join(' ')
      .replace(/\s+/g, ' ')

    expect(normalizedSql).toContain('current_streak = CASE WHEN freeze_credits > 0 THEN current_streak ELSE 0 END')
    expect(normalizedSql).toContain(
      'last_activity_date = CASE WHEN freeze_credits > 0 THEN CURRENT_DATE ELSE last_activity_date END',
    )
    expect(normalizedSql).toContain('freeze_credits = GREATEST(0, freeze_credits - 1)')
  })

  it('logs the number of affected streak rows', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: 3 }] })

    await streakManager.processNightlyCheck()

    expect(logger.info).toHaveBeenCalledWith({ affected: 3 }, 'Nightly streak check complete')
  })
})
