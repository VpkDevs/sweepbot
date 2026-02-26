/**
 * Platform detection engine.
 * Maps known sweepstakes casino domains to platform metadata,
 * affiliate tracking configs, and game transaction patterns.
 */

export interface PlatformConfig {
  /** Canonical platform slug matching the API */
  slug: string
  /** Display name */
  name: string
  /** Primary domain (used for matching) */
  domain: string
  /** All domains that belong to this platform */
  domains: string[]
  /** Hex brand color */
  color: string
  /** SweepBot affiliate referral link (replace REF_CODE at runtime) */
  affiliateUrl: string | null
  /** URL pattern(s) that indicate the user is in an active game */
  gameUrlPatterns: RegExp[]
  /** JSON path patterns to extract balance from API responses */
  balanceApiPatterns: BalanceApiPattern[]
  /** JSON path patterns to extract transaction data from API responses */
  transactionApiPatterns: TransactionApiPattern[]
  /** URL fragment patterns that indicate a signup/registration flow */
  signupUrlPatterns: RegExp[]
  /** CSS selectors for injecting affiliate banners */
  affiliateInjectionSelectors: string[]
}

export interface BalanceApiPattern {
  urlPattern: RegExp
  /** Dot-notation path into the response JSON, e.g. "data.balance.sweeps_coins" */
  scPath: string
  gcPath: string
}

export interface TransactionApiPattern {
  urlPattern: RegExp
  /** Dot-notation paths for spin/bet result data */
  betAmountPath?: string
  winAmountPath?: string
  gameIdPath?: string
  roundIdPath?: string
  /** 'win' | 'loss' | 'push' result field path */
  resultPath?: string
}

// ---------------------------------------------------------------------------
// Platform registry
// ---------------------------------------------------------------------------

export const PLATFORMS: readonly PlatformConfig[] = [
  {
    slug: 'chumba',
    name: 'Chumba Casino',
    domain: 'chumbacasino.com',
    domains: ['chumbacasino.com'],
    color: '#e91e8c',
    affiliateUrl: 'https://www.chumbacasino.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/chumbacasino\.com\/(?:slots|games|play)/i],
    signupUrlPatterns: [/chumbacasino\.com\/(?:register|sign-up|signup)/i],
    affiliateInjectionSelectors: ['.register-page', '#signup-form', '.cta-register'],
    balanceApiPatterns: [
      {
        urlPattern: /\/api\/v\d+\/user\/balance/i,
        scPath: 'data.sweeps_coins',
        gcPath: 'data.gold_coins',
      },
    ],
    transactionApiPatterns: [
      {
        urlPattern: /\/api\/v\d+\/games?\/spin/i,
        betAmountPath: 'data.bet',
        winAmountPath: 'data.payout',
        gameIdPath: 'data.game_id',
        roundIdPath: 'data.round_id',
      },
    ],
  },
  {
    slug: 'luckyland',
    name: 'LuckyLand Slots',
    domain: 'luckyland.com',
    domains: ['luckyland.com', 'luckylandslots.com'],
    color: '#ffd700',
    affiliateUrl: 'https://www.luckyland.com/?ref=SWEEPBOT',
    gameUrlPatterns: [/luckyland\.com\/play/i],
    signupUrlPatterns: [/luckyland\.com\/(?:register|sign-up)/i],
    affiliateInjectionSelectors: ['.register-container', '#sign-up'],
    balanceApiPatterns: [
      {
        urlPattern: /\/api\/wallet\/balance/i,
        scPath: 'sweepsCoins',
        gcPath: 'goldCoins',
      },
    ],
    transactionApiPatterns: [
      {
        urlPattern: /\/api\/games?\/bet/i,
        betAmountPath: 'amount',
        winAmountPath: 'winAmount',
        gameIdPath: 'gameCode',
        roundIdPath: 'roundId',
      },
    ],
  },
  {
    slug: 'stake-us',
    name: 'Stake.us',
    domain: 'stake.us',
    domains: ['stake.us'],
    color: '#00e701',
    affiliateUrl: 'https://stake.us/?c=SWEEPBOT',
    gameUrlPatterns: [/stake\.us\/casino\/games\//i],
    signupUrlPatterns: [/stake\.us\/#register/i, /stake\.us\/register/i],
    affiliateInjectionSelectors: ['.register-container', '.modal-register'],
    balanceApiPatterns: [
      {
        urlPattern: /graphql/i,
        scPath: 'data.user.wallet.sweepstakesCoin.amount',
        gcPath: 'data.user.wallet.goldCoin.amount',
      },
    ],
    transactionApiPatterns: [
      {
        urlPattern: /graphql/i,
        betAmountPath: 'data.gameCreate.amount',
        winAmountPath: 'data.gameCreate.payout',
        gameIdPath: 'data.gameCreate.game.slug',
        roundIdPath: 'data.gameCreate.id',
      },
    ],
  },
  {
    slug: 'pulsz',
    name: 'Pulsz',
    domain: 'pulsz.com',
    domains: ['pulsz.com'],
    color: '#7c3aed',
    affiliateUrl: 'https://www.pulsz.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/pulsz\.com\/games?\//i, /pulsz\.com\/play\//i],
    signupUrlPatterns: [/pulsz\.com\/register/i],
    affiliateInjectionSelectors: ['.registration-page', '#signup'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/account\/balance/i, scPath: 'sc_balance', gcPath: 'gc_balance' },
    ],
    transactionApiPatterns: [
      {
        urlPattern: /\/api\/games?\/spin/i,
        betAmountPath: 'bet',
        winAmountPath: 'win',
        gameIdPath: 'gameId',
        roundIdPath: 'roundId',
      },
    ],
  },
  {
    slug: 'wow-vegas',
    name: 'WOW Vegas',
    domain: 'wowvegas.com',
    domains: ['wowvegas.com'],
    color: '#ff6b35',
    affiliateUrl: 'https://www.wowvegas.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/wowvegas\.com\/(?:slots|games?)\//i],
    signupUrlPatterns: [/wowvegas\.com\/register/i],
    affiliateInjectionSelectors: ['.register-form'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/v\d+\/balance/i, scPath: 'sweepsBalance', gcPath: 'goldBalance' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'fortune-coins',
    name: 'Fortune Coins',
    domain: 'fortunecoins.com',
    domains: ['fortunecoins.com'],
    color: '#f59e0b',
    affiliateUrl: 'https://www.fortunecoins.com/register?referral=SWEEPBOT',
    gameUrlPatterns: [/fortunecoins\.com\/games?\//i],
    signupUrlPatterns: [/fortunecoins\.com\/register/i],
    affiliateInjectionSelectors: ['.register-page'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/user\/coins/i, scPath: 'fortune_coins', gcPath: 'gold_coins' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'funrize',
    name: 'Funrize',
    domain: 'funrize.com',
    domains: ['funrize.com'],
    color: '#ec4899',
    affiliateUrl: 'https://www.funrize.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/funrize\.com\/(?:play|games?)\//i],
    signupUrlPatterns: [/funrize\.com\/register/i],
    affiliateInjectionSelectors: ['.signup-container'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/wallet/i, scPath: 'sc', gcPath: 'fc' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'zula',
    name: 'Zula Casino',
    domain: 'zulacasino.com',
    domains: ['zulacasino.com'],
    color: '#06b6d4',
    affiliateUrl: 'https://www.zulacasino.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/zulacasino\.com\/games?\//i],
    signupUrlPatterns: [/zulacasino\.com\/register/i],
    affiliateInjectionSelectors: ['.register-wrapper'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/v\d+\/user\/balance/i, scPath: 'zula_coins', gcPath: 'gold_coins' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'crown-coins',
    name: 'Crown Coins Casino',
    domain: 'crowncoinscasino.com',
    domains: ['crowncoinscasino.com'],
    color: '#eab308',
    affiliateUrl: 'https://www.crowncoinscasino.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/crowncoinscasino\.com\/games?\//i],
    signupUrlPatterns: [/crowncoinscasino\.com\/register/i],
    affiliateInjectionSelectors: ['.register-page'],
    balanceApiPatterns: [
      { urlPattern: /\/balance/i, scPath: 'crown_coins', gcPath: 'gold_coins' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'mcluck',
    name: 'McLuck',
    domain: 'mcluck.com',
    domains: ['mcluck.com'],
    color: '#16a34a',
    affiliateUrl: 'https://www.mcluck.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/mcluck\.com\/(?:play|games?)\//i],
    signupUrlPatterns: [/mcluck\.com\/register/i],
    affiliateInjectionSelectors: ['.signup-page'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/user\/balance/i, scPath: 'sc_coins', gcPath: 'gc_coins' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'high5',
    name: 'High 5 Casino',
    domain: 'high5casino.com',
    domains: ['high5casino.com'],
    color: '#dc2626',
    affiliateUrl: 'https://www.high5casino.com/register?aff=SWEEPBOT',
    gameUrlPatterns: [/high5casino\.com\/games?\//i],
    signupUrlPatterns: [/high5casino\.com\/register/i],
    affiliateInjectionSelectors: ['.register-form', '#signup-wrapper'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/v\d+\/wallet/i, scPath: 'h5c_balance', gcPath: 'gold_balance' },
    ],
    transactionApiPatterns: [],
  },
  {
    slug: 'global-poker',
    name: 'Global Poker',
    domain: 'globalpoker.com',
    domains: ['globalpoker.com'],
    color: '#1d4ed8',
    affiliateUrl: 'https://www.globalpoker.com/register?ref=SWEEPBOT',
    gameUrlPatterns: [/globalpoker\.com\/(?:lobby|table|tournament)/i],
    signupUrlPatterns: [/globalpoker\.com\/register/i],
    affiliateInjectionSelectors: ['.signup-container'],
    balanceApiPatterns: [
      { urlPattern: /\/api\/account\/balance/i, scPath: 'sweeps_poker_chips', gcPath: 'gold_poker_chips' },
    ],
    transactionApiPatterns: [],
  },
] as const

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** Get platform config for the given URL, or null if not a known platform */
export function detectPlatform(url: string): PlatformConfig | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return (
      PLATFORMS.find((p) =>
        p.domains.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`),
        ),
      ) ?? null
    )
  } catch {
    return null
  }
}

/** Returns true if the URL is an active game page on a known platform */
export function isGamePage(url: string, platform: PlatformConfig): boolean {
  return platform.gameUrlPatterns.some((re) => re.test(url))
}

/** Returns true if the URL is a signup page where we should inject an affiliate prompt */
export function isSignupPage(url: string, platform: PlatformConfig): boolean {
  return platform.signupUrlPatterns.some((re) => re.test(url))
}

/** Build a personalised affiliate URL with a user ref code */
export function buildAffiliateUrl(platform: PlatformConfig, userRefCode: string): string | null {
  if (!platform.affiliateUrl) return null
  return platform.affiliateUrl.replace('SWEEPBOT', userRefCode)
}
