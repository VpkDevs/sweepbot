import { z } from 'zod'
export declare const TrustIndexScoreSchema: z.ZodObject<
  {
    id: z.ZodString
    platformId: z.ZodString
    platformName: z.ZodOptional<z.ZodString>
    score: z.ZodNumber
    redemptionScore: z.ZodNullable<z.ZodNumber>
    rejectionScore: z.ZodNullable<z.ZodNumber>
    tosStabilityScore: z.ZodNullable<z.ZodNumber>
    communityScore: z.ZodNullable<z.ZodNumber>
    supportScore: z.ZodNullable<z.ZodNumber>
    longevityScore: z.ZodNullable<z.ZodNumber>
    bonusScore: z.ZodNullable<z.ZodNumber>
    dataPoints: z.ZodNumber
    calculatedAt: z.ZodString
    version: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    version: string
    id: string
    platformId: string
    score: number
    redemptionScore: number | null
    rejectionScore: number | null
    tosStabilityScore: number | null
    communityScore: number | null
    supportScore: number | null
    longevityScore: number | null
    bonusScore: number | null
    dataPoints: number
    calculatedAt: string
    platformName?: string | undefined
  },
  {
    version: string
    id: string
    platformId: string
    score: number
    redemptionScore: number | null
    rejectionScore: number | null
    tosStabilityScore: number | null
    communityScore: number | null
    supportScore: number | null
    longevityScore: number | null
    bonusScore: number | null
    dataPoints: number
    calculatedAt: string
    platformName?: string | undefined
  }
>
export type TrustIndexScore = z.infer<typeof TrustIndexScoreSchema>
/** Human-readable rating bands for the Trust Index */
export declare function getTrustRating(score: number): {
  label: string
  color: string
  description: string
}
//# sourceMappingURL=trust.d.ts.map
