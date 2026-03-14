# PR #9 Implementation Guide: Audit Logging & Security Fixes

This guide provides step-by-step instructions for implementing the 9 critical issues flagged in PR #9.

---

## Issue #1: Non-Idempotent Batch Transactions

**File**: `apps/api/src/routes/sessions.ts`  
**Lines**: 370-446  
**Severity**: 🔴 CRITICAL

### The Problem
The batch transaction endpoint deduplicates incoming transactions but always increments session totals from the request body, not from actual inserted rows. On retry with conflicts, this double-counts totals.

### Implementation
Modify the `POST /transactions/batch` endpoint to track inserted rows:

```typescript
// In the batch transaction handler after INSERT
const insertResult = await db.insert(transactions).values(
  newTxs.map((tx) => ({
    // ... fields
  }))
)
// insertResult should give us the count of actually inserted rows

// Then use that count, not the input array length, for aggregation
const actuallyInserted = newTxs.length  // This is correct now
// But for safety, verify against database:
const insertedCount = await db.execute(
  sql`SELECT COUNT(*) FROM transactions WHERE session_id = ${session_id} AND timestamp >= ${minTimestamp}`
)
```

### Testing
```bash
# Test idempotency with retries
curl -X POST /sessions/{id}/transactions/batch \
  -d @payload.json
curl -X POST /sessions/{id}/transactions/batch \
  -d @payload.json  # Retry - should skip duplicates, not double-count

# Verify session totals didn't increase on retry
curl -X GET /sessions/{id}
```

---

## Issue #2: Floating-Point Rounding in Monetary Calculations

**File**: `apps/api/src/routes/sessions.ts`  
**Lines**: 372-379  
**Severity**: 🔴 CRITICAL

### The Problem
JavaScript summing with IEEE-754 floating-point causes cumulative rounding drift when applied to fixed-scale NUMERIC columns.

### Implementation Option A: Integer Cents (Recommended)
Store amounts as integer cents, not floats:

```typescript
// BEFORE
bet_amount: z.number().positive().max(999_999)

// AFTER  
bet_amount: z.number().positive().max(99999900)  // In cents, so max $999,999.00

// In database operations
const betCents = Math.round(tx.bet_amount * 100)  // Convert to cents once
const betAmount = (betCents / 100).toFixed(2)  // Display as dollars
```

### Implementation Option B: SQL-Side Aggregation (If Keeping Floats)
```typescript
// Instead of summing in JavaScript:
const deltas = {
  totalWagered: txs.reduce((sum, tx) => sum + tx.bet_amount, 0),
  totalWon: txs.reduce((sum, tx) => sum + tx.win_amount, 0),
}

// Do this in SQL with proper NUMERIC type:
const stats = await db.execute(sql`
  SELECT
    COALESCE(SUM(bet_amount), 0)::numeric(18,2) AS total_wagered,
    COALESCE(SUM(win_amount), 0)::numeric(18,2) AS total_won
  FROM transactions
  WHERE session_id = ${sessionId}
    AND timestamp >= ${cutoffTime}
`)
```

### Testing
```bash
# Test with fractional amounts that cause rounding errors
# e.g., $0.01 * 11 should equal $0.11, not $0.109999...
POST /sessions/{id}/transactions/batch
{
  "transactions": [
    { "bet_amount": 0.01, ... },
    { "bet_amount": 0.01, ... },
    // ... 11 total
  ]
}

# Verify: session.total_wagered should be exactly 0.11
```

---

## Issue #3: Spoofable Audit IP

**File**: `apps/api/src/middleware/audit.ts` (NEW FILE)  
**Severity**: 🔴 CRITICAL

### The Problem
Audit log extracts client IP from raw `x-forwarded-for` header without validating proxy trust, allowing IP spoofing.

### Implementation
Create `apps/api/src/middleware/audit.ts`:

```typescript
import type { FastifyPlugin } from 'fastify'
import { db } from '../db/client.js'
import { audit_logs } from '../db/schema/audit.js'

/**
 * Extracts client IP address safely.
 * Prefers request.ip (Fastify's parsed value),
 * only trusts x-forwarded-for if behind configured trusted proxy.
 */
function getClientIp(request: FastifyRequest): string {
  // Fastify automatically parses and validates based on trustProxy setting
  return request.ip ?? 'unknown'
  
  // If you need x-forwarded-for override:
  // if (process.env.TRUST_PROXY === 'true') {
  //   const forwarded = request.headers['x-forwarded-for']
  //   if (typeof forwarded === 'string') {
  //     return forwarded.split(',')[0]?.trim() ?? request.ip ?? 'unknown'
  //   }
  // }
}

const auditPlugin: FastifyPlugin = async (app) => {
  app.addHook('onResponse', async (request, reply) => {
    try {
      const clientIp = getClientIp(request)
      const userId = request.user?.id ?? null
      
      await db.insert(audit_logs).values({
        userId,
        action: `${request.method} ${request.url}`,
        clientIp,
        userAgent: request.headers['user-agent'] ?? null,
        statusCode: reply.statusCode,
        timestamp: new Date(),
      })
    } catch (err) {
      // Don't fail request if audit logging fails
      console.error('Audit logging error:', err)
    }
  })
}

export default auditPlugin
```

### Configuration
In `apps/api/src/main.ts`, set trustProxy:

```typescript
const app = await build({
  // ... other options
  trustProxy: true,  // Behind reverse proxy (Vercel, load balancer)
  // OR specify specific IPs:
  // trustProxy: ['10.0.0.1', '10.0.0.2']
})
```

### Testing
```bash
# Test without spoofing (direct connection)
curl http://localhost:3000/api/v1/sessions
# Should log your real IP

# Test x-forwarded-for (if behind proxy)
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/api/v1/sessions
# Should log 1.2.3.4 (when trustProxy=true)
```

---

## Issue #4: Non-Standard Error Response Shape

**File**: `apps/api/src/routes/user.ts`  
**Lines**: 133-138  
**Severity**: 🟡 MEDIUM

### The Problem
Some error responses use `{ success: false, error: { code, message } }` instead of standard shape.

### Implementation
Ensure all error responses match:

```typescript
// STANDARD SHAPE (use this everywhere)
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Email must be valid',
    status: 400
  }
}

// Create helper function:
export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string
) {
  return reply.code(status).send({
    success: false,
    error: {
      code,
      message,
      status,
    }
  })
}

// Use in all route error paths:
if (!body.email) {
  return sendError(reply, 400, 'MISSING_EMAIL', 'Email is required')
}
```

---

## Issue #5: Duplicate Function Definition (Test)

**File**: `apps/api/src/__tests__/middleware/audit.test.ts`  
**Severity**: 🟡 MEDIUM

### Implementation
```typescript
// BEFORE
import { registerRequestTimingHook } from '../middleware/timing.js'
function registerRequestTimingHook() {
  // Duplicate!
}

// AFTER - Remove the duplicate definition, keep only the import
import { registerRequestTimingHook } from '../middleware/timing.js'

describe('Audit Middleware', () => {
  // Use the imported function
})
```

---

## Issue #6: Logger Mock Path Mismatch

**File**: `apps/api/src/__tests__/middleware/audit.test.ts`  
**Severity**: 🟡 MEDIUM

### Implementation
```typescript
// BEFORE
// Test: vi.mock('../../utils/logger')
// Production: import { logger } from '../utils/logger.js'

// AFTER - Match paths exactly
// Production uses: ../utils/logger.js (relative from middleware/)
// Test should mock: ../utils/logger (same relative path from test file)
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}))

// Then use it
import { logger } from '../utils/logger.js'
```

---

## Issue #7: Performance Inefficiency (Hot Path)

**File**: `apps/api/src/routes/sessions.ts`  
**Lines**: 372-378  
**Severity**: 🟡 MEDIUM

### The Problem
Multiple `.filter()` calls on hot path with up to 500 transactions wastes CPU.

### Implementation
```typescript
// BEFORE
const wins = txs.filter(tx => tx.result === 'win')
const losses = txs.filter(tx => tx.result === 'loss')
const bonuses = txs.filter(tx => tx.bonus_triggered)

const totalWagered = txs.reduce((sum, tx) => sum + tx.bet_amount, 0)
const totalWon = txs.reduce((sum, tx) => sum + tx.win_amount, 0)

// AFTER - Single pass
const stats = {
  totalWagered: 0,
  totalWon: 0,
  winCount: 0,
  lossCount: 0,
  bonusCount: 0,
}

for (const tx of txs) {
  stats.totalWagered += tx.bet_amount
  stats.totalWon += tx.win_amount
  if (tx.result === 'win') stats.winCount++
  if (tx.result === 'loss') stats.lossCount++
  if (tx.bonus_triggered) stats.bonusCount++
}
```

---

## Issue #8: Post-Sanitization Validation Gap

**File**: `apps/api/src/routes/flows.ts`  
**Lines**: 262-263  
**Severity**: 🟡 MEDIUM

### The Problem
Input passes validation but becomes empty after sanitization (e.g., `<b></b>` is valid before, empty after).

### Implementation
```typescript
import DOMPurify from 'isomorphic-dompurify'

// BEFORE
const validated = schema.parse(req.body)  // Might be "<b></b>"
const sanitized = DOMPurify.sanitize(validated.description)  // Becomes ""

// AFTER - Validate after sanitization too
const validated = schema.parse(req.body)
const sanitized = DOMPurify.sanitize(validated.description)

// Re-validate sanitized output
if (schema.parse({ ...validated, description: sanitized }).description === '') {
  return sendError(reply, 400, 'EMPTY_CONTENT', 'Content cannot be empty after sanitization')
}
```

---

## Issue #9: x-forwarded-for Type Handling

**File**: `apps/api/src/middleware/audit.ts`  
**Severity**: 🟡 MEDIUM

### The Problem
`x-forwarded-for` can be an array, but code casts to string and calls `.split()`, risking runtime error.

### Implementation
```typescript
// BEFORE
const clientIp = (request.headers['x-forwarded-for'] as string).split(',')[0]
// Risk: If header is array, this throws

// AFTER - Type-safe handling
function getClientIpFromHeader(header: string | string[] | undefined): string | null {
  if (!header) return null
  
  const value = typeof header === 'string' ? header : header[0]
  if (!value) return null
  
  // x-forwarded-for is comma-separated list of IPs
  return value.split(',')[0]?.trim() ?? null
}

const clientIp = getClientIpFromHeader(request.headers['x-forwarded-for']) ?? 'unknown'
```

---

## Integration Checklist

- [ ] Issue #1: Implement batch transaction tracking
- [ ] Issue #2: Switch to integer cents OR SQL aggregation
- [ ] Issue #3: Create audit.ts middleware with trustProxy
- [ ] Issue #4: Standardize error responses
- [ ] Issue #5: Remove duplicate function definition
- [ ] Issue #6: Fix mock paths to match production
- [ ] Issue #7: Optimize hot path to single-pass loop
- [ ] Issue #8: Add post-sanitization validation
- [ ] Issue #9: Fix x-forwarded-for type handling
- [ ] Run `pnpm test` - all tests pass
- [ ] Run `pnpm lint` - all linting passes
- [ ] Run `pnpm typecheck` - no TypeScript errors

---

## Testing Strategy

### Unit Tests
```bash
pnpm test -- audit.test.ts
pnpm test -- transactions.test.ts
pnpm test -- flows.test.ts
```

### Integration Tests
```bash
# Test batch transaction idempotency
pnpm test:e2e -- batch-transactions.spec.ts

# Test error response consistency
pnpm test:e2e -- error-handling.spec.ts

# Test audit logging
pnpm test:e2e -- audit-logging.spec.ts
```

### Manual Testing
```bash
# Start dev server
pnpm dev

# Test batch transactions with retries
curl -X POST http://localhost:3000/api/v1/sessions/{id}/transactions/batch \
  -H "Content-Type: application/json" \
  -d @test-payload.json

# Test error responses
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Should return consistent error shape:
# { "success": false, "error": { "code": "...", "message": "...", "status": 400 } }
```

---

## Timeline Estimate

- **Issues 1-2**: 2-3 hours (database logic changes)
- **Issues 3, 5-6, 9**: 1-2 hours (middleware, tests, type safety)
- **Issues 4, 7-8**: 1 hour (consistency, optimization)
- **Testing**: 1-2 hours
- **Total**: 5-8 hours of development + testing

---

## Questions or Need Help?

Refer to:
- Fastify docs: https://www.fastify.io/docs/latest/
- Drizzle ORM: https://orm.drizzle.team/
- DOMPurify: https://github.com/cure53/DOMPurify
