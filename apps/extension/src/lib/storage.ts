/**
 * Chrome Storage wrapper — unified local storage for extension state.
 * Wraps chrome.storage.local with type-safe getters/setters.
 */
import { createLogger } from './logger'

const log = createLogger('StorageManager')

export interface StorageSchema {
  userId: string | null
  authToken: string | null
  userRefCode: string | null
  sessionData: SessionStorageData | null
  platformCredentials: Record<string, PlatformCredential>
  hudEnabled: boolean
  hudPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  notificationPrefs: NotificationPreferences
  analyticsEvents: AnalyticsEvent[]
  lastSyncedAt: number
  affiliateNoShowUntil: Record<string, number>
}

export interface SessionStorageData {
  sessionId: string
  platformSlug: string
  startedAt: number
  coinsStart: { sc: number; gc: number }
  coinsCurrent: { sc: number; gc: number }
  transactionCount: number
  lastActivityAt: number
}

export interface PlatformCredential {
  platformSlug: string
  // TODO(security): encrypt these with Web Crypto API before storing —
  // currently stored as plaintext in chrome.storage.local
  username: string
  password: string
  storedAt: number
}

export interface NotificationPreferences {
  enableSurgeAlerts: boolean
  enableJackpotAlerts: boolean
  enableDailyDigest: boolean
  enableBonusReminders: boolean
  muted: boolean
}

export interface AnalyticsEvent {
  type: 'spin' | 'win' | 'balance_update' | 'session_start' | 'session_end'
  platformSlug: string
  timestamp: number
  data: Record<string, unknown>
}

const DEFAULT_STORAGE: StorageSchema = {
  userId: null,
  authToken: null,
  userRefCode: null,
  sessionData: null,
  platformCredentials: {},
  hudEnabled: true,
  hudPosition: 'bottom-right',
  notificationPrefs: {
    enableSurgeAlerts: true,
    enableJackpotAlerts: true,
    enableDailyDigest: true,
    enableBonusReminders: true,
    muted: false,
  },
  analyticsEvents: [],
  lastSyncedAt: 0,
  affiliateNoShowUntil: {},
}

export class StorageManager {
  private cache: Partial<StorageSchema> = {}
  private cacheReady = false

  /**
   * Initialize cache from Chrome storage
   */
  async init(): Promise<void> {
    if (this.cacheReady) return
    try {
      const items = await chrome.storage.local.get()
      this.cache = items as Partial<StorageSchema>
      this.cacheReady = true
    } catch (error) {
      log.error('Failed to initialize', { error })
      this.cache = {}
      this.cacheReady = true
    }
  }

  /**
   * Get a single value with type safety
   */
  async get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K]> {
    await this.init()
    if (key in this.cache) {
      return this.cache[key] as StorageSchema[K]
    }
    return DEFAULT_STORAGE[key]
  }

  /**
   * Set a single value
   */
  async set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
    await this.init()
    this.cache[key] = value
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      log.error('Failed to set key', { key: String(key), error })
    }
  }

  /**
   * Get multiple values
   */
  async getMultiple<K extends keyof StorageSchema>(
    keys: K[],
  ): Promise<Pick<StorageSchema, K>> {
    await this.init()
    const result = {} as Pick<StorageSchema, K>
    for (const key of keys) {
      result[key] = (this.cache[key] ?? DEFAULT_STORAGE[key]) as StorageSchema[K]
    }
    return result
  }

  /**
   * Append to analyticsEvents array (with auto-cleanup of old events)
   */
  async logEvent(event: AnalyticsEvent): Promise<void> {
    await this.init()
    const events = (this.cache.analyticsEvents ?? []) as AnalyticsEvent[]
    events.push(event)
    // Keep only last 500 events
    if (events.length > 500) {
      events.splice(0, events.length - 500)
    }
    await this.set('analyticsEvents', events)
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    this.cache = {}
    this.cacheReady = false
    try {
      await chrome.storage.local.clear()
    } catch (error) {
      log.error('Failed to clear storage', { error })
    }
  }

  /**
   * Watch for storage changes (cross-tab sync)
   */
  onChanged(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        // Update cache
        for (const [key, change] of Object.entries(changes)) {
          if ('newValue' in change) {
            (this.cache as Record<string, unknown>)[key] = change.newValue
          } else {
            delete (this.cache as Record<string, unknown>)[key]
          }
        }
        callback(changes)
      }
    })
  }
}

export const storage = new StorageManager()