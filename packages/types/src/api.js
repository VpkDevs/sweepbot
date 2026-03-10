import { z } from 'zod';
// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
export const PaginationParamsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
// ─────────────────────────────────────────────────────────────────────────────
// FEATURE GATE ERRORS
// ─────────────────────────────────────────────────────────────────────────────
export const API_ERROR_CODES = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    FEATURE_GATED: 'FEATURE_GATED',
    SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};
//# sourceMappingURL=api.js.map