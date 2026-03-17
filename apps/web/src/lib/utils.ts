import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a SC balance for display */
export function formatSC(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/** Format USD amount */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Format RTP percentage with color-coded CSS class */
export function formatRTP(rtp: number): { text: string; className: string } {
  const text = `${rtp.toFixed(2)}%`
  const className =
    rtp >= 100
      ? 'text-win'
      : rtp >= 95
        ? 'text-green-400'
        : rtp >= 90
          ? 'text-yellow-400'
          : 'text-loss'
  return { text, className }
}

/** Relative timestamp (e.g. "3 hours ago") */
export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/** Standard date format */
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  return format(new Date(date), fmt)
}

/** Compact large numbers: 1500000 → "1.5M" */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** Trust score tier color */
export function trustScoreColor(score: number): string {
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-blue-400'
  if (score >= 55) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

/** Trust score tier label */
export function trustScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 55) return 'Fair'
  if (score >= 40) return 'Poor'
  return 'Critical'
}

/** Confidence level badge color */
export function confidenceColor(level: string): string {
  switch (level) {
    case 'high':
      return 'text-green-400 bg-green-400/10'
    case 'medium':
      return 'text-yellow-400 bg-yellow-400/10'
    case 'low':
      return 'text-orange-400 bg-orange-400/10'
    default:
      return 'text-zinc-500 bg-zinc-500/10'
  }
}

/** Shared Recharts Tooltip contentStyle — dark zinc theme */
export const CHART_TOOLTIP_STYLE = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
} as const
