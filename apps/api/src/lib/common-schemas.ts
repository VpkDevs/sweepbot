/**
 * Common Zod schemas shared across API route files.
 * Import from here instead of repeating these definitions.
 */

import { z } from 'zod'

/** Standard page / page-size pagination query params. */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** UUID path parameter (`:id`). */
export const UuidParamsSchema = z.object({
  id: z.string().uuid(),
})
