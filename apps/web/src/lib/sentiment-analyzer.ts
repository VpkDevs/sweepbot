type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited'

interface SentimentResult {
  sentiment: Sentiment
  tags: string[]
}

const POSITIVE_KEYWORDS = ['big win', 'jackpot', 'amazing', 'great', 'love', 'nice', 'bonus', 'won', 'winning']
const NEGATIVE_KEYWORDS = ['lost', 'terrible', 'bad', 'hate', 'boring']
const FRUSTRATED_KEYWORDS = ['frustrating', 'frustrated', 'ugh', 'tilt', "can't"]
const EXCITED_KEYWORDS = ['incredible', 'unbelievable', 'wow', 'insane', 'omg', 'legendary']

const TAG_RULES: Array<[string, string]> = [
  ['big win', 'big_win'],
  ['jackpot', 'jackpot'],
  ['tilt', 'tilt'],
  ['bonus', 'bonus'],
  ['strategy', 'strategy'],
]

export function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase()

  const hasPositive = POSITIVE_KEYWORDS.some((kw) => lower.includes(kw))
  const hasNegative = NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw))
  const hasFrustrated = FRUSTRATED_KEYWORDS.some((kw) => lower.includes(kw))
  const hasExcited = EXCITED_KEYWORDS.some((kw) => lower.includes(kw))

  // Priority: frustrated > excited > positive > negative > neutral
  let sentiment: Sentiment = 'neutral'
  if (hasFrustrated) {
    sentiment = 'frustrated'
  } else if (hasExcited) {
    sentiment = 'excited'
  } else if (hasPositive) {
    sentiment = 'positive'
  } else if (hasNegative) {
    sentiment = 'negative'
  }

  const tags = TAG_RULES.filter(([keyword]) => lower.includes(keyword)).map(([, tag]) => tag)

  return { sentiment, tags }
}
