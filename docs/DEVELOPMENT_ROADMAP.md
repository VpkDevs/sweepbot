# SweepBot — Development Roadmap

**Version:** 1.0.0
**Date:** 2026-02-26

---

## Guiding Principles

1. **Ship the beachhead first** — Browser extension is the primary acquisition channel and data collection engine. Everything else is secondary.
2. **Build the moat in parallel** — Data collection (jackpots, TOS, platform uptime) starts NOW, before any user-facing product ships.
3. **Revenue from day one** — Affiliate links in the free extension generate revenue immediately, before any paid subscriptions exist.
4. **Each phase must be independently shippable** — Users get real value at every milestone.

---

## Phase 0: Foundation (Weeks 1–3)

**Goal:** Monorepo setup, shared infrastructure, data moat collection begins.

### Infrastructure
- [x] Monorepo init (pnpm + Turborepo)
- [ ] Supabase project creation (prod + staging)
- [ ] GitHub repository + branch protection rules
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Domain acquisition: sweepbot.app
- [ ] Vercel project setup
- [ ] Railway project setup
- [ ] Upstash Redis setup
- [ ] Sentry error monitoring setup

### Always-On Data Collection (Deploy to Replit)
- [ ] **Jackpot poller** — scrape progressive jackpot values from 20+ platforms every 60s
- [ ] **TOS monitor** — daily diff-check of platform terms/conditions
- [ ] **Platform health checker** — uptime monitoring every 5 minutes
- [ ] **Platform data seed** — populate platforms table with 40 known platforms

### Shared Packages
- [ ] `packages/types` — All shared TypeScript interfaces
- [ ] `packages/utils` — Shared utilities (crypto, format, validation)
- [ ] `packages/config` — ESLint, TypeScript, Tailwind configs

### Database
- [ ] Initial migration: all core tables
- [ ] RLS policies for all user-scoped tables
- [ ] Seed data: platforms, game providers, initial games

---

## Phase 1: Beachhead + MVP Dashboard (Weeks 4–10)

**Goal:** Browser extension live in Chrome Web Store. Basic dashboard live. First revenue.

### Browser Extension (P0 — Week 4–7)
- [ ] WXT project scaffold
- [ ] Platform detection engine (40+ platforms)
- [ ] XHR/fetch interceptor for transaction capture
- [ ] Real-time RTP calculation engine
- [ ] In-page HUD overlay
- [ ] Session detection (start/end/pause)
- [ ] Local session storage (extension storage API)
- [ ] Popup UI: mini dashboard
- [ ] Affiliate link injection (non-intrusive)
- [ ] Privacy policy page
- [ ] Chrome Web Store submission

### API (Weeks 4–8)
- [ ] Fastify server setup with TypeScript
- [ ] Supabase auth integration (JWT validation)
- [ ] `/auth` endpoints
- [ ] `/platforms` endpoints
- [ ] `/sessions` endpoints
- [ ] `/transactions/batch` endpoint (for extension sync)
- [ ] `/analytics/portfolio` endpoint
- [ ] `/analytics/rtp` endpoint
- [ ] WebSocket server (jackpot + session real-time)
- [ ] Rate limiting middleware
- [ ] Error handling + Sentry integration
- [ ] Logging (Pino)
- [ ] Scalar API documentation

### Web Dashboard (Weeks 6–10)
- [ ] Vite + React + TypeScript + Tailwind + shadcn/ui scaffold
- [ ] Authentication (sign up, sign in, password reset)
- [ ] Onboarding flow (add first platform, install extension CTA)
- [ ] Command Center (portfolio overview)
- [ ] Platform management page
- [ ] Session history page
- [ ] Basic RTP analytics page
- [ ] User settings page
- [ ] Subscription management (Stripe)
- [ ] Responsive design (desktop + tablet)

### Stripe Integration
- [ ] Products/prices created in Stripe (all 5 tiers)
- [ ] Checkout flow (upgrade modal)
- [ ] Customer portal (manage subscription)
- [ ] Webhook handler (subscription created/updated/cancelled)
- [ ] Feature gating middleware

**Phase 1 Launch Criteria:**
- Extension installable from Chrome Web Store
- Dashboard live and accepting signups
- At least 3 platforms fully supported by extension
- Stripe checkout working end-to-end
- Affiliate links generating clicks

---

## Phase 2: Automation Engine + Intelligence (Weeks 11–20)

**Goal:** Desktop app with automation. Full analytics. Redemption tracking. Trust Index.

### Desktop App — Automation Engine (Weeks 11–16)
- [ ] Tauri v2 project scaffold
- [ ] Secure credential vault (AES-256-GCM, Argon2id)
- [ ] Master password + biometric setup
- [ ] Manual-trigger automation runner
- [ ] Playwright integration (headless/headed modes)
- [ ] Human-like interaction patterns (random delays, cursor simulation)
- [ ] Per-platform script system (starting with 10 platforms)
- [ ] Run log with success/failure tracking
- [ ] CAPTCHA and block detection + graceful pause
- [ ] Auto-update mechanism

### Analytics Expansion (Weeks 12–16)
- [ ] Full bonus feature analytics (trigger rate, bonus RTP)
- [ ] Session pattern analysis (RTP by time/day)
- [ ] Wagering requirement tracker
- [ ] Redemption tracker with status workflow
- [ ] Jackpot history charts
- [ ] Platform comparison analytics
- [ ] Data export (CSV/PDF)

### Trust Index (Weeks 15–18)
- [ ] Trust Index calculation engine
- [ ] Component scores: redemption speed, rejection rate, TOS stability, etc.
- [ ] Platform directory with Trust Index scores
- [ ] Trust Index historical trend chart
- [ ] Public-facing Trust Index page (SEO value)

### Game Intelligence Database (Weeks 16–20)
- [ ] Crowdsourced RTP aggregation pipeline
- [ ] Per-game profile pages
- [ ] Provider analytics layer
- [ ] Game search and filtering
- [ ] Game comparison tool

### Firefox Extension
- [ ] Port Chrome extension to Firefox (WXT handles most of this)
- [ ] Firefox Add-ons submission

---

## Phase 3: Community + Data Products (Weeks 21–32)

**Goal:** Community hub, B2B data products, tax center, mobile readiness.

### Community Hub
- [ ] Forum system (categories, threads, replies)
- [ ] Strategy sharing (formatted strategy posts)
- [ ] Platform reviews (user-generated, moderated)
- [ ] Reputation/karma system
- [ ] Script contribution system (automation scripts)
- [ ] Verified information badges

### Data Products
- [ ] B2B Data API (platform, game, jackpot data)
- [ ] API key management
- [ ] Usage metering + billing
- [ ] Quarterly industry reports (PDF generation)
- [ ] Platform Certification Program

### Tax Center
- [ ] Redemption aggregation by calendar year
- [ ] Estimated tax liability calculator
- [ ] Accountant-ready PDF export
- [ ] 1099 reconciliation helper

### Mail Bonus Scraper (Desktop only)
- [ ] Gmail OAuth integration
- [ ] Outlook/IMAP integration
- [ ] Bonus email detection patterns
- [ ] Auto-claim pipeline

### Responsible Play Suite (Formalize what was built in Phase 1)
- [ ] Session time limits with enforced pop-ups
- [ ] Loss limit alerts (configurable thresholds)
- [ ] Cool-down enforcement (lockout period)
- [ ] Chase detection (unusual session patterns)
- [ ] Monthly wellbeing summary email
- [ ] Self-exclusion tools
- [ ] Support resources directory

---

## Phase 4: Mobile + Scale (Weeks 33+)

- [ ] React Native app (iOS + Android)
- [ ] Push notifications (mobile)
- [ ] International markets research + localization
- [ ] Performance optimization (database, API)
- [ ] SweepCon community event planning
- [ ] White-label partnership exploration

---

## Sprint Velocity Estimate

| Phase | Duration | Weekly Output |
|-------|----------|---------------|
| Phase 0 | 3 weeks | Infrastructure + data collection |
| Phase 1 | 7 weeks | Extension + Dashboard + Stripe |
| Phase 2 | 10 weeks | Desktop + Analytics + Trust Index |
| Phase 3 | 12 weeks | Community + Data products |
| Phase 4 | Ongoing | Mobile + Scale |

---

## Critical Path

The following items are on the critical path — delays here cascade:

1. **Supabase setup** → blocks all data work
2. **shared `types` package** → blocks API and web development
3. **Auth (API)** → blocks dashboard
4. **Extension transaction capture** → blocks core value prop
5. **Stripe integration** → blocks revenue

---

*Roadmap maintained by APPYness. Subject to revision based on user feedback and market conditions.*
