import { z } from 'zod'
export declare const PlatformStatus: z.ZodEnum<['active', 'inactive', 'suspended', 'closed']>
export type PlatformStatus = z.infer<typeof PlatformStatus>
export declare const PlatformSchema: z.ZodObject<
  {
    id: z.ZodString
    slug: z.ZodString
    name: z.ZodString
    displayName: z.ZodString
    url: z.ZodString
    affiliateUrl: z.ZodNullable<z.ZodString>
    logoUrl: z.ZodNullable<z.ZodString>
    description: z.ZodNullable<z.ZodString>
    foundedYear: z.ZodNullable<z.ZodNumber>
    status: z.ZodEnum<['active', 'inactive', 'suspended', 'closed']>
    countryCodes: z.ZodArray<z.ZodString, 'many'>
    isFeatured: z.ZodBoolean
    trustScore: z.ZodNullable<z.ZodNumber>
    createdAt: z.ZodString
    updatedAt: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    status: 'active' | 'inactive' | 'suspended' | 'closed'
    url: string
    description: string | null
    id: string
    name: string
    displayName: string
    slug: string
    affiliateUrl: string | null
    logoUrl: string | null
    foundedYear: number | null
    countryCodes: string[]
    isFeatured: boolean
    trustScore: number | null
    createdAt: string
    updatedAt: string
  },
  {
    status: 'active' | 'inactive' | 'suspended' | 'closed'
    url: string
    description: string | null
    id: string
    name: string
    displayName: string
    slug: string
    affiliateUrl: string | null
    logoUrl: string | null
    foundedYear: number | null
    countryCodes: string[]
    isFeatured: boolean
    trustScore: number | null
    createdAt: string
    updatedAt: string
  }
>
export type Platform = z.infer<typeof PlatformSchema>
export declare const UserPlatformSchema: z.ZodObject<
  {
    id: z.ZodString
    userId: z.ZodString
    platformId: z.ZodString
    isActive: z.ZodBoolean
    nickname: z.ZodNullable<z.ZodString>
    addedAt: z.ZodString
    lastSyncedAt: z.ZodNullable<z.ZodString>
    platform: z.ZodOptional<
      z.ZodObject<
        {
          id: z.ZodString
          slug: z.ZodString
          name: z.ZodString
          displayName: z.ZodString
          url: z.ZodString
          affiliateUrl: z.ZodNullable<z.ZodString>
          logoUrl: z.ZodNullable<z.ZodString>
          description: z.ZodNullable<z.ZodString>
          foundedYear: z.ZodNullable<z.ZodNumber>
          status: z.ZodEnum<['active', 'inactive', 'suspended', 'closed']>
          countryCodes: z.ZodArray<z.ZodString, 'many'>
          isFeatured: z.ZodBoolean
          trustScore: z.ZodNullable<z.ZodNumber>
          createdAt: z.ZodString
          updatedAt: z.ZodString
        },
        'strip',
        z.ZodTypeAny,
        {
          status: 'active' | 'inactive' | 'suspended' | 'closed'
          url: string
          description: string | null
          id: string
          name: string
          displayName: string
          slug: string
          affiliateUrl: string | null
          logoUrl: string | null
          foundedYear: number | null
          countryCodes: string[]
          isFeatured: boolean
          trustScore: number | null
          createdAt: string
          updatedAt: string
        },
        {
          status: 'active' | 'inactive' | 'suspended' | 'closed'
          url: string
          description: string | null
          id: string
          name: string
          displayName: string
          slug: string
          affiliateUrl: string | null
          logoUrl: string | null
          foundedYear: number | null
          countryCodes: string[]
          isFeatured: boolean
          trustScore: number | null
          createdAt: string
          updatedAt: string
        }
      >
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string
    platformId: string
    userId: string
    isActive: boolean
    nickname: string | null
    addedAt: string
    lastSyncedAt: string | null
    platform?:
      | {
          status: 'active' | 'inactive' | 'suspended' | 'closed'
          url: string
          description: string | null
          id: string
          name: string
          displayName: string
          slug: string
          affiliateUrl: string | null
          logoUrl: string | null
          foundedYear: number | null
          countryCodes: string[]
          isFeatured: boolean
          trustScore: number | null
          createdAt: string
          updatedAt: string
        }
      | undefined
  },
  {
    id: string
    platformId: string
    userId: string
    isActive: boolean
    nickname: string | null
    addedAt: string
    lastSyncedAt: string | null
    platform?:
      | {
          status: 'active' | 'inactive' | 'suspended' | 'closed'
          url: string
          description: string | null
          id: string
          name: string
          displayName: string
          slug: string
          affiliateUrl: string | null
          logoUrl: string | null
          foundedYear: number | null
          countryCodes: string[]
          isFeatured: boolean
          trustScore: number | null
          createdAt: string
          updatedAt: string
        }
      | undefined
  }
>
export type UserPlatform = z.infer<typeof UserPlatformSchema>
export declare const AddUserPlatformSchema: z.ZodObject<
  {
    platformId: z.ZodString
    nickname: z.ZodOptional<z.ZodString>
  },
  'strip',
  z.ZodTypeAny,
  {
    platformId: string
    nickname?: string | undefined
  },
  {
    platformId: string
    nickname?: string | undefined
  }
>
export type AddUserPlatformInput = z.infer<typeof AddUserPlatformSchema>
export declare const KNOWN_PLATFORM_SLUGS: readonly [
  'chumba-casino',
  'luckylandslots',
  'stake-us',
  'pulsz',
  'wow-vegas',
  'fortune-coins',
  'funrize',
  'zula-casino',
  'crown-coins-casino',
  'mcluck',
  'nolimitcoins',
  'modo-casino',
  'sweeptastic',
  'global-poker',
  'betrivers-net',
  'high5casino',
  'jackpota',
  'spree-casino',
  'sportzino',
]
export type PlatformSlug = (typeof KNOWN_PLATFORM_SLUGS)[number]
export declare const PLATFORM_URL_PATTERNS: Record<string, PlatformSlug>
//# sourceMappingURL=platform.d.ts.map
