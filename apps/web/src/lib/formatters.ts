/**
 * String formatting utilities for consistent data presentation
 */

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

/**
 * Format a date to a readable string (e.g., "Mar 15, 2024")
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return isValid(d) ? format(d, 'MMM d, yyyy') : '—'
  } catch {
    return '—'
  }
}

/**
 * Format a date and time (e.g., "Mar 15, 2024 2:30 PM")
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return isValid(d) ? format(d, 'MMM d, yyyy p') : '—'
  } catch {
    return '—'
  }
}

/**
 * Format a time only (e.g., "2:30 PM")
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return isValid(d) ? format(d, 'p') : '—'
  } catch {
    return '—'
  }
}

/**
 * Format currency for sweepstakes coins (e.g., "$1,234.56")
 */
export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format sweepstakes coins (e.g., "1,234.56 SC")
 */
export function formatSC(value: number, decimals = 2): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return `${formatted} SC`
}

/**
 * Format a percentage (e.g., "94.5%")
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format a number with commas (e.g., "1,234,567")
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format duration in hours and minutes (e.g., "2h 30m")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—'
  } catch {
    return '—'
  }
}

/**
 * Format RTP (Return To Player) percentage
 * Returns { text: "94.5%", className: "text-green-500" } based on value
 */
export function formatRTP(value: number): { text: string; className: string } {
  const percentage = value * 100
  const text = `${percentage.toFixed(1)}%`

  if (percentage >= 100) return { text, className: 'text-green-400' }
  if (percentage >= 95) return { text, className: 'text-emerald-400' }
  if (percentage >= 90) return { text, className: 'text-blue-400' }
  if (percentage >= 85) return { text, className: 'text-yellow-400' }
  return { text, className: 'text-red-400' }
}

/**
 * Format ISO duration (e.g., "PT1H30M" -> "1h 30m")
 */
export function formatIsoDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
  if (!match) return '—'

  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseInt(match[3]) : 0

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)

  return parts.join(' ') || '0s'
}
