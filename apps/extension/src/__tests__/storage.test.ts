import { storage, AnalyticsEvent } from '../lib/storage'

describe('StorageManager', () => {
  let mockStorage: Record<string, any>
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
              if (keys == null) cb(mockStorage)
              else if (Array.isArray(keys)) {
                const res: any = {}
                for (const k of keys) res[k] = mockStorage[k]
                cb(res)
              } else {
                cb({ [keys]: mockStorage[keys] })
              }
              return
            }
            // return promise
            return Promise.resolve(keys == null ? mockStorage : { [keys]: mockStorage[keys] })
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
          addListener: vi.fn()
        }
      }
    }
  })

  it('returns default values when empty', async () => {
    await storage.clear()
    const hud = await storage.get('hudEnabled')
    expect(hud).toBe(true)
    const pos = await storage.get('hudPosition')
    expect(pos).toBe('bottom-right')
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