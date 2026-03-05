# SweepBot — Development Roadmap

**Version:** 2.0
**Last Updated:** March 2026
**Status:** Phase 1 Complete ✅ | Phase 2 Active 🔄

---

## Guiding Principles

1. **Ship the beachhead first** — Browser extension is the primary acquisition channel and data collection engine. Everything else is secondary.
2. **Build the moat in parallel** — Data collection (jackpots, TOS, platform uptime) starts NOW, before any user-facing product ships. See [DATA_MOAT_ROADMAP.md](DATA_MOAT_ROADMAP.md).
3. **Revenue from day one** — Affiliate links in the free extension generate revenue immediately, before any paid subscriptions exist.
4. **Each phase must be independently shippable** — Users get real value at every milestone.

---

## ✅ Phase 0: Foundation — COMPLETE

**Goal:** Monorepo setup, shared infrastructure, data moat collection begins.

### Infrastructure ✅
- [x] Monorepo init (pnpm + Turborepo)
- [x] `packages/types` — All shared TypeScript interfaces
- [x] `packages/utils` — Shared utilities
- [x] `packages/config` — ESLint, TypeScript, Tailwind configs
- [ ] Supabase project creation (prod + staging)
- [ ] GitHub branch protection rules
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Domain acquisition: sweepbot.app
- [ ] Vercel + Railway project setup
- [ ] Upstash Redis setup
- [ ] Sentry error monitoring

### Always-On Data Collection — ⚠️ DEPLOY NOW (P0)
- [ ] **Jackpot poller** — scrape progressive jackpot values every 60s (Replit)
- [ ] **TOS monitor** — daily diff-check of platform terms (Replit)
- [ ] **Platform health checker** — uptime every 5 minutes (Replit)
- [ ] **Platform data seed** — populate platforms table with 40 known platforms

> ⚠️ **Every day without the jackpot poller is irreplaceable data burned.** Deploy this before anything else.

---

## ✅ Phase 1: NLP Flow Engine — COMPLETE

**Goal:** Users can describe automation routines in plain English. SweepBot converts them to safe, executable scripts.

### Core Engine ✅ (100% complete)
- [x] Natural Language Entity Recognition (13+ platforms, 10+ games, 10+ action types)
- [x] 4-pass interpretation pipeline (→ entity → intent → AST → validation)
- [x] Flow Definition AST (9 node types)
- [x] Flow Executor with recursive AST traversal
- [x] Responsible Play Validator (mandatory, non-overridable guardrails)
- [x] Cron-based Flow Scheduler with timezone support
- [x] Multi-turn Conversation Manager
- [x] 4 database tables (flows, executions, conversations, shared_flows)
- [x] 8 API endpoints (interpret, converse, CRUD, execute, history)
- [x] React UI (FlowsPage, FlowChatPage, FlowDetailPage)
- [x] 54 test suites, 285+ assertions, 80%+ coverage

**Phase 1 metrics:** 1,500+ lines core logic | 1,600+ lines tests | Full TypeScript strict mode

---

## 🔄 Phase 2: Action Execution + Live Data — IN PROGRESS

**Goal:** Connect the Flow Engine to real browser actions. Begin live data collection. Achieve first revenue.

### Extension — Action Execution (P0 — Connect Phase 1 to Reality)
- [ ] Platform detection engine for 15+ platforms
- [ ] XHR/fetch interceptor — per-platform parsers for spin data extraction
- [ ] Real-time RTP calculation engine
- [ ] In-page HUD overlay
- [ ] Session detection (start / end / pause)
- [ ] **Flow action handlers** — claim_bonus, spin, login, check_balance, cash_out
- [ ] Affiliate link injection (extension popup + platform pages)
- [ ] Privacy policy page
- [ ] Chrome Web Store submission

### API — Data Ingestion
- [ ] Fastify server full setup with TypeScript
- [ ] Supabase auth integration (JWT validation middleware)
- [ ] `/sessions` endpoints
- [ ] `/transactions/batch` endpoint (high-volume extension sync)
- [ ] `/analytics/portfolio` endpoint
- [ ] `/analytics/rtp` endpoint
- [ ] WebSocket server (jackpot live feed + session sync)
- [ ] Rate limiting + Sentry + Pino structured logging

### LLM Fallback for Flow Interpreter
- [ ] Claude API integration for confidence < 0.7 interpretations
- [ ] Fallback response formatted into FlowInterpretationResult
- [ ] Cost tracking per user per month (guard against abuse)

### Web Dashboard
- [ ] Authentication (sign up / in / reset)
- [ ] Onboarding flow (add first platform, install extension CTA)
- [ ] Command Center (portfolio overview)
- [ ] Platform management page
- [ ] Session history page
- [ ] RTP analytics page
- [ ] User settings
- [ ] Stripe subscription management

### Stripe Integration
- [ ] Products/prices in Stripe (all 5 tiers)
- [ ] Checkout flow
- [ ] Customer portal
- [ ] Webhook handler (sub created / updated / cancelled)
- [ ] Feature-gating middleware (tier → feature map)

**Phase 2 Launch Criteria:**
- Extension installable from Chrome Web Store
- At least 5 platforms fully supported (full action execution)
- Dashboard live and accepting signups
- Stripe checkout working end-to-end
- Affiliate links generating attributed clicks
- Jackpot poller live and collecting

---

## 🗓 Phase 3: Analytics + Trust Index (Weeks 11–20)

**Goal:** Full analytics suite. Trust Index public launch. Redemption tracking. Data products begin.

- [ ] Bonus feature analytics (trigger rate, bonus RTP)
- [ ] Session pattern analysis (RTP by time/day)
- [ ] Wagering requirement tracker
- [ ] Redemption tracker with status workflow
- [ ] Jackpot history charts (data moat milestone: M1 hit)
- [ ] Platform comparison analytics
- [ ] Data export (CSV/PDF)
- [ ] Trust Index calculation engine + public page (SEO)
- [ ] Game Intelligence Database scaffold (crowdsourced RTP)
- [ ] Firefox extension port (WXT handles 80% of this)

---

## 🗓 Phase 4: Community + Data Products (Weeks 21–32)

**Goal:** Community hub, B2B data products, tax center.

- [ ] Forum system
- [ ] Strategy sharing + platform reviews
- [ ] Shared Flows marketplace (with packager — ensure no credential leakage in shared scripts)
- [ ] B2B Data API (key management, usage metering, billing)
- [ ] Quarterly industry reports (PDF generation)
- [ ] Platform Certification Program (Trust Index monetization)
- [ ] Tax Center (redemption aggregation, PDF export)
- [ ] Mail Bonus Scraper (Gmail / Outlook OAuth)
- [ ] Responsible Play Suite formalization (session limits, loss alerts, self-exclusion)

---

## 🗓 Phase 5: Mobile + Scale (Weeks 33+)

- [ ] React Native app (iOS + Android)
- [ ] Push notifications
- [ ] International localization (Spanish, Portuguese)
- [ ] TimescaleDB migration for jackpot time-series (at scale)
- [ ] SweepCon event planning
- [ ] White-label partnership exploration

---

## Critical Path

Delays in these items cascade into every phase:

1. **Jackpot + TOS poller deployed to Replit** → Data moat starts; every day of delay is permanent loss
2. **Supabase setup** → Blocks all persistent data work
3. **`packages/types` complete** → Blocks API and web
4. **Extension action handlers** → Blocks Flow Engine's core value (Phase 2 centerpiece)
5. **Stripe integration** → Blocks revenue

---

## Sprint Velocity Reference

| Phase | Duration | Primary Output |
|-------|----------|----------------|
| Phase 0 | Complete | Monorepo + infrastructure |
| Phase 1 | Complete | NLP Flow Engine |
| Phase 2 | Weeks 1–10 | Extension actions + dashboard + Stripe |
| Phase 3 | Weeks 11–20 | Analytics + Trust Index + Game Intelligence |
| Phase 4 | Weeks 21–32 | Community + Data Products |
| Phase 5 | Weeks 33+ | Mobile + Scale |

---

*Roadmap maintained by APPYness. Phases reflect current ground truth as of March 2026.*
