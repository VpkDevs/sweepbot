/**
 * Currency utilities — formatting, calculations, conversions.
 */

/**
 * Format amount as currency (USD)
 */
export function formatUSD(amount: number, includeSymbol = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return includeSymbol ? `$${formatted}` : formatted
}

/**
 * Format amount with K/M/B suffixes
 * e.g., 1500 → "1.5K", 1000000 → "1M"
 */
export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1e9) {
    return (amount / 1e9).toFixed(1) + 'B'
  }
  if (Math.abs(amount) >= 1e6) {
    return (amount / 1e6).toFixed(1) + 'M'
  }
  if (Math.abs(amount) >= 1e3) {
    return (amount / 1e3).toFixed(1) + 'K'
  }
  return amount.toFixed(0)
}

/**
 * Format coins (SC or GC)
 */
export function formatCoins(amount: number, type: 'sc' | 'gc' = 'sc'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))

  const suffix = type === 'sc' ? 'SC' : 'GC'
  return `${formatted} ${suffix}`
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Parse currency string to number
 * e.g., "$1,234.56" → 1234.56
 */
export function parseCurrency(str: string): number {
  const cleaned = str.replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

/**
 * Calculate percentage change
 */
export function percentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100
}

/**
 * Format percentage change with sign
 */
export function formatPercentageChange(oldValue: number, newValue: number): string {
  const change = percentageChange(oldValue, newValue)
  const sign = change > 0 ? '+' : change < 0 ? '' : '±'
  return `${sign}${change.toFixed(2)}%`
}

/**
 * Apply multiplier to amount with tax
 */
export function applyTax(amount: number, taxRate: number): number {
  return amount * (1 - taxRate / 100)
}

/**
 * Calculate cost basis for tax purposes
 */
export function calculateCostBasis(amount: number, baselineValue: number): number {
  return Math.max(0, amount - baselineValue)
}
