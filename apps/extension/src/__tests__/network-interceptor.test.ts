import type { PlatformConfig } from '../lib/platforms'
import {
  type InterceptedBalance,
  type InterceptedTransaction,
  NetworkInterceptor,
} from '../lib/interceptor'

type Extractor = {
  extractDataFromResponse: (url: string, data: unknown) => void
}

describe('NetworkInterceptor', () => {
  let interceptor: NetworkInterceptor
  const fakePlatform: PlatformConfig = {
    slug: 'test',
    domains: ['test.com'],
    gameUrlPatterns: [],
    signupUrlPatterns: [],
    affiliateUrlPatterns: [],
    affiliateInjectionSelectors: [],
    color: '',
    name: '',
    domain: '',
    balanceApiPatterns: [{ urlPattern: /balance/, scPath: 'data.sc', gcPath: 'data.gc' }],
    transactionApiPatterns: [
      {
        urlPattern: /spin/,
        betAmountPath: 'data.bet',
        winAmountPath: 'data.win',
        gameIdPath: 'data.gameId',
        roundIdPath: 'data.roundId',
      },
    ],
  }

  beforeEach(() => {
    interceptor = new NetworkInterceptor()
    // do not initialize here; tests will call init after any stubs
  })

  afterEach(() => {
    interceptor.destroy()
    // restore globals if vitest replaced them
    vi.restoreAllMocks()
  })

  it('calls onBalance when matching response arrives', () => {
    interceptor.initialize(fakePlatform)
    const results: InterceptedBalance[] = []
    interceptor.onBalanceDetected((b) => results.push(b))

    const url = 'https://api.test.com/user/balance'
    const data = { data: { sc: 42, gc: 100 } }
    // call private method directly
    ;(interceptor as unknown as Extractor).extractDataFromResponse(url, data)

    expect(results.length).toBe(1)
    expect(results[0]).toMatchObject({ platformSlug: 'test', scBalance: 42, gcBalance: 100 })
  })

  it('calls onTransaction when matching spin response arrives', () => {
    interceptor.initialize(fakePlatform)
    const txs: InterceptedTransaction[] = []
    interceptor.onTransactionDetected((t) => txs.push(t))

    const url = 'https://api.test.com/game/spin'
    const data = { data: { bet: 5, win: 15, gameId: 'g1', roundId: 'r1' } }
    ;(interceptor as unknown as Extractor).extractDataFromResponse(url, data)

    expect(txs.length).toBe(1)
    expect(txs[0]).toMatchObject({
      platformSlug: 'test',
      betAmount: 5,
      winAmount: 15,
      result: 'win',
    })
  })
})
