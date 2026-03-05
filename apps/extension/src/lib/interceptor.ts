/**
 * Network interceptor for XHR/Fetch monitoring.
 * Extracts balance and transaction data from API responses in real-time.
 * Injected into content script context via content.ts.
 */

import type { PlatformConfig } from './platforms'

export interface InterceptedTransaction {
  platformSlug: string
  gameId: string
  roundId: string
  betAmount: number
  winAmount: number
  result: 'win' | 'loss' | 'push'
  timestamp: number
}

export interface InterceptedBalance {
  platformSlug: string
  scBalance: number
  gcBalance: number
  timestamp: number
}

class NetworkInterceptor {
  private platform: PlatformConfig | null = null
  private onTransaction: ((tx: InterceptedTransaction) => void) | null = null
  private onBalance: ((balance: InterceptedBalance) => void) | null = null
  private originalFetch: typeof window.fetch | null = null
  private originalXhr: typeof XMLHttpRequest | null = null

  initialize(platform: PlatformConfig): void {
    this.platform = platform
    this.interceptFetch()
    this.interceptXhr()
  }

  /**
   * Register callback for transaction interception
   */
  onTransactionDetected(callback: (tx: InterceptedTransaction) => void): void {
    this.onTransaction = callback
  }

  /**
   * Register callback for balance interception
   */
  onBalanceDetected(callback: (balance: InterceptedBalance) => void): void {
    this.onBalance = callback
  }

  /**
   * Intercept window.fetch()
   */
  private interceptFetch(): void {
    if (!this.platform || this.originalFetch) return

    this.originalFetch = window.fetch
    const self = this

    window.fetch = function (this: typeof globalThis, ...args: Parameters<typeof fetch>) {
      const [resource] = args
      const url = typeof resource === 'string' ? resource : (resource as Request).url

      return self.originalFetch!.apply(this, args).then((response) => {
        // Clone response for parsing without consuming the stream
        const cloned = response.clone()
        cloned.json().then((data) => {
          self.extractDataFromResponse(url, data)
        }).catch(() => {
          // Not JSON or failed to parse, ignore
        })
        return response
      }).catch((error) => {
        throw error
      })
    } as any
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXhr(): void {
    if (!this.platform || this.originalXhr) return

    this.originalXhr = XMLHttpRequest
    const self = this

    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function (method: string, url: string) {
      ;(this as any)._sweepbot_url = url
      ;(this as any)._sweepbot_method = method
      return originalOpen.apply(this, arguments as any)
    }

    XMLHttpRequest.prototype.send = function () {
      const originalOnReadyStateChange = this.onreadystatechange
      const url = (this as any)._sweepbot_url

      this.onreadystatechange = function (ev: Event) {
        if (this.readyState === 4) {
          try {
            const data = JSON.parse(this.responseText)
            self.extractDataFromResponse(url, data)
          } catch {
            // Ignore non-JSON responses
          }
        }
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.call(this, ev)
        }
      }

      return originalSend.apply(this, arguments as any)
    }
  }

  /**
   * Extract data from API response using platform patterns
   */
  private extractDataFromResponse(url: string, data: unknown): void {
    if (!this.platform) return

    // Try to extract balance
    for (const pattern of this.platform.balanceApiPatterns) {
      if (pattern.urlPattern.test(url)) {
        const scBalance = this.getDeepValue(data, pattern.scPath)
        const gcBalance = this.getDeepValue(data, pattern.gcPath)

        if (typeof scBalance === 'number' && typeof gcBalance === 'number') {
          this.onBalance?.({
            platformSlug: this.platform.slug,
            scBalance,
            gcBalance,
            timestamp: Date.now(),
          })
        }
      }
    }

    // Try to extract transaction
    for (const pattern of this.platform.transactionApiPatterns) {
      if (pattern.urlPattern.test(url)) {
        const betAmount = pattern.betAmountPath
          ? this.getDeepValue(data, pattern.betAmountPath)
          : null
        const winAmount = pattern.winAmountPath
          ? this.getDeepValue(data, pattern.winAmountPath)
          : null
        const gameId = pattern.gameIdPath ? this.getDeepValue(data, pattern.gameIdPath) : null
        const roundId = pattern.roundIdPath
          ? this.getDeepValue(data, pattern.roundIdPath)
          : null

        if (
          typeof betAmount === 'number' &&
          typeof winAmount === 'number' &&
          typeof gameId === 'string' &&
          typeof roundId === 'string'
        ) {
          const result =
            winAmount > betAmount ? 'win' : winAmount < betAmount ? 'loss' : 'push'

          this.onTransaction?.({
            platformSlug: this.platform.slug,
            gameId,
            roundId,
            betAmount,
            winAmount,
            result,
            timestamp: Date.now(),
          })
        }
      }
    }
  }

  /**
   * Get nested value from object using dot-notation path
   * e.g. "data.user.balance" -> data.user.balance
   */
  private getDeepValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return null

    const parts = path.split('.')
    let current: any = obj

    for (const part of parts) {
      if (current == null) return null
      current = current[part]
    }

    return current
  }

  /**
   * Clean up interceptors
   */
  destroy(): void {
    if (this.originalFetch) {
      window.fetch = this.originalFetch
      this.originalFetch = null
    }
    if (this.originalXhr) {
      // XHR prototype is harder to restore; just clear our handlers
      this.originalXhr = null
    }
    this.onTransaction = null
    this.onBalance = null
    this.platform = null
  }
}

export const networkInterceptor = new NetworkInterceptor()
