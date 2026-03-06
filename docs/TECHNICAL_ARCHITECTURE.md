# SweepBot — Technical Architecture Document

**Version:** 1.0.0
**Date:** 2026-02-26
**Status:** Approved for Development

---

## 1. Architecture Overview

SweepBot is a **monorepo** containing four primary applications sharing common packages:

```
sweepbot/                        ← pnpm workspace root
├── apps/
│   ├── web/                     ← React dashboard (Vite + Tailwind + shadcn/ui)
│   ├── api/                     ← REST + WebSocket API (Fastify + TypeScript)
│   ├── extension/               ← Browser extension (WXT + React + TypeScript)
│   └── desktop/                 ← Automation engine (Tauri + React)
├── packages/
│   ├── types/                   ← Shared TypeScript interfaces & Zod schemas
│   ├── utils/                   ← Shared utility functions
│   └── config/                  ← Shared ESLint, TypeScript, Tailwind configs
└── docs/                        ← Architecture, PRD, API design, etc.
```

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         USER LAYER                                  │
├──────────────┬─────────────────┬──────────────┬────────────────────┤
│   Browser    │   Web Dashboard │   Desktop    │   Mobile (P3)      │
│  Extension   │   (React SPA)   │ App (Tauri)  │   (React Native)   │
│  (WXT/MV3)   │                 │              │                     │
└──────┬───────┴────────┬────────┴──────┬───────┴────────────────────┘
       │                │               │
       │ REST / WS      │ REST / WS     │ Local IPC
       │                │               │
┌──────▼────────────────▼───────────────┐
│              API GATEWAY              │
│         (Fastify + TypeScript)        │
│     Rate Limiting | Auth | CORS       │
└──────┬──────┬──────┬──────────────────┘
       │      │      │
  ┌────▼─┐ ┌──▼───┐ ┌▼─────────────┐
  │ Auth │ │ REST │ │  WebSocket   │
  │ svc  │ │ API  │ │  (Realtime)  │
  └──────┘ └──┬───┘ └──────────────┘
              │
  ┌───────────▼─────────────────────────────────┐
  │              SERVICE LAYER                   │
  ├───────────┬──────────┬───────────┬──────────┤
  │ Analytics │ Platform │  Jackpot  │  Trust   │
  │  Service  │  Service │  Poller   │  Index   │
  └─────┬─────┴────┬─────┴─────┬─────┴──────────┘
        │          │            │
  ┌─────▼──────────▼────────────▼──────────────────┐
  │              DATA LAYER                         │
  ├────────────────┬────────────────────────────────┤
  │  PostgreSQL    │  Redis (Cache + Pub/Sub)        │
  │  (Supabase)    │                                 │
  │  - sessions    │  - jackpot_realtime             │
  │  - games       │  - session_cache                │
  │  - platforms   │  - rate_limit_buckets           │
  │  - users       │  - auth_sessions                │
  │  - trust_index │                                 │
  └────────────────┴────────────────────────────────┘
```

---

## 3. Tech Stack

### 3.1 Frontend — Web Dashboard
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 + TypeScript | Industry standard, excellent AI training data coverage |
| Build tool | Vite 5 | Fast HMR, excellent DX, Rollup-based bundling |
| Styling | Tailwind CSS v4 | Utility-first, no runtime overhead |
| Components | shadcn/ui | Accessible, unopinionated, full ownership of components |
| Routing | React Router v7 | Most mature React routing solution |
| State management | Zustand | Lightweight, TypeScript-native, no boilerplate |
| Server state | TanStack Query v5 | Best-in-class data fetching, caching, optimistic updates |
| Forms | React Hook Form + Zod | Type-safe forms with schema validation |
| Charts | Recharts | React-native, composable, customizable |
| Auth | Supabase Auth (SDK) | Seamless integration with Supabase backend |
| Payments | Stripe.js + React Stripe | PCI-compliant payment flows |
| Animation | Framer Motion | Polished micro-animations |
| Icons | Lucide React | Consistent icon system, tree-shakeable |
| Testing | Vitest + Testing Library | Fast, Vite-native test runner |

### 3.2 Backend — API
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js 22 LTS | Current LTS, native TypeScript via --experimental-strip-types |
| Framework | Fastify 5 | 2-3x faster than Express, TypeScript-native, schema validation |
| Language | TypeScript 5.5+ | Type safety across the full stack |
| ORM | Drizzle ORM | Type-safe, lightweight, migration-first approach |
| Database | PostgreSQL 16 (Supabase) | Managed, PGVECTOR for future ML features, realtime subscriptions |
| Cache | Redis 7 (Upstash) | Serverless Redis, generous free tier, global distribution |
| Auth | Supabase Auth | JWT-based, multiple OAuth providers, RLS policies |
| Queues | BullMQ (Redis-backed) | Background job processing for automation tasks |
| WebSocket | Fastify WebSocket | Native WebSocket support, efficient pub/sub |
| Email | Resend | Developer-friendly transactional email |
| Storage | Supabase Storage | S3-compatible object storage for avatars, exports |
| Logging | Pino | Fastest Node.js JSON logger, structured logging |
| Testing | Vitest | Unified test runner across monorepo |
| API docs | Scalar | Auto-generated from Fastify JSON Schema |

### 3.3 Browser Extension
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | WXT (Web Extension Tools) | Best DX for modern MV3 extensions, React support |
| Language | TypeScript | Type safety for extension APIs |
| UI | React + Tailwind | Shared patterns with web dashboard |
| State | Zustand (persisted) | Works seamlessly with extension storage APIs |
| Communication | WXT messaging | Type-safe cross-context messaging |
| Data capture | Content script interceptors | XHR/fetch monkey-patching for transaction capture |
| Bundler | Vite (via WXT) | Fast rebuilds during development |

### 3.4 Desktop App — Automation Engine
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Tauri v2 | Rust backend (smaller, faster, more secure than Electron) |
| UI | React + Tailwind | Reuse web dashboard components |
| Automation | Playwright | Most reliable headless browser automation |
| Encryption | AES-256-GCM | Credential vault encryption (via Rust backend) |
| Local DB | SQLite (via Tauri) | Local audit trail and credential metadata |

### 3.5 Monorepo Tooling
| Tool | Purpose |
|------|---------|
| pnpm 9 | Fast, disk-efficient package manager with workspace support |
| Turborepo | Build cache, task orchestration across packages |
| TypeScript 5.5+ | Strict type checking across all packages |
| ESLint 9 + flat config | Unified linting rules |
| Prettier | Code formatting |
| Husky + lint-staged | Pre-commit hooks |
| Changesets | Version management and changelog generation |

### 3.6 Infrastructure & Deployment
| Service | Purpose | Cost Model |
|---------|---------|-----------|
| Vercel | Web dashboard hosting | Free tier → Pro (~$20/mo) |
| Railway | API hosting | Usage-based (~$5–50/mo) |
| Supabase | PostgreSQL + Auth + Storage | Free → Pro ($25/mo) |
| Upstash Redis | Redis cache and queues | Free → Pay per request |
| Cloudflare | CDN, DDoS protection, DNS | Free tier sufficient initially |
| GitHub Actions | CI/CD pipelines | Free for public repos |
| Sentry | Error monitoring | Free tier initially |
| PostHog | Product analytics | Free tier |
| Resend | Transactional email | Free tier (100/day) |

---

## 4. Database Architecture

### 4.1 Core Tables (PostgreSQL)

```sql
-- Users (managed by Supabase Auth, extended here)
profiles (id, email, display_name, avatar_url, tier, stripe_customer_id, created_at, updated_at)

-- Platforms
platforms (id, slug, name, display_name, url, affiliate_url, logo_url, is_active, created_at)

-- User-platform relationships
user_platforms (id, user_id, platform_id, is_active, added_at, last_synced_at)

-- Gaming sessions
sessions (id, user_id, platform_id, game_id, started_at, ended_at,
          total_wagered, total_won, net_result, rtp, spin_count, bonus_triggers)

-- Individual transactions (spins/bets) - HIGH VOLUME TABLE
transactions (id, session_id, user_id, platform_id, game_id, timestamp,
              bet_amount, win_amount, is_bonus_trigger, is_jackpot, balance_after)

-- Games
games (id, platform_id, external_game_id, name, provider, slug,
       theoretical_rtp, volatility_class, is_active, created_at)

-- Jackpot snapshots - TIME SERIES
jackpot_snapshots (id, platform_id, game_id, value, currency, captured_at)

-- Redemptions
redemptions (id, user_id, platform_id, requested_at, approved_at, received_at,
             amount, currency, payment_method, status, notes)

-- Trust index scores
trust_index_scores (id, platform_id, score, score_breakdown, calculated_at, version)

-- TOS snapshots
tos_snapshots (id, platform_id, url, content_hash, content, captured_at, changes_detected)

-- Subscription / billing
subscriptions (id, user_id, stripe_subscription_id, tier, status,
               current_period_start, current_period_end, cancel_at_period_end)
```

### 4.2 Partitioning Strategy

```sql
-- transactions table partitioned by month (for scale)
CREATE TABLE transactions (...)
PARTITION BY RANGE (timestamp);

-- Auto-create monthly partitions via pg_partman extension
```

### 4.3 Key Indexes

```sql
-- Sessions: user_id + started_at for dashboard queries
CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at DESC);

-- Transactions: session_id for session detail views
CREATE INDEX idx_transactions_session ON transactions(session_id);

-- Jackpot snapshots: game_id + captured_at for charting
CREATE INDEX idx_jackpot_game_time ON jackpot_snapshots(game_id, captured_at DESC);
```

### 4.4 Row Level Security (Supabase RLS)

```sql
-- Users can only read/write their own data
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);
```

---

## 5. API Architecture

### 5.1 REST Endpoints (Base: /api/v1)

```
GET  /health                    → Health check
GET  /docs                      → Scalar API documentation

POST /auth/refresh              → Refresh access token

GET  /platforms                 → List all platforms
GET  /platforms/:id             → Platform details + Trust Index
GET  /platforms/:id/games       → Games on platform

GET  /user/profile              → Current user profile
PUT  /user/profile              → Update profile
GET  /user/platforms            → User's tracked platforms
POST /user/platforms            → Add platform
DELETE /user/platforms/:id      → Remove platform

GET  /sessions                  → User's sessions (paginated)
POST /sessions                  → Create session (from extension)
GET  /sessions/:id              → Session detail
PUT  /sessions/:id              → Update/close session

POST /transactions/batch        → Batch insert transactions (from extension)

GET  /analytics/rtp             → Personal RTP aggregation
GET  /analytics/portfolio       → Portfolio overview
GET  /analytics/trends          → Temporal trend data

GET  /jackpots                  → Current jackpot values
GET  /jackpots/:game_id/history → Jackpot history chart data

GET  /redemptions               → User redemption history
POST /redemptions               → Log new redemption
PUT  /redemptions/:id           → Update redemption status

GET  /trust-index               → All platform trust scores
GET  /trust-index/:platform_id  → Single platform trust score

POST /webhooks/stripe           → Stripe webhook handler
POST /webhooks/supabase         → Supabase auth events (welcome email on user.created)
```

### 5.2 WebSocket Events

```
CLIENT → SERVER:
  session:start     { platform_id, game_id }
  session:update    { session_id, spins: [...] }
  session:end       { session_id }
  jackpot:subscribe { platform_ids: [] }

SERVER → CLIENT:
  jackpot:update    { game_id, value, delta }
  session:ack       { session_id }
  trust:update      { platform_id, score }
  notification      { type, title, body }
```

---

## 6. Browser Extension Architecture

### 6.1 Extension Contexts

```
┌─────────────────────────────────────────────────────┐
│                BROWSER EXTENSION                     │
├────────────────┬────────────────┬───────────────────┤
│  Background    │  Content       │  Popup / Options  │
│  Service Worker│  Scripts       │  (React UI)       │
│                │                │                   │
│ - Session mgmt │ - Page DOM     │ - Dashboard mini  │
│ - API sync     │   observation  │ - Quick stats     │
│ - Alarm clocks │ - XHR intercept│ - Platform list   │
│ - Notifications│ - Platform     │ - Settings        │
│ - Badge updates│   detection    │                   │
└────────────────┴────────────────┴───────────────────┘
```

### 6.2 Data Flow (Extension)

```
User plays slot → XHR intercept (content script) → parse response
→ extract { bet, win, balance } → post to background
→ background: update local session state
→ background: batch queue (flush every 30s or 50 spins)
→ API: POST /transactions/batch
→ background: recalculate RTP → post to content script
→ content script: update HUD overlay
```

---

## 7. Security Architecture

### 7.1 Authentication Flow

```
User signs in → Supabase Auth → JWT (15min access + 7day refresh)
→ Access token stored in memory (not localStorage)
→ Refresh token stored in httpOnly cookie
→ All API requests: Authorization: Bearer <access_token>
→ API validates JWT → extracts user_id → applies RLS
```

### 7.2 Credential Vault (Desktop App)

```
User enters master password → Argon2id KDF → 256-bit key
→ Key + Argon2id params stored locally
→ Platform credentials encrypted with AES-256-GCM
→ Encrypted blob stored in SQLite (local only)
→ Nothing transmitted to server — zero-knowledge design
```

### 7.3 Extension Security

```
Content script → background (via chrome.runtime.sendMessage)
→ Message schema validation (Zod)
→ No eval(), no inline scripts
→ Content Security Policy: strict
→ Host permissions: only known platform domains
```

---

## 8. Deployment Architecture

### 8.1 CI/CD Pipeline (GitHub Actions)

```yaml
On Push to main:
  1. Install dependencies (pnpm)
  2. Type check (tsc --noEmit)
  3. Lint (ESLint)
  4. Test (Vitest)
  5. Build all apps (turbo build)
  6. Deploy web → Vercel (auto)
  7. Deploy api → Railway (auto)
  8. Extension build artifact → GitHub Releases
```

### 8.2 Environment Strategy

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| Local dev | Development | Local services via Docker Compose |
| Preview | PR testing | Vercel preview + Railway staging |
| Production | Live app | Vercel + Railway + Supabase prod |

---

## 9. Data Moat & Collection Strategy

The following data categories are irreplaceable once collection begins — starting collection is the single highest-priority action:

| Dataset | Collection Method | Moat Strength |
|---------|-----------------|--------------|
| Jackpot time series | API poller (every 60s) | **Critical** — ephemeral, gone if not captured |
| User RTP data | Extension + sessions | **High** — requires millions of spins |
| Redemption timing | User self-report | **High** — requires thousands of data points |
| TOS change history | Automated scraper (daily) | **High** — requires continuous monitoring |
| Game RTP | Extension + transactions | **Medium-High** — crowdsourced, takes time |
| Platform uptime | Health checker (every 5m) | **Medium** — requires sustained monitoring |

**Recommendation:** Deploy the Replit-hosted poller for jackpots, TOS monitoring, and platform health checks BEFORE the product launches. Every day of early data collection is a permanent competitive advantage.

---

## 10. Scalability Considerations

### Phase 1 (0–10K users)
- Single API instance (Railway)
- Single PostgreSQL (Supabase free → Pro)
- Redis for caching (Upstash)
- Everything monolith — no microservices

### Phase 2 (10K–100K users)
- API horizontal scaling (Railway autoscale)
- Read replicas for analytics queries
- Separate analytics service (heavy queries don't block API)
- CDN for static assets

### Phase 3 (100K+ users)
- Event streaming (Kafka) for transaction ingestion
- Time-series database for jackpot data (TimescaleDB)
- Separate microservices for trust index calculation
- Global edge deployment (Cloudflare Workers for API)

---

*Architecture maintained by APPYness. Last updated 2026-02-26.*
