import { z } from 'zod';
export const VolatilityClass = z.enum(['low', 'medium', 'high', 'very_high']);
export const GameSchema = z.object({
    id: z.string().uuid(),
    providerId: z.string().uuid().nullable(),
    providerName: z.string().nullable(),
    platformId: z.string().uuid().nullable(),
    externalGameId: z.string().nullable(),
    slug: z.string(),
    name: z.string(),
    thumbnailUrl: z.string().url().nullable(),
    theoreticalRtp: z.number().min(0).max(100).nullable(),
    volatilityClass: VolatilityClass.nullable(),
    minBet: z.number().min(0).nullable(),
    maxBet: z.number().min(0).nullable(),
    maxWinMultiplier: z.number().int().nullable(),
    hasBonusRound: z.boolean(),
    hasFreeSpins: z.boolean(),
    hasJackpot: z.boolean(),
    isActive: z.boolean(),
    // Community data (aggregate)
    communityRtpPct: z.number().nullable(),
    communitySessionCount: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
//# sourceMappingURL=game.js.map