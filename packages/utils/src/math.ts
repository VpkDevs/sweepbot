/**
 * Math utilities — RTP, probability, statistical calculations.
 */

/**
 * Calculate RTP (Return to Player) percentage
 */
export function calculateRtp(totalWagered: number, totalWon: number): number {
  if (totalWagered === 0) return 0
  return (totalWon / totalWagered) * 100
}

/**
 * Calculate standard deviation from values
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Calculate confidence interval for RTP
 * Uses Wilson score interval (more accurate for small samples)
 */
export function rtpConfidenceInterval(
  wins: number,
  total: number,
  confidence = 0.95
): { lower: number; upper: number; rtp: number } {
  const rtp = (wins / total) * 100
  if (total === 0) return { lower: 0, upper: 100, rtp: 0 }

  const z = confidence === 0.95 ? 1.96 : 2.576 // 95% or 99% CI
  const phat = wins / total
  const denominator = 1 + (z * z) / total
  const centre = (phat + (z * z) / (2 * total)) / denominator
  const margin =
    (z * Math.sqrt((phat * (1 - phat)) / total + (z * z) / (4 * total * total))) / denominator

  return {
    rtp,
    lower: Math.max(0, (centre - margin) * 100),
    upper: Math.min(100, (centre + margin) * 100),
  }
}

/**
 * Calculate win rate from bets and wins
 */
export function winRate(wins: number, total: number): number {
  if (total === 0) return 0
  return (wins / total) * 100
}

/**
 * Calculate average bet size
 */
export function averageBet(totalWagered: number, spinCount: number): number {
  if (spinCount === 0) return 0
  return totalWagered / spinCount
}

/**
 * Calculate average win size (when there is a win)
 */
export function averageWin(totalWins: number, winCount: number): number {
  if (winCount === 0) return 0
  return totalWins / winCount
}

/**
 * Calculate session volatility classification
 */
export function classifyVolatility(values: number[], mean: number): 'low' | 'medium' | 'high' {
  const stdDev = standardDeviation(values)
  const cv = stdDev / (mean || 1) // Coefficient of variation

  if (cv < 1) return 'low'
  if (cv < 2) return 'medium'
  return 'high'
}

/**
 * Probability of at least one win in N trials
 */
export function probabilityOfWin(winRate: number, trials: number): number {
  const p = winRate / 100
  return 1 - Math.pow(1 - p, trials)
}

/**
 * Round to N decimal places
 */
export function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
