# SweepBot — Gap Analysis Report

**Generated:** March 2026
**Scope:** Full codebase audit — missing implementations, broken contracts, half-built features
**Method:** Cross-referencing all route files, API client (`api.ts`), DB schema (`comprehensive.ts`), and frontend pages

---

## Executive Summary

The codebase has a solid architectural spine but contains **6 critical blockers** that would cause immediate runtime crashes on production, **14 high-severity gaps** (silent failures, broken API contracts), and **12 medium/low issues** (placeholders, stubs, disabled features). None of these are logic errors in completed code — they are structural gaps between what the code _assumes exists_ and what is _actually defined_.

---

## 1. CRITICAL — Database Tables Referenced But Never Defined

These tables are actively queried or written to at runtime. Their absence means **the API will crash with a PostgreSQL "relation does not exist" error** on the first request that hits them.

---

### 1.1 `trust_index_scores` — Used everywhere in `trust.ts`

**Severity:** 🔴 CRITICAL
**Files:** `apps/api/src/routes/trust.ts` (20+ references), `apps/api/src/routes/platforms.ts`
**Schema file:** `apps/api/src/db/schema/comprehensive.ts` — **not defined anywhere**

Every endpoint in `trust.ts` reads from or writes to `trust_index_scores`. The entire Trust Index feature is dead on arrival. Required columns based on code usage:

```sql
CREATE TABLE trust_index_scores (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id                      UUID NOT NULL REFERENCES platforms(id),
  overall_score                    NUMERIC(5,2) NOT NULL,
  redemption_speed_score           NUMERIC(5,2) NOT NULL,
  redemption_rejection_rate_score  NUMERIC(5,2) NOT NULL,
  tos_stability_score              NUMERIC(5,2) NOT NULL,
  bonus_generosity_score           NUMERIC(5,2) NOT NULL,
  community_satisfaction_score     NUMERIC(5,2) NOT NULL,
  support_responsiveness_score     NUMERIC(5,2) NOT NULL,
  regulatory_standing_score        NUMERIC(5,2) NOT NULL,
  sample_size                      INTEGER DEFAULT 0,
  calculated_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX ON trust_index_scores (platform_id, calculated_at DESC);
```

---

### 1.2 `trust_index_alerts` — Used in new `trust.ts` alert endpoints

**Severity:** 🔴 CRITICAL
**Files:** `apps/api/src/routes/trust.ts` — GET/POST/DELETE `/trust-index/alerts`
**Schema file:** Not defined

The new alert subscription system (GET/POST/DELETE `/trust-index/alerts`) writes to `trust_index_alerts`. Required columns:

```sql
CREATE TABLE trust_index_alerts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id),
  platform_id          UUID NOT NULL REFERENCES platforms(id),
  threshold_direction  VARCHAR(10) NOT NULL DEFAULT 'any',
  threshold_score      NUMERIC(5,2),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  trigger_count        INTEGER NOT NULL DEFAULT 0,
  last_triggered_at    TIMESTAMP WITH TIME ZONE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, platform_id)
);
```

---

### 1.3 `tos_snapshots` — Referenced in `trust.ts` and `platforms.ts`

**Severity:** 🔴 CRITICAL
**Files:** `apps/api/src/routes/trust.ts`, `apps/api/src/routes/platforms.ts`
**Schema file:** Defined in `apps/api/src/db/schema/data-collection.ts` but **never exported from the schema index** and not re-exported via `comprehensive.ts`.

`trust.ts` queries `changes_detected`, `change_severity`, `change_summary`, `affected_sections`, `captured_at` from `tos_snapshots`. These columns need to be confirmed against `data-collection.ts` and the table must be exported.

**Fix:** Add to `apps/api/src/db/schema/comprehensive.ts` (or re-export from index):

```typescript
export { tosSnapshots } from './data-collection.js'
```

---

### 1.4 `redemptions` — Used in `trust.ts`, `user.ts`, `redemptions.ts`

**Severity:** 🔴 CRITICAL
**Files:** `apps/api/src/routes/trust.ts`, `apps/api/src/routes/user.ts`
**Schema file:** Not in `comprehensive.ts`. May be in another schema file but not confirmed as exported.

`trust.ts` queries `redemptions` for `submitted_at`, `completed_at`, `status`, `rejection_rate` to compute Trust Index scores. If this table doesn't exist or isn't accessible to the routes, scoring will fail silently (COALESCE to defaults) or crash.

---

### 1.5 `platform_ratings` — Referenced in `trust.ts` scoring engine

**Severity:** 🔴 CRITICAL
**Files:** `apps/api/src/routes/trust.ts` — `recalculatePlatformScore()`

`trust.ts` pulls `AVG(rating)` from `platform_ratings` for the community satisfaction score. Table is never defined. Required columns: `platform_id`, `user_id`, `rating` (1-5 numeric), `created_at`.

---

### 1.6 `platform_bonuses` — Referenced in `trust.ts` bonus generosity scoring

**Severity:** 🔴 CRITICAL
**Files:** `apps/api/src/routes/trust.ts` — `recalculatePlatformScore()`

`trust.ts` queries `AVG(wagering_requirement / bonus_amount)` from `platform_bonuses`. Table is never defined. Required columns: `platform_id`, `wagering_requirement`, `bonus_amount`, `created_at`.

---

## 2. CRITICAL — Double-Prefix Route Bug in `trust.ts`

**Severity:** 🔴 CRITICAL
**File:** `apps/api/src/routes/trust.ts`
**Registration:** `routes/index.ts` line 40: `await app.register(trustRoutes, { prefix: '/trust-index' })`

The routes **inside** `trust.ts` are declared as:

```typescript
app.get('/trust-index', ...)           // → resolves to GET /trust-index/trust-index ❌
app.get('/trust-index/leaderboard', ...)  // → resolves to GET /trust-index/trust-index/leaderboard ❌
app.get('/trust-index/:platformId', ...)  // → resolves to GET /trust-index/trust-index/:platformId ❌
```

The prefix is applied **on top of** the path declared inside the plugin. Correct paths should be `/`, `/leaderboard`, `/:platformId`, `/alerts`, etc. This affects every single Trust Index route.

Same bug exists in the original `jackpots.ts`: route declares `app.get('/jackpots', ...)` but is registered at prefix `/jackpots`, creating `GET /jackpots/jackpots`.

---

## 3. HIGH — `api.ts` Frontend Client Missing Methods

**Severity:** 🟠 HIGH
**File:** `apps/web/src/lib/api.ts`

The new `TrustIndexPage.tsx` calls multiple methods that do not exist in `api.ts`:

| Called in TrustIndexPage.tsx        | Exists in api.ts | Impact                                    |
| ----------------------------------- | ---------------- | ----------------------------------------- |
| `api.trust.detail(platformId)`      | ❌ Missing       | Detail panel throws TypeError immediately |
| `api.trust.leaderboard()`           | ❌ Missing       | Global stats panel is blank               |
| `api.trust.addAlert(data)`          | ❌ Missing       | Bell button throws on click               |
| `api.trust.removeAlert(platformId)` | ❌ Missing       | Bell button throws on click               |

`api.ts` only has:

```typescript
trust: {
  list: (params?) => ...,
  get: (platformId) => ...,   // named 'get', called as 'detail'
}
```

**Fix required in `api.ts`:**

```typescript
trust: {
  list:        (params?) => request(`/trust-index${toQS(params)}`),
  detail:      (platformId) => request(`/trust-index/${platformId}`),
  leaderboard: () => request('/trust-index/leaderboard'),
  percentile:  (platformId) => request(`/trust-index/${platformId}/percentile`),
  addAlert:    (data) => request('/trust-index/alerts', { method: 'POST', body: JSON.stringify(data) }),
  removeAlert: (platformId) => request(`/trust-index/alerts/${platformId}`, { method: 'DELETE' }),
  alerts:      () => request('/trust-index/alerts'),
}
```

---

## 4. HIGH — `@sweepbot/flows` Package Does Not Exist

**Severity:** 🟠 HIGH
**File:** `apps/api/src/routes/flows.ts` lines 8–9

```typescript
import {
  FlowInterpreter,
  FlowExecutor,
  ResponsiblePlayValidator,
  ConversationManager,
} from '@sweepbot/flows'
import type { ConversationState } from '@sweepbot/flows'
```

This package is referenced as a workspace dependency but **does not exist** anywhere in the monorepo. The entire Flows feature (`/flows/*` — 15+ endpoints covering flow CRUD, execution, conversations, marketplace) will fail to compile and crash on server startup.

**Options:**

1. Create the `@sweepbot/flows` package as a stub (stub classes with matching interfaces)
2. Inline the interpreter logic into `flows.ts`
3. Gate the `flows` routes behind a feature flag and skip registration until the package exists

---

## 5. HIGH — Jackpot Schema Field Name Mismatch

**Severity:** 🟠 HIGH
**Schema file:** `comprehensive.ts` lines 176–186
**Route file:** `apps/api/src/routes/jackpots.ts`

The `jackpotSnapshots` table in `comprehensive.ts` defines field `value` (Drizzle column name). But `jackpots.ts` queries fields named `amount`, `last_hit_at`, `last_hit_amount` that don't exist in the schema:

| Field queried in `jackpots.ts` | In `jackpotSnapshots` schema | Status                  |
| ------------------------------ | ---------------------------- | ----------------------- |
| `js.amount`                    | `value`                      | ❌ Wrong name           |
| `js.last_hit_at`               | Not defined                  | ❌ Missing column       |
| `js.last_hit_amount`           | Not defined                  | ❌ Missing column       |
| `js.jackpot_name`              | Not defined                  | ❌ Missing column       |
| `js.growth_rate_per_hour`      | Not defined                  | ❌ Computed, not stored |
| `js.captured_at`               | `capturedAt`                 | ✅ Exists               |

Either the schema needs new columns or the route needs to use the correct column names.

---

## 6. HIGH — `sessions` Table Missing New Fields

**Severity:** 🟠 HIGH
**Schema file:** `comprehensive.ts` lines 44–72
**Route file:** `apps/api/src/routes/sessions.ts` (newly rewritten)

The rewritten `sessions.ts` references fields that don't exist in the Drizzle schema:

| Field used in sessions.ts  | In sessions schema              | Impact                                            |
| -------------------------- | ------------------------------- | ------------------------------------------------- |
| `sessions.durationSeconds` | ❌ Missing                      | PATCH /end SET fails silently                     |
| `sessions.metadata`        | ❌ Missing                      | client_session_id idempotency query always misses |
| `sessions.scBalanceStart`  | ✅ Exists as `sc_balance_start` | OK                                                |

**Migrations needed:**

```sql
ALTER TABLE sessions ADD COLUMN duration_seconds INTEGER;
ALTER TABLE sessions ADD COLUMN metadata JSONB DEFAULT '{}';
```

Also in the Drizzle schema:

```typescript
durationSeconds: integer('duration_seconds'),
metadata: jsonb('metadata').default('{}'),
```

---

## 7. HIGH — `flow_conversations` Table Not Defined in Schema

**Severity:** 🟠 HIGH
**File:** `apps/api/src/routes/flows.ts`

`flows.ts` performs raw SQL against `flow_conversations` table (`SELECT * FROM flow_conversations WHERE id = ...`, `INSERT INTO flow_conversations ...`). This table is not defined in any schema file. Required columns based on usage: `id`, `user_id`, `flow_id`, `turns` (jsonb), `status`, `full_state` (jsonb), `created_at`, `updated_at`.

---

## 8. HIGH — `sessions.ts` Uses `db.execute()` for Dynamic SET Clauses

**Severity:** 🟠 HIGH
**File:** `apps/api/src/routes/sessions.ts`

The status transition endpoint and heartbeat endpoint do:

```typescript
await db.update(sessions).set(updatePayload as ...).where(...)
```

Where `updatePayload` is a `Record<string, unknown>` built dynamically. Drizzle ORM's `.set()` is typed strictly and does not accept a generic record — it requires the exact `sessions` table column shape. This will be a TypeScript error at compile time and may fail at runtime.

**Fix:** Use explicit typed objects or `db.execute(sql\`UPDATE...\`)` for conditional field updates.

---

## 9. HIGH — `games` Table Missing Fields Queried by `platforms.ts`

**Severity:** 🟠 HIGH
**Schema file:** `comprehensive.ts` lines 29–40
**Route file:** `apps/api/src/routes/platforms.ts`

| Field queried        | In `games` schema                   | Status                 |
| -------------------- | ----------------------------------- | ---------------------- |
| `g.thumbnail_url`    | ❌ Missing                          | NULL returned silently |
| `g.provider_id`      | ❌ Missing (has `provider` varchar) | JOIN fails             |
| `g.is_featured`      | ❌ Missing                          | NULL                   |
| `g.jackpot_eligible` | ❌ Missing                          | NULL                   |
| `g.release_date`     | ❌ Missing                          | NULL                   |

---

## 10. HIGH — `platforms` Table Missing `status` Column

**Severity:** 🟠 HIGH
**Schema file:** `comprehensive.ts` lines 17–27
**Route file:** `apps/api/src/routes/platforms.ts`, `trust.ts`

`trust.ts` queries `WHERE p.status = 'active'` and `platforms.ts` filters on `p.status`. But the `platforms` schema in `comprehensive.ts` defines `isActive: boolean('is_active')` — not a `status` varchar column. The raw SQL using `p.status` will always return empty results.

**Fix in trust.ts and platforms.ts:** Replace `WHERE p.status = 'active'` with `WHERE p.is_active = true`.

---

## 11. HIGH — `AnalyticsPage.tsx` Has Not Been Updated (Pending Task)

**Severity:** 🟠 HIGH
**File:** `apps/web/src/pages/AnalyticsPage.tsx`

The analytics backend (`analytics.ts`) was completely rebuilt in the previous session with 3 new endpoints:

- `GET /analytics/streaks` — win/loss streak data
- `GET /analytics/insights` — automated pattern detection + personal records
- `GET /analytics/export` — CSV download

These are wired in `api.ts` (`api.analytics.streaks`, `api.analytics.insights`, `api.analytics.export`) but `AnalyticsPage.tsx` **does not call any of them**. The page currently only renders the original 3 endpoints (rtp, temporal, bonus).

The planned UI additions (Streak Card, Insights Panel, Export button with date range picker) are completely absent.

---

## 12. MEDIUM — WebSocket Real-Time Jackpot Updates Disabled

**Severity:** 🟡 MEDIUM
**Files:** `apps/api/src/server.ts` line 14, `apps/api/src/routes/jackpots.ts` lines 9–10

```typescript
// import websocket from '@fastify/websocket' // TODO: re-enable when Fastify 5 compatible version is released
// await server.register(websocket)
```

The real-time jackpot push feature is fully scaffolded and commented out. The `jackpots.ts` route has the subscription schema and handler structure prepared. Blocked by `@fastify/websocket` Fastify 5 compatibility.

**When unblocked:** Install `@fastify/websocket@^8+`, uncomment registrations, and enable the `WSMessage` type import.

---

## 13. MEDIUM — `user.ts` Tax Summary Queries Non-Existent Field

**Severity:** 🟡 MEDIUM
**File:** `apps/api/src/routes/user.ts`

The `/user/tax-summary` endpoint queries `received_at` from the `redemptions` table. The `redemptions` table (wherever it's defined) uses `completed_at` as the completion timestamp. This causes the tax summary to return zero results for completed redemptions.

Note: `api.ts` has **two separate tax endpoints** — `api.user.taxSummary()` and `api.tax.summary()` — both mapping to different URL paths. It's unclear which is canonical; the `TaxCenterPage.tsx` needs to be checked for which it calls.

---

## 14. MEDIUM — `achievements` Routes Registered Under Two Conflicting Prefixes

**Severity:** 🟡 MEDIUM
**File:** `apps/api/src/routes/index.ts`

```typescript
await app.register(featuresRoutes, { prefix: '/features' }) // → /features/achievements/...
await app.register(achievementRoutes, { prefix: '/achievements' }) // → /achievements/...
```

`api.ts` calls **both**:

- `api.features.achievements()` → `GET /features/achievements`
- `api.achievements.streaks()` → `GET /achievements/streaks`

This is intentional duplication (Phase 2 vs Phase 1 endpoints), but `AchievementsPage.tsx` and other consumers need to consistently use one or the other. The `/features/achievements` and `/achievements` routes likely serve different data shapes — this should be consolidated or clearly documented.

---

## 15. MEDIUM — `gameIntelligenceRoutes` Registered Without a Prefix

**Severity:** 🟡 MEDIUM
**File:** `apps/api/src/routes/index.ts` line 44

```typescript
await app.register(gameIntelligenceRoutes) // No prefix
```

All other route modules get a `/noun` prefix. `gameIntelligenceRoutes` has no prefix, which means its routes are mounted at the root of `/api/v1`. Depending on what paths are declared inside `intelligence.ts`, this could cause accidental route collisions. Should likely be: `{ prefix: '/intelligence' }`.

---

## 16. MEDIUM — `platforms.ts` References `game_providers` Table (Undefined)

**Severity:** 🟡 MEDIUM
**File:** `apps/api/src/routes/platforms.ts`

Route queries `INNER JOIN game_providers gp ON gp.id = g.provider_id` — but:

1. `game_providers` table is not defined anywhere
2. `games.provider_id` column doesn't exist (schema has `games.provider` as varchar, not a FK)

The game listing endpoint will fail if this JOIN is not conditional or the table does not exist.

---

## 17. MEDIUM — `platform_community_signals` Table (Undefined)

**Severity:** 🟡 MEDIUM
**File:** `apps/api/src/routes/platforms.ts` — POST endpoint

A POST endpoint on `platforms.ts` inserts community signals into `platform_community_signals`. This table is not defined in any schema file.

---

## 18. MEDIUM — `flows.ts` Has Legacy State Migration Code in Production Path

**Severity:** 🟡 MEDIUM
**File:** `apps/api/src/routes/flows.ts` lines 35–52

The `onStateLoad` callback has a legacy fallback reconstruction for old `flow_conversations` rows that predate the `full_state` column. This migration shim is in the live code path and will run on every conversation load. It should be a one-time migration script, not permanent production code.

---

## 19. LOW — Redis Rate Limiter Not Connected

**Severity:** 🟢 LOW
**File:** `apps/api/src/server.ts`

```typescript
await server.register(rateLimit, {
  redis: undefined, // Will add Redis in Phase 2
```

Rate limiting works (in-memory) but resets on every server restart and is not shared across multiple API instances. Fine for single-instance, but will become a problem once horizontally scaled.

---

## 20. LOW — `user.ts` Self-Exclusion Feature Has No Time Enforcement

**Severity:** 🟢 LOW
**File:** `apps/api/src/routes/user.ts`

`POST /user/self-exclude` saves an exclusion record to the DB but the `requireAuth` middleware does not check for active self-exclusion before allowing subsequent requests. A self-excluded user can still access all endpoints. The self-exclusion check needs to be added to the auth middleware.

---

## 21. LOW — `payment-methods.ts` Contents Unknown

**Severity:** 🟢 LOW
**File:** `apps/api/src/routes/payment-methods.ts`

This route file is registered (`{ prefix: '/payment-methods' }`) but was not audited. Given that payment method storage involves Stripe payment method IDs (not raw card data), its correctness should be verified — particularly that it never stores raw card numbers and only stores Stripe's opaque payment method IDs.

---

## 22. LOW — Swagger Tags Don't Match Route Prefixes

**Severity:** 🟢 LOW
**Files:** Various route files

`trust.ts` uses `tags: ['Trust Index']` but the server Swagger config groups by prefix. Tag names with spaces may render oddly in the API docs UI. Minor cosmetic issue.

---

## Summary Table

| #   | Issue                                                           | File(s)                | Severity    | Fix Effort          |
| --- | --------------------------------------------------------------- | ---------------------- | ----------- | ------------------- |
| 1   | `trust_index_scores` table missing                              | trust.ts, platforms.ts | 🔴 CRITICAL | Migration + schema  |
| 2   | `trust_index_alerts` table missing                              | trust.ts               | 🔴 CRITICAL | Migration + schema  |
| 3   | `tos_snapshots` not exported from schema                        | data-collection.ts     | 🔴 CRITICAL | Export + re-test    |
| 4   | `redemptions` table not confirmed in schema                     | trust.ts, user.ts      | 🔴 CRITICAL | Confirm + export    |
| 5   | `platform_ratings` table missing                                | trust.ts               | 🔴 CRITICAL | Migration + schema  |
| 6   | `platform_bonuses` table missing                                | trust.ts               | 🔴 CRITICAL | Migration + schema  |
| 7   | Double-prefix bug in trust.ts routes                            | trust.ts               | 🔴 CRITICAL | Path fix            |
| 8   | `@sweepbot/flows` package doesn't exist                         | flows.ts               | 🟠 HIGH     | Create stub package |
| 9   | Jackpot schema field mismatch (`value` vs `amount`)             | jackpots.ts + schema   | 🟠 HIGH     | Schema migration    |
| 10  | `sessions` table missing `durationSeconds`, `metadata`          | sessions.ts + schema   | 🟠 HIGH     | Migration + schema  |
| 11  | `flow_conversations` table not defined                          | flows.ts               | 🟠 HIGH     | Migration + schema  |
| 12  | `api.ts` missing trust.detail/leaderboard/addAlert/removeAlert  | api.ts                 | 🟠 HIGH     | 8 lines of code     |
| 13  | Dynamic `.set()` type error in sessions.ts                      | sessions.ts            | 🟠 HIGH     | Use typed objects   |
| 14  | `games` table missing thumbnail/featured/jackpot fields         | platforms.ts + schema  | 🟠 HIGH     | Migration           |
| 15  | `platforms` table uses `isActive` but routes filter on `status` | trust.ts, platforms.ts | 🟠 HIGH     | SQL fix             |
| 16  | `AnalyticsPage.tsx` not updated with 3 new endpoints            | AnalyticsPage.tsx      | 🟠 HIGH     | Frontend work       |
| 17  | WebSocket jackpots disabled                                     | server.ts, jackpots.ts | 🟡 MEDIUM   | Awaiting library    |
| 18  | Tax summary queries `received_at` (should be `completed_at`)    | user.ts                | 🟡 MEDIUM   | 1-line SQL fix      |
| 19  | Duplicate achievements routes (/features vs /achievements)      | index.ts, api.ts       | 🟡 MEDIUM   | Consolidate         |
| 20  | `gameIntelligenceRoutes` has no prefix                          | index.ts               | 🟡 MEDIUM   | Add prefix          |
| 21  | `game_providers` table missing, `provider_id` FK missing        | platforms.ts + schema  | 🟡 MEDIUM   | Migration           |
| 22  | `platform_community_signals` table missing                      | platforms.ts           | 🟡 MEDIUM   | Migration           |
| 23  | Legacy state migration shim in flows production path            | flows.ts               | 🟡 MEDIUM   | Extract to script   |
| 24  | Redis rate limiter not connected                                | server.ts              | 🟢 LOW      | Phase 2 task        |
| 25  | Self-exclusion not enforced in auth middleware                  | user.ts, middleware    | 🟢 LOW      | Middleware hook     |
| 26  | `payment-methods.ts` not audited                                | payment-methods.ts     | 🟢 LOW      | Review              |

---

## Recommended Fix Order

**Day 1 — Unblock the server:**

1. Fix double-prefix bug in `trust.ts` (all routes → `/`, `/:platformId`, etc.)
2. Fix `gameIntelligenceRoutes` prefix
3. Create stub `@sweepbot/flows` package so server starts without crashing
4. Fix `platforms` schema: replace `p.status` with `p.is_active` in raw SQL throughout

**Day 2 — Write missing migrations:** 5. `trust_index_scores` table + Drizzle schema export 6. `trust_index_alerts` table + Drizzle schema export 7. Confirm `redemptions` table schema and export it 8. `platform_ratings` table 9. `platform_bonuses` table 10. `sessions.duration_seconds`, `sessions.metadata` columns 11. `flow_conversations` table 12. `jackpot_snapshots` add `jackpot_name`, `last_hit_at`, `last_hit_amount` columns (or rename `value` → `amount`)

**Day 3 — API contracts:** 13. Add missing methods to `api.ts` (trust.detail, trust.leaderboard, trust.addAlert, trust.removeAlert) 14. Fix sessions.ts dynamic `.set()` calls with typed payloads 15. Fix `user.ts` tax summary `received_at` → `completed_at` 16. Add `games` missing columns (thumbnail_url, is_featured, jackpot_eligible)

**Day 4 — Finish pending features:** 17. Update `AnalyticsPage.tsx` with Streak Card, Insights Panel, Export button 18. Consolidate duplicate achievements routes 19. Add self-exclusion check to auth middleware
