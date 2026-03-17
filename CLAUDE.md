# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SweepBot is a monorepo (pnpm + Turborepo) providing an "operating system" for sweepstakes casino players: cross-platform portfolio tracking, NLP-driven automation, real-time jackpot intelligence, and a browser extension. It is a transparency/productivity tool — **not a gambling product**. Legal context: sweepstakes casinos use virtual currencies, not real money.

## Commands

All commands run from the repo root unless noted. Turborepo handles dependency ordering automatically.

```bash
# Development
pnpm dev                              # Start all apps (web: 3000, api: 3001, extension: WXT HMR)
pnpm --filter @sweepbot/api dev       # Start only the API
pnpm --filter @sweepbot/web dev       # Start only the web dashboard
pnpm --filter @sweepbot/extension dev # Start only the extension

# Build
pnpm build                            # Build all apps/packages in dependency order
pnpm build:flows                      # Build flows package only

# Testing
pnpm test                             # Run all Vitest test suites
pnpm test:watch                       # Watch mode (useful during flows development)
pnpm test:coverage                    # Generate coverage reports (target: 80%+)
pnpm --filter @sweepbot/web test:e2e  # Playwright/Puppeteer E2E tests

# Code Quality
pnpm lint                             # ESLint all packages (0 warnings policy)
pnpm lint:fix                         # Auto-fix lint errors
pnpm typecheck                        # TypeScript strict checking across all packages
pnpm format                           # Prettier on TS, JSON, MD, CSS
pnpm format:check                     # Check formatting without modifying

# Database (run from apps/api/ or via root)
pnpm db:migrate                       # Drizzle Kit: push schema changes to PostgreSQL
pnpm db:seed                          # Seed with test data
pnpm db:studio                        # Open Drizzle Studio visual editor

# Extension builds
pnpm --filter @sweepbot/extension build:zip          # Chrome Web Store ZIP
pnpm --filter @sweepbot/extension build:zip:firefox  # Firefox Add-ons ZIP
```

## Architecture

### Monorepo Structure

```
apps/
  api/        → Fastify 5 REST + WebSocket API (port 3001)
  web/        → React 18 SPA dashboard (port 3000, deployed to Vercel)
  extension/  → Browser extension MV3 (WXT, Chrome + Firefox)
packages/
  flows/      → NLP automation engine (pure Node.js, no framework)
  types/      → Shared TypeScript interfaces and Zod schemas (no runtime logic)
  utils/      → Shared utilities: math, string, date, currency, crypto, logger, validation
  config/     → Shared ESLint, TypeScript, and Tailwind configs
services/
  health-checker/   → Python: platform uptime monitoring every 5 min (Replit)
  jackpot-poller/   → Python: jackpot value polling every 60s (Replit)
  tos-monitor/      → Python: ToS change detection daily (Replit)
  migrations/       → Database migration tracking
docs/               → All documentation (PRD, architecture, API design, roadmap, etc.)
```

### Data Flow

The browser extension intercepts XHR/Fetch on casino sites → extracts `{bet, win, balance}` → batches to `POST /transactions/batch` on the API → persisted to PostgreSQL → RTP calculated → WebSocket update → dashboard re-renders.

### Flow Engine Pipeline (`packages/flows/`)

The NLP engine converts natural language to executable automation:

```
User text → EntityRecognizer → FlowInterpreter (4-pass: entities → intent → AST → validation)
         → ResponsiblePlayValidator → FlowDefinition (AST) → FlowExecutor → FlowScheduler (cron)
```

FlowNode is a discriminated union of 9 types: `ActionNode | ConditionNode | LoopNode | SequenceNode | ParallelNode | WaitNode | StopNode | AlertNode | StoreNode`.

## Key Conventions

### TypeScript

- **Strict mode everywhere**: no `any` in core logic; use `unknown` and narrow properly
- All API inputs validated with Zod before processing
- Shared types live in `packages/types/src/index.ts` — add there, not inline

### API Response Format (all routes must follow this)

```typescript
{ success: true, data: T }                           // single item
{ success: true, data: T[], meta: PaginationMeta }   // paginated list
{ error: string, message: string, status: number }   // error
```

### File Organization

- API routes: `apps/api/src/routes/[resource].ts` → registered in `routes/index.ts` as a Fastify plugin
- Web pages: `apps/web/src/pages/[PageName].tsx` → added to TanStack Router route tree
- Documentation: `docs/[TOPIC].md` — **not** the repo root

### Tech Stack Decisions (closed — do not re-litigate)

React (not Vue/Svelte), Fastify (not Express/Hono), Drizzle (not Prisma), pnpm (not npm/yarn), WXT (not Plasmo), Vitest (not Jest), Tailwind v4 (not styled-components).

## Database

- **PostgreSQL 16** via Supabase with Row Level Security (RLS) on all user tables
- Schema source of truth: `apps/api/src/db/schema/index.ts` (Drizzle ORM)
- `transactions` partitioned by month; `jackpot_snapshots` partitioned by quarter
- Migrations in `apps/api/src/db/migrations/`
- **Redis** (Upstash) via BullMQ for job queues, session caching, rate limiting

## Responsible Play — Non-Negotiable

Every automation flow **must** enforce these guardrails (baked into `packages/flows/src/validator/responsible-play-validator.ts`):

1. `max_duration` — cap session time (default 2 hours; cannot be removed)
2. `cool_down_check` — block execution during user cool-down (**cannot be overridden**, even by the user)
3. Loop caps — every loop must have `maxIterations ≤ 100` and `maxDuration ≤ 30 min`

Do not add features that suggest "winning more," predict outcomes, or allow circumventing these guardrails.

## What Does Not Exist Yet

Do not assume or scaffold: Tauri desktop app, LLM fallback in flows, Firefox support, mobile app, community forums, B2B data API. These are Phase 2–4 on the roadmap.

## Environment Setup

```bash
cp .env.example .env
# Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY
# Required: DATABASE_URL (PostgreSQL), REDIS_URL (Upstash)
# Required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# Optional: RESEND_API_KEY (email), SENTRY_DSN, POSTHOG_API_KEY
```

## Git Conventions

- `main` is protected — no direct commits
- Branch naming: `feat/description`, `fix/description`
- Pre-commit hooks (Husky + lint-staged) run ESLint + Prettier on staged files
