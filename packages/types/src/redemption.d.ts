import { z } from 'zod';
export declare const RedemptionStatus: z.ZodEnum<["pending", "processing", "approved", "rejected", "received", "cancelled"]>;
export type RedemptionStatus = z.infer<typeof RedemptionStatus>;
export declare const PaymentMethod: z.ZodEnum<["paypal", "check", "ach", "venmo", "cashapp", "giftcard", "crypto", "other"]>;
export type PaymentMethod = z.infer<typeof PaymentMethod>;
export declare const RedemptionSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    platformId: z.ZodString;
    platformName: z.ZodOptional<z.ZodString>;
    requestedAt: z.ZodString;
    submittedAt: z.ZodNullable<z.ZodString>;
    approvedAt: z.ZodNullable<z.ZodString>;
    receivedAt: z.ZodNullable<z.ZodString>;
    amountSc: z.ZodNullable<z.ZodNumber>;
    amountUsd: z.ZodNullable<z.ZodNumber>;
    paymentMethod: z.ZodNullable<z.ZodEnum<["paypal", "check", "ach", "venmo", "cashapp", "giftcard", "crypto", "other"]>>;
    status: z.ZodEnum<["pending", "processing", "approved", "rejected", "received", "cancelled"]>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    processingDays: z.ZodNullable<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "received" | "cancelled" | "pending" | "processing" | "approved" | "rejected";
    id: string;
    platformId: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    requestedAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    receivedAt: string | null;
    amountSc: number | null;
    amountUsd: number | null;
    paymentMethod: "paypal" | "check" | "ach" | "venmo" | "cashapp" | "giftcard" | "crypto" | "other" | null;
    rejectionReason: string | null;
    processingDays: number | null;
    notes: string | null;
    platformName?: string | undefined;
}, {
    status: "received" | "cancelled" | "pending" | "processing" | "approved" | "rejected";
    id: string;
    platformId: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    requestedAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    receivedAt: string | null;
    amountSc: number | null;
    amountUsd: number | null;
    paymentMethod: "paypal" | "check" | "ach" | "venmo" | "cashapp" | "giftcard" | "crypto" | "other" | null;
    rejectionReason: string | null;
    processingDays: number | null;
    notes: string | null;
    platformName?: string | undefined;
}>;
export type Redemption = z.infer<typeof RedemptionSchema>;
export declare const CreateRedemptionSchema: z.ZodObject<{
    platformId: z.ZodString;
    requestedAt: z.ZodString;
    amountSc: z.ZodOptional<z.ZodNumber>;
    amountUsd: z.ZodOptional<z.ZodNumber>;
    paymentMethod: z.ZodOptional<z.ZodEnum<["paypal", "check", "ach", "venmo", "cashapp", "giftcard", "crypto", "other"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    platformId: string;
    requestedAt: string;
    amountSc?: number | undefined;
    amountUsd?: number | undefined;
    paymentMethod?: "paypal" | "check" | "ach" | "venmo" | "cashapp" | "giftcard" | "crypto" | "other" | undefined;
    notes?: string | undefined;
}, {
    platformId: string;
    requestedAt: string;
    amountSc?: number | undefined;
    amountUsd?: number | undefined;
    paymentMethod?: "paypal" | "check" | "ach" | "venmo" | "cashapp" | "giftcard" | "crypto" | "other" | undefined;
    notes?: string | undefined;
}>;
export type CreateRedemptionInput = z.infer<typeof CreateRedemptionSchema>;
export declare const UpdateRedemptionSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "processing", "approved", "rejected", "received", "cancelled"]>>;
    approvedAt: z.ZodOptional<z.ZodString>;
    receivedAt: z.ZodOptional<z.ZodString>;
    amountUsd: z.ZodOptional<z.ZodNumber>;
    rejectionReason: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "received" | "cancelled" | "pending" | "processing" | "approved" | "rejected" | undefined;
    approvedAt?: string | undefined;
    receivedAt?: string | undefined;
    amountUsd?: number | undefined;
    rejectionReason?: string | undefined;
    notes?: string | undefined;
}, {
    status?: "received" | "cancelled" | "pending" | "processing" | "approved" | "rejected" | undefined;
    approvedAt?: string | undefined;
    receivedAt?: string | undefined;
    amountUsd?: number | undefined;
    rejectionReason?: string | undefined;
    notes?: string | undefined;
}>;
export type UpdateRedemptionInput = z.infer<typeof UpdateRedemptionSchema>;
//# sourceMappingURL=redemption.d.ts.map