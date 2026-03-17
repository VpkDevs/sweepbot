import { z } from 'zod'

export const RedemptionStatus = z.enum([
  'pending',
  'processing',
  'approved',
  'rejected',
  'received',
  'cancelled',
])
export type RedemptionStatus = z.infer<typeof RedemptionStatus>

export const PaymentMethod = z.enum([
  'paypal',
  'check',
  'ach',
  'venmo',
  'cashapp',
  'giftcard',
  'crypto',
  'other',
])
export type PaymentMethod = z.infer<typeof PaymentMethod>

export const RedemptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platformId: z.string().uuid(),
  platformName: z.string().optional(),
  requestedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  approvedAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
  amountSc: z.number().min(0).nullable(),
  amountUsd: z.number().min(0).nullable(),
  paymentMethod: PaymentMethod.nullable(),
  status: RedemptionStatus,
  rejectionReason: z.string().nullable(),
  processingDays: z.number().int().nullable(),
  notes: z.string().max(1000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Redemption = z.infer<typeof RedemptionSchema>

export const CreateRedemptionSchema = z.object({
  platformId: z.string().uuid(),
  requestedAt: z.string().datetime(),
  amountSc: z.number().min(0).optional(),
  amountUsd: z.number().min(0).optional(),
  paymentMethod: PaymentMethod.optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateRedemptionInput = z.infer<typeof CreateRedemptionSchema>

export const UpdateRedemptionSchema = z.object({
  status: RedemptionStatus.optional(),
  approvedAt: z.string().datetime().optional(),
  receivedAt: z.string().datetime().optional(),
  amountUsd: z.number().min(0).optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export type UpdateRedemptionInput = z.infer<typeof UpdateRedemptionSchema>
