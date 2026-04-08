/**
 * Browser-safe Entity Recognizer.
 * Adapted from @sweepbot/flows/src/interpreter/entity-recognizer.ts
 * Pure TypeScript — zero external dependencies.
 */

// ─── Platform aliases ─────────────────────────────────────────────────────────

const PLATFORM_ALIASES = new Map<string, string>([
  ['chumba', 'chumba'],
  ['cc', 'chumba'],
  ['chumba casino', 'chumba'],
  ['luckyland', 'luckyland'],
  ['lucky', 'luckyland'],
  ['luckyland slots', 'luckyland'],
  ['stake', 'stake'],
  ['stake.us', 'stake'],
  ['pulsz', 'pulsz'],
  ['wow', 'wowvegas'],
  ['wow vegas', 'wowvegas'],
  ['wowvegas', 'wowvegas'],
  ['fortune', 'fortunecoins'],
  ['fortune coins', 'fortunecoins'],
  ['fortunecoins', 'fortunecoins'],
  ['funrize', 'funrize'],
  ['mcluck', 'mcluck'],
  ['high5', 'high5casino'],
  ['high 5', 'high5casino'],
])

const PLATFORM_URLS: Record<string, string> = {
  chumba: 'https://www.chumbacasino.com',
  luckyland: 'https://www.luckylandslots.com',
  stake: 'https://stake.us',
  pulsz: 'https://www.pulsz.com',
  wowvegas: 'https://www.wowvegas.com',
  fortunecoins: 'https://www.fortunecoins.com',
  funrize: 'https://www.funrize.com',
  mcluck: 'https://www.mcluck.com',
  high5casino: 'https://high5casino.com',
}

// ─── Game aliases ─────────────────────────────────────────────────────────────

const GAME_ALIASES = new Map<string, string>([
  ['sweet bonanza', 'sweet-bonanza'],
  ['sweet bo', 'sweet-bonanza'],
  ['bonanza', 'sweet-bonanza'],
  ['gates of olympus', 'gates-of-olympus'],
  ['gates', 'gates-of-olympus'],
  ['olympus', 'gates-of-olympus'],
  ['sugar rush', 'sugar-rush'],
  ['wild berries', 'wild-berries'],
  ['book of ra', 'book-of-ra'],
  ['starburst', 'starburst'],
  ['big bass', 'big-bass-splash'],
])

// ─── Schedule detection ───────────────────────────────────────────────────────

const SCHEDULE_PATTERNS: Array<{
  pattern: RegExp
  toCron: (m: RegExpMatchArray) => string
  humanize: (m: RegExpMatchArray) => string
}> = [
  {
    // "every day at 3 pm" / "daily at 3:30 pm"
    pattern: /(?:every\s+day|daily)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
    toCron: (m) => {
      let h = parseInt(m[1])
      const min = m[2] ? parseInt(m[2]) : 0
      const ampm = m[3]?.toLowerCase()
      if (ampm === 'pm' && h < 12) h += 12
      if (ampm === 'am' && h === 12) h = 0
      return `${min} ${h} * * *`
    },
    humanize: (m) =>
      `Every day at ${m[1]}${m[2] ? `:${m[2]}` : ''}${m[3] ? ` ${m[3].toUpperCase()}` : ''}`,
  },
  {
    // "every hour" / "hourly"
    pattern: /every\s+hour|hourly/i,
    toCron: () => '0 * * * *',
    humanize: () => 'Every hour',
  },
  {
    // "every 30 minutes" / "every N mins"
    pattern: /every\s+(\d+)\s+min(?:ute)?s?/i,
    toCron: (m) => `*/${m[1]} * * * *`,
    humanize: (m) => `Every ${m[1]} minutes`,
  },
  {
    // "every monday at 9 am"
    pattern:
      /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
    toCron: (m) => {
      const DOW: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      }
      let h = parseInt(m[2])
      const min = m[3] ? parseInt(m[3]) : 0
      const ampm = m[4]?.toLowerCase()
      if (ampm === 'pm' && h < 12) h += 12
      if (ampm === 'am' && h === 12) h = 0
      return `${min} ${h} * * ${DOW[m[1].toLowerCase()]}`
    },
    humanize: (m) =>
      `Every ${m[1]} at ${m[2]}${m[3] ? `:${m[3]}` : ''}${m[4] ? ` ${m[4].toUpperCase()}` : ''}`,
  },
]

// ─── Condition / multiplier patterns ─────────────────────────────────────────

export interface ExtractedCondition {
  type: 'multiplier_win' | 'fixed_win' | 'fixed_loss' | 'continue'
  multiplier?: number
  amount?: number
  direction: 'continue' | 'stop'
  rawText: string
}

const CONDITION_PATTERNS: Array<{
  pattern: RegExp
  extract: (m: RegExpMatchArray, raw: string) => ExtractedCondition
}> = [
  {
    // "if winnings are 5x the bonus" / "if i win 5x" / "5 times the bonus amount"
    pattern:
      /(?:if|when).*?(?:win|winning|profit|payout).*?(\d+(?:\.\d+)?)\s*[x×]|(\d+(?:\.\d+)?)\s*[x×]\s*(?:the\s+)?(?:bonus|initial|starting)/i,
    extract: (m, raw) => ({
      type: 'multiplier_win',
      multiplier: parseFloat(m[1] || m[2]),
      direction: 'continue',
      rawText: raw,
    }),
  },
  {
    // "if my winnings equal or exceed 5x" / "5x or more"
    pattern: /(\d+(?:\.\d+)?)\s*[x×]\s*(?:or\s+more|the\s+bonus|bonus amount)/i,
    extract: (m, raw) => ({
      type: 'multiplier_win',
      multiplier: parseFloat(m[1]),
      direction: 'continue',
      rawText: raw,
    }),
  },
  {
    // "keep spinning / continue if" → direction: continue
    pattern: /(?:keep|continue)\s+(?:spinning|playing)/i,
    extract: (_m, raw) => ({
      type: 'continue',
      direction: 'continue',
      rawText: raw,
    }),
  },
]

// ─── Extracted entity map ─────────────────────────────────────────────────────

export interface RecognizedEntities {
  platforms: Array<{ canonical: string; url: string; raw: string }>
  games: Array<{ canonical: string; raw: string }>
  schedule: { cron: string; humanReadable: string; timezone: string } | null
  conditions: ExtractedCondition[]
  hasBonusClaim: boolean
  hasLogin: boolean
  hasSpin: boolean
  hasContinueOnWin: boolean
  hasStopOnLoss: boolean
  multiplierThreshold: number | null
  rawInput: string
}

// ─── EntityRecognizer ─────────────────────────────────────────────────────────

export class EntityRecognizer {
  recognize(text: string): RecognizedEntities {
    const lower = text.toLowerCase()

    return {
      platforms: this.extractPlatforms(lower),
      games: this.extractGames(lower),
      schedule: this.extractSchedule(lower),
      conditions: this.extractConditions(text),
      hasBonusClaim: this.hasBonusClaim(lower),
      hasLogin: this.hasLogin(lower),
      hasSpin: this.hasSpin(lower),
      hasContinueOnWin: this.hasContinueOnWin(lower),
      hasStopOnLoss: this.hasStopOnLoss(lower),
      multiplierThreshold: this.extractMultiplier(lower),
      rawInput: text,
    }
  }

  private extractPlatforms(lower: string) {
    const found: Array<{ canonical: string; url: string; raw: string }> = []
    for (const [alias, canonical] of PLATFORM_ALIASES) {
      if (lower.includes(alias)) {
        // avoid duplicates
        if (!found.some((p) => p.canonical === canonical)) {
          found.push({ canonical, url: PLATFORM_URLS[canonical] ?? '', raw: alias })
        }
      }
    }
    return found
  }

  private extractGames(lower: string) {
    const found: Array<{ canonical: string; raw: string }> = []
    for (const [alias, canonical] of GAME_ALIASES) {
      if (lower.includes(alias)) {
        if (!found.some((g) => g.canonical === canonical)) {
          found.push({ canonical, raw: alias })
        }
      }
    }
    // Generic "slot X" pattern
    const slotMatch = lower.match(/slot\s+([a-z0-9\s-]+)(?:\s|$)/i)
    if (slotMatch && !found.length) {
      found.push({
        canonical: (slotMatch[1] ?? '').trim().replace(/\s+/g, '-'),
        raw: slotMatch[0].trim(),
      })
    }
    return found
  }

  private extractSchedule(lower: string) {
    for (const { pattern, toCron, humanize } of SCHEDULE_PATTERNS) {
      const m = lower.match(pattern)
      if (m) {
        return {
          cron: toCron(m),
          humanReadable: humanize(m),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
      }
    }
    return null
  }

  private extractConditions(text: string): ExtractedCondition[] {
    const conditions: ExtractedCondition[] = []
    for (const { pattern, extract } of CONDITION_PATTERNS) {
      const m = text.match(pattern)
      if (m) conditions.push(extract(m, text))
    }
    return conditions
  }

  private hasBonusClaim(lower: string) {
    return (
      lower.includes('bonus') ||
      lower.includes('daily reward') ||
      lower.includes('login reward') ||
      lower.includes('free coins') ||
      lower.includes('collect') ||
      lower.includes('claim')
    )
  }

  private hasLogin(lower: string) {
    return lower.includes('login') || lower.includes('log in') || lower.includes('sign in')
  }

  private hasSpin(lower: string) {
    return (
      lower.includes('spin') ||
      lower.includes('play') ||
      lower.includes('bet') ||
      lower.includes('wager')
    )
  }

  private hasContinueOnWin(lower: string) {
    return (
      lower.includes('keep spinning') ||
      lower.includes('continue') ||
      lower.includes('keep going') ||
      lower.includes('keep playing')
    )
  }

  private hasStopOnLoss(lower: string) {
    return (
      lower.includes('if not, stop') ||
      lower.includes('otherwise stop') ||
      lower.includes('if i lose') ||
      lower.includes("if it doesn't") ||
      lower.includes('if they do not')
    )
  }

  extractMultiplier(lower: string): number | null {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*[x×]\s*(?:the\s+)?(?:bonus|initial|starting|bet)/i,
      /(?:win|profit|gain)\s+(\d+(?:\.\d+)?)\s*[x×]/i,
      /(\d+(?:\.\d+)?)\s*times\s+(?:the\s+)?(?:bonus|amount|bet)/i,
    ]
    for (const p of patterns) {
      const m = lower.match(p)
      if (m) return parseFloat(m[1])
    }
    return null
  }
}
