# SweepBot — AI Agent Context

> Read this first. Every time. No exceptions.
> This file exists so you don't waste tokens re-discovering context that's already been settled.

---

## What SweepBot Is

**SweepBot** is the operating system for the sweepstakes casino player ecosystem.
Tagline: *"We give players what the house never wants them to have."*

It is a **SaaS + browser extension + desktop automation** platform that gives sweepstakes casino players:

- Cross-platform portfolio visibility (P&L, RTP, sessions)
- Passive session tracking via browser extension
- Daily bonus automation via desktop app
- Crowdsourced jackpot intelligence and platform trust scores
- Redemption tracking with community-sourced processing time data
- TOS monitoring (change alerts in plain English)
- Subscription billing with affiliate revenue sharing

Owner: Vincent Kinney / APPYness
Status: Phase 1 built (NLP flows engine + extension core + API + web dashboard). Phase 2 in progress.
This is a **private, UNLICENSED** project. Do not suggest open-sourcing anything.

---

## Monorepo Structure

```text
sweepbot/                         ← pnpm workspace root (Turborepo)
├── apps/
│   ├── web/                      ← React 18 dashboard (Vite + Tailwind + shadcn/ui + TanStack Router)
│   ├── api/                      ← REST + WebSocket API (Fastify 5 + TypeScript + Drizzle ORM)
│   └── extension/                ← Browser extension (WXT + React + TypeScript, MV3)
├── packages/
│   ├── types/                    ← Shared TypeScript interfaces + Zod schemas
│   ├── utils/                    ← Shared utility functions
│   ├── config/                   ← Shared ESLint, TypeScript, Tailwind configs
│   └── flows/                    ← NLP automation engine (interpreter, executor, scheduler)
└── docs/                         ← All documentation lives here
```

> **Note:** The README references `apps/desktop/` (Tauri automation engine). This does NOT yet exist.
> Do not scaffold it without explicit instruction. The automation engine is Phase 2.

---

## Tech Stack — Closed Decisions (Do Not Re-Litigate)

| Layer | Choice | Do NOT suggest |
| ---- | ---- | ---- |
| Package manager | pnpm | npm, yarn |
| Build orchestration | Turborepo | nx, lerna |
| Frontend framework | React 18 | Vue, Svelte, Next.js |
| Frontend bundler | Vite | webpack, Parcel |
| Routing (web) | TanStack Router v1.56+ | React Router, Next.js routing |
| Styling | Tailwind CSS v4 + shadcn/ui | styled-components, emotion, MUI |
| Backend framework | Fastify 5 | Express, Hono, NestJS |
| ORM | Drizzle ORM | Prisma, TypeORM, Sequelize |
| Database | PostgreSQL 16 via Supabase | MySQL, MongoDB, SQLite (server-side) |
| Cache / queues | Redis via Upstash + BullMQ | RabbitMQ, SQS |
| Auth | Supabase Auth (JWT) | Auth0, Clerk, NextAuth |
| Payments | Stripe | PayPal, Paddle |
| State (web) | Zustand + TanStack Query | Redux, Jotai, SWR |
| Extension framework | WXT (Web Extension Tools) | Plasmo, vanilla manifest |
| Extension manifest | MV3 only | MV2 — Chrome Web Store rejects it |
| Language | TypeScript 5.5+ strict | JavaScript, `any` types in core logic |
| Test runner | Vitest | Jest |
| Email | Resend | SendGrid, Mailgun |
| Error monitoring | Sentry | Datadog, Rollbar |
| Analytics | PostHog | Mixpanel, Amplitude |
| CI/CD | GitHub Actions | CircleCI, Jenkins |
| Web hosting | Vercel | Netlify, AWS Amplify |
| API hosting | Railway | Heroku, Fly.io |

---

## What's Built (As of 2026-03-05)

### ✅ packages/flows — NLP Automation Engine

Full natural-language → executable automation pipeline:

- `EntityRecognizer` — extracts platforms, games, actions, conditions, schedules, amounts from plain English
- `FlowInterpreter` — 4-pass pipeline: entity extraction → intent classification → AST building → responsible play validation
- `FlowExecutor` — recursive AST traversal with metric tracking, guardrail enforcement, error handling
- `FlowScheduler` — cron-based scheduling with timezone support (node-cron)
- `ConversationManager` — multi-turn flow building state machine
- `ResponsiblePlayValidator` — mandatory guardrails (max_duration, cool_down_check, etc.)
- **54 test suites, 285+ assertions, 80%+ coverage**
- See `packages/flows/README.md` for full API reference

### ✅ apps/api — Fastify API

Routes implemented and working:

- `/auth/*` — sign-in, sign-up, refresh
- `/users/*` — profile CRUD
- `/sessions/*` — session lifecycle
- `/analytics/*` — portfolio, platform stats, dashboard
- `/jackpots/*` — jackpot data + history + leaderboard
- `/redemptions/*` — redemption tracking
- `/trust-index/*` — platform trust scores
- `/platforms/*` — platform management
- `/flows/*` — NLP automation CRUD + execution
- `/features/*` — achievements, heatmap, streaks, personal records, big wins board
- `/notifications/*` — notification inbox + read/unread management
- `/webhooks/stripe` — subscription lifecycle handling

### ✅ apps/extension — Browser Extension (WXT, MV3)

Core libraries in `src/lib/`:

- `platforms.ts` — detection engine for 10+ platforms
- `interceptor.ts` — XHR/Fetch monkey-patching for transaction capture
- `rtp-calculator.ts` — real-time RTP + volatility calculation
- `storage.ts` — type-safe Chrome storage wrapper
- `api.ts` — extension → API client
- `affiliate.ts` — referral link injection + signup tracking
- `voice-recorder.ts` — voice input for flow commands (undocumented but exists)
- `flows/` — flow management within the extension context (6 files)

### ✅ apps/web — React Dashboard

Pages: Dashboard, Sessions, Platforms, Analytics, Jackpots, Redemptions, Trust Index, Heatmap, Achievements, Records, Big Wins, Flows (list/new/detail), Settings, Auth pages, Pricing

### ✅ docs/ — Documentation

PRD, Technical Architecture, Database Schema, API Design, Roadmap, Monetization Strategy. See `README.md` for index.

---

## Database Notes

- PostgreSQL 16 via Supabase
- All user tables have Row Level Security (RLS) enabled
- `transactions` table is **partitioned by month** — always specify partition range when creating new ones
- `jackpot_snapshots` table is **partitioned by quarter**
- A `handle_new_user()` trigger auto-creates `profiles` rows on Supabase auth signup
- A `handle_new_profile()` trigger auto-creates `user_settings` and `subscriptions` rows
- Schema in `docs/DATABASE_SCHEMA.md` — ALSO check `apps/api/src/db/schema/` for Drizzle definitions (source of truth for actual deployed schema)

---

## Environment Variables

Located in `.env.example`. Required services:

- **SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY** — database + auth
- **STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET** — billing
- **UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN** — cache + BullMQ
- **RESEND_API_KEY** — transactional email
- **SENTRY_DSN** — error monitoring

---

## Key Conventions

### TypeScript

- **Strict mode. No `any` in core logic.** Use `unknown` and narrow properly.
- Discriminated unions for variant types (e.g., `FlowNode` is a union of 9 specific node types)
- Zod for all API input validation — do not trust raw `request.body`

### API Response Format

```typescript
{ success: true, data: T }                           // single resource
{ success: true, data: T[], meta: PaginationMeta }   // list resource
{ error: string, message: string, status: number }    // error
```

### File Organization

- New API routes → `apps/api/src/routes/[resource].ts`, registered in `apps/api/src/routes/index.ts`
- New web pages → `apps/web/src/pages/[PageName].tsx`, added to route tree
- Shared types → `packages/types/src/`
- Documentation → `docs/[TOPIC].md` (NOT the repo root)

### Git

- `main` is protected. Branch protection rules apply.
- Feature branches: `feat/description`
- Fix branches: `fix/description`

---

## Things That Don't Exist Yet (Do Not Assume They Do)

- `apps/desktop/` — Tauri automation engine (Phase 2, not started)
- LLM fallback for low-confidence NLP interpretations (Claude API integration, Phase 2)
- Firefox extension submission (planned, not done)
- Mobile app (Phase 4)
- Community forums (Phase 3)
- Tax Center UI (Phase 3)
- Mail bonus scraper (Phase 3)
- `npm run deploy:staging` — referenced in docs but not yet configured
- `npm run health-check` — referenced in docs but not yet configured

---

## Responsible Play — Non-Negotiable

Every automation feature MUST enforce these guardrails:

1. `max_duration` — cap session time (default 2 hours)
2. `cool_down_check` — block execution during user-configured cool-down periods (CANNOT be overridden)
3. Loop caps — every loop MUST have `maxIterations` (≤ 100) and `maxDuration` (≤ 30 min)

These are baked into `packages/flows/src/validator/responsible-play-validator.ts`. Do not circumvent them.
SweepBot is a **transparency and productivity tool**, not a gambling tool. Never frame features as ways to "win more" or predict outcomes.

---

## Legal Context

- Supports **sweepstakes casinos** only — these operate under US sweepstakes law, not gambling law
- Does NOT support real-money gambling sites — ever
- GDPR + CCPA compliant by design
- Age gate required (18+, COPPA)
- Privacy policy lives at `docs/PRIVACY_POLICY.md` — required URL for Chrome Web Store submission
- Automation disclosure: users confirm they are automating their own accounts in permitted jurisdictions
- Do not add features that predict gambling outcomes or suggest betting strategies

---

## Where to Find Things

| I need... | Go to |
| ---- | ---- |
| Full product requirements | `docs/PRD.md` |
| System architecture | `docs/TECHNICAL_ARCHITECTURE.md` |
| Database schema (canonical) | `docs/DATABASE_SCHEMA.md` + `apps/api/src/db/schema/` |
| API reference | `docs/API_DESIGN.md` |
| Development phases + task tracking | `docs/DEVELOPMENT_ROADMAP.md` |
| Data advantage roadmap | `docs/DATA_MOAT_ROADMAP.md` |
| Revenue model | `docs/MONETIZATION_STRATEGY.md` |
| Platform list + affiliates | `docs/PLATFORM_COVERAGE.md` |
| Extension architecture | `apps/extension/README.md` |
| NLP flows API reference | `packages/flows/README.md` |
| UI page map + design system | `docs/UI_DOCUMENTATION.md` |
| Phase 1 completion details | `docs/milestones/PHASE_1_COMPLETION.md` |
| Phase 1 implementation summary | `docs/milestones/IMPLEMENTATION_SUMMARY.md` |
| Security architecture | `docs/SECURITY_ARCHITECTURE.md` |
| Trust Index methodology | `docs/TRUST_INDEX_METHODOLOGY.md` |
| Privacy Policy | `docs/PRIVACY_POLICY.md` |
| Terms of Service | `docs/TERMS_OF_SERVICE.md` |
| Launch gate checklist | `docs/LAUNCH_CHECKLIST.md` |
| Extension store submission | `docs/EXTENSION_SUBMISSION_CHECKLIST.md` |
| Developer onboarding | `docs/DEVELOPER_ONBOARDING.md` |

