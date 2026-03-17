import { z } from 'zod'

// ─── Granular factor types (used by Trust Index page and API consumers) ───────

export interface TrustFactor {
  factor: string
  score: number
}

export interface TrustScore {
  platform_id: string
  platform_name: string
  score: number
  trend: 'up' | 'down' | 'stable'
  sample_count: number
  last_calculated_at: string
  factors: TrustFactor[]
  recent_tos_changes?: {
    severity: 'major' | 'minor'
    summary: string
    detected_at?: string
  }[]
}

// ─── Zod schema (used for API validation) ────────────────────────────────────

export const TrustIndexScoreSchema = z.object({
  id: z.string().uuid(),
  platformId: z.string().uuid(),
  platformName: z.string().optional(),
  score: z.number().min(0).max(100), // Overall 0-100
  redemptionScore: z.number().min(0).max(100).nullable(),
  rejectionScore: z.number().min(0).max(100).nullable(),
  tosStabilityScore: z.number().min(0).max(100).nullable(),
  communityScore: z.number().min(0).max(100).nullable(),
  supportScore: z.number().min(0).max(100).nullable(),
  longevityScore: z.number().min(0).max(100).nullable(),
  bonusScore: z.number().min(0).max(100).nullable(),
  dataPoints: z.number().int().min(0),
  calculatedAt: z.string().datetime(),
  version: z.string(),
})

export type TrustIndexScore = z.infer<typeof TrustIndexScoreSchema>

/** Human-readable rating bands for the Trust Index */
export function getTrustRating(score: number): {
  label: string
  color: string
  description: string
} {
  if (score >= 80)
    return { label: 'Excellent', color: '#22c55e', description: 'Highly trustworthy platform' }
  if (score >= 65)
    return { label: 'Good', color: '#84cc16', description: 'Generally reliable platform' }
  if (score >= 50) return { label: 'Average', color: '#eab308', description: 'Mixed track record' }
  if (score >= 35)
    return { label: 'Below Average', color: '#f97316', description: 'Some concerns noted' }
  return { label: 'Poor', color: '#ef4444', description: 'Significant issues reported' }
}
