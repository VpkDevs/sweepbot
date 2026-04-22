import { storage, AnalyticsEvent } from '../lib/storage'

describe('StorageManager', () => {
  let mockStorage: Record<string, any>

  const resolveMockGet = (keys?: any) => {
    if (keys == null) return { ...mockStorage }
    if (Array.isArray(keys)) {
      const result: Record<string, any> = {}
      for (const key of keys) result[key] = mockStorage[key]
      return result
    }
    if (typeof keys === 'string') {
      return { [keys]: mockStorage[keys] }
    }
    if (typeof keys === 'object') {
      const result: Record<string, any> = { ...keys }
      for (const key of Object.keys(keys)) {
        if (key in mockStorage) result[key] = mockStorage[key]
      }
      return result
    }
    return {}
  }

  beforeEach(() => {
    mockStorage = {}
    // stub chrome.storage.local
    ;(global as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys?: any, cb?: any) => {
            // support promise-style and callback-style
            if (typeof keys === 'function') {
              cb = keys
              keys = undefined
            }
            if (cb) {
              cb(resolveMockGet(keys))
              return
            }
            // return promise
            return Promise.resolve(resolveMockGet(keys))
          }),
          set: vi.fn((obj: any) => {
            Object.assign(mockStorage, obj)
            return Promise.resolve()
          }),
          clear: vi.fn(() => {
            mockStorage = {}
            return Promise.resolve()
          }),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
    }
  })

  it('returns default values when empty', async () => {
    await storage.clear()
    const hud = await storage.get('hudEnabled')
    expect(hud).toBe(true)
    const pos = await storage.get('hudPosition')
    expect(pos).toBe('bottom-right')
    expect(await storage.get('personalRecords')).toBeNull()
    expect(await storage.get('sessionStreak')).toBeNull()
    expect(await storage.get('voiceConsentGranted')).toBe(false)
    expect(await storage.get('voicePrivacyMode')).toBe(false)
  })

  it('sets and gets values', async () => {
    await storage.set('hudEnabled', false)
    expect(await storage.get('hudEnabled')).toBe(false)
    await storage.set('hudPosition', 'top-left')
    expect(await storage.get('hudPosition')).toBe('top-left')
  })

  it('getMultiple returns requested keys', async () => {
    await storage.set('hudEnabled', false)
    await storage.set('hudPosition', 'top-left')
    const vals = await storage.getMultiple(['hudEnabled', 'hudPosition'])
    expect(vals).toEqual({ hudEnabled: false, hudPosition: 'top-left' })
  })

  it('supports promise-style chrome.storage.local.get for array keys', async () => {
    mockStorage = { hudEnabled: false, hudPosition: 'top-left', extra: 'ignore-me' }
    await expect(chrome.storage.local.get(['hudEnabled', 'hudPosition'])).resolves.toEqual({
      hudEnabled: false,
      hudPosition: 'top-left',
    })
  })

  it('supports promise-style chrome.storage.local.get for object defaults', async () => {
    mockStorage = { hudEnabled: false }
    await expect(
      chrome.storage.local.get({ hudEnabled: true, hudPosition: 'bottom-right' })
    ).resolves.toEqual({
      hudEnabled: false,
      hudPosition: 'bottom-right',
    })
  })

  it('logEvent appends and prunes events', async () => {
    // add 501 events to force pruning
    for (let i = 0; i < 501; i++) {
      await storage.logEvent({ type: 'spin', platformSlug: 'x', timestamp: i, data: {} })
    }
    const events = (await storage.get('analyticsEvents')) as AnalyticsEvent[]
    expect(events.length).toBe(500)
    expect(events[0].timestamp).toBe(1)
  })

  it('clear wipes storage and cache', async () => {
    await storage.set('hudEnabled', false)
    await storage.clear()
    const hud = await storage.get('hudEnabled')
    expect(hud).toBe(true)
  })

  it('onChanged listener updates cache and calls callback', () => {
    const cb = vi.fn()
    storage.onChanged(cb)
    // simulate chrome event
    const listener = (chrome.storage.onChanged.addListener as any).mock.calls[0][0]
    const changes = { hudEnabled: { oldValue: true, newValue: false } }
    listener(changes, 'local')
    expect(cb).toHaveBeenCalledWith(changes)
  })
})
