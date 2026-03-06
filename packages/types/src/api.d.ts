import { z } from 'zod';
export interface ApiSuccess<T> {
    success: true;
    data: T;
    meta?: {
        page?: number;
        pageSize?: number;
        total?: number;
        hasMore?: boolean;
    };
}
export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export declare const PaginationParamsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type WSMessageType = 'session:start' | 'session:update' | 'session:end' | 'jackpot:subscribe' | 'jackpot:unsubscribe' | 'jackpot:update' | 'session:ack' | 'trust:update' | 'notification' | 'error' | 'ping' | 'pong';
export interface WSMessage<T = unknown> {
    type: WSMessageType;
    payload: T;
    timestamp: string;
}
export declare const API_ERROR_CODES: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly FEATURE_GATED: "FEATURE_GATED";
    readonly SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
//# sourceMappingURL=api.d.ts.map