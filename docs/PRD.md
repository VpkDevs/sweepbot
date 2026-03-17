# SweepBot — Product Requirements Document (PRD)

**Version:** 1.1.0
**Date:** 2026-03-05
**Author:** Vincent Kinney, APPYness
**Status:** Phase 1 Complete — Phase 2 In Progress

---

## 1. Executive Summary

SweepBot is the **operating system for the sweepstakes casino player ecosystem** — a comprehensive SaaS platform that automates, tracks, analyzes, and optimizes the sweepstakes/social casino experience across 100+ platforms. SweepBot gives players what the house never wants them to have: complete, cross-platform transparency, automation of tedious tasks, and data-driven intelligence.

**Tagline:** _"We give players what the house never wants them to have."_

---

## 2. Problem Statement

Sweepstakes casino players face a fragmented, opaque, and time-consuming experience:

- **No cross-platform visibility** — A player active on 10 platforms has no unified view of their portfolio value, P&L, or performance.
- **Manual, repetitive grind** — Daily bonus claims, login routines, and coin collection on 10+ platforms waste hours per week.
- **Zero reliable RTP data** — Platforms advertise theoretical RTPs but players have no tool to track their personal, empirical RTP.
- **Redemption black box** — Platforms claim "5-7 business days" but no aggregated, community-sourced data exists on actual processing times.
- **Terms & conditions opacity** — Policy changes are buried in fine print with no notification system.
- **No trust framework** — Players have no objective, data-backed way to evaluate platform trustworthiness.
- **Tax chaos** — Players accumulate thousands in prize redemptions with no organized tax tracking.

---

## 3. Solution Overview

SweepBot is a multi-platform, multi-product ecosystem comprising:

1. **Browser Extension** — Beachhead product; passive session tracking and real-time RTP overlay
2. **Automation Engine** — Desktop app; automated bonus claiming and account management
3. **Analytics & Intelligence Layer** — The Bloomberg Terminal of sweepstakes gambling
4. **Jackpot Intelligence** — Real-time progressive jackpot tracking across all platforms
5. **Game Intelligence Database** — Crowdsourced per-game RTP and volatility profiles
6. **Payment & Redemption Intelligence** — Crowdsourced actual processing time data
7. **Platform TOS Monitor** — Automated diff-tracking of platform terms
8. **SweepBot Trust Index** — Proprietary 0-100 platform trust score
9. **Community Hub** — Forums, strategy, reviews, and tip verification
10. **Responsible Play Suite** — Behavioral safeguards and wellbeing tools
11. **Secure Credential Vault** — AES-256 encrypted, zero-knowledge credential storage
12. **Bonus Calendar & Mail Scraper** — Aggregated bonus schedules and mail integration
13. **Tax Center** — Annual summaries, 1099 reconciliation, accountant-ready exports
14. **Game Provider Analytics** — Meta-layer provider-level RTP and trend data
15. **Geo-Compliance Module** — State/country availability filtering and regulatory alerts

---

## 4. Target Users

### Primary Persona: "The Grinder" (Marcus, 34)

- Plays 8–15 sweepstakes platforms daily
- Treats it as a side income / entertainment-with-upside
- Loses 2–3 hours per day on manual bonus collection
- Frustrated by not knowing if he's up or down across platforms
- Heavily influenced by Reddit communities (r/sweepstakescasino)

### Secondary Persona: "The Optimizer" (Sandra, 47)

- Plays 3–5 platforms, focused on high-value promotions
- Obsessive about redemption tracking and maximizing SC value
- Will pay for tools that save her money or protect her earnings
- Uses spreadsheets currently — wants an upgrade

### Tertiary Persona: "The Skeptic" (Dave, 29)

- Casual player, suspicious of platform fairness
- Wants data to validate whether games are actually fair
- Most likely to share Trust Index citations publicly (free marketing)

---

## 5. Product Pillars & Feature Requirements

### 5.1 Browser Extension (MVP — Phase 1)

**Goal:** Zero-friction entry point; primary user acquisition channel.

| Feature                    | Priority | Description                                               |
| -------------------------- | -------- | --------------------------------------------------------- |
| Session auto-detection     | P0       | Detect active sweepstakes casino tab and begin tracking   |
| Real-time RTP overlay      | P0       | HUD showing current session RTP, total wagered, total won |
| Transaction capture        | P0       | Intercept XHR/fetch calls to capture spin/bet data        |
| Platform fingerprinting    | P0       | Auto-identify 40+ platforms from URL/DOM patterns         |
| Session summaries          | P0       | End-of-session report with key stats                      |
| Multi-platform aggregation | P1       | Unified stats across all tracked platforms                |
| Affiliate link injection   | P1       | Non-intrusive affiliate link for new platform signups     |
| Jackpot monitoring         | P1       | Track and display progressive jackpot values              |
| Game detection             | P1       | Identify current game being played                        |
| Free tier gating           | P2       | Limit to 2 platforms on free tier                         |
| Sync with web dashboard    | P2       | Push data to SweepBot account for full analytics          |

**Technical Constraints:**

- Must pass Chrome Web Store review (no obfuscated code, clear privacy policy)
- Must work with Manifest V3 (MV3) — no MV2 workarounds
- Must not break existing page functionality
- Data collection must be disclosed in privacy policy and extension permissions

### 5.2 Web Dashboard (MVP — Phase 1)

| Feature                             | Priority | Description                                                          |
| ----------------------------------- | -------- | -------------------------------------------------------------------- |
| Command Center / Portfolio Overview | P0       | Total portfolio value, net P&L, active platforms                     |
| Platform management                 | P0       | Add/remove/configure tracked platforms                               |
| Session history                     | P0       | All historical sessions with filtering                               |
| Personal RTP analytics              | P0       | Per-game, per-platform, cross-platform RTP with confidence intervals |
| Subscription management             | P0       | Stripe integration for tier upgrades                                 |
| User auth (Supabase)                | P0       | Email + OAuth login                                                  |
| Redemption tracker                  | P1       | Log and track all prize redemptions                                  |
| Wagering progress                   | P1       | Visual progress bar toward wagering requirement completion           |
| Jackpot leaderboard                 | P1       | Top jackpots across platforms sorted by value/growth rate            |
| Trust Index directory               | P1       | Searchable platform directory with Trust Index scores                |
| Bonus calendar                      | P2       | Upcoming platform promotions and bonuses                             |
| Tax center                          | P2       | Redemption summary, estimated tax liability                          |
| Community feed                      | P3       | Activity feed from community hub                                     |

### 5.3 Automation Engine — Desktop App (Phase 2)

| Feature                  | Priority | Description                                                      |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| Secure credential vault  | P0       | AES-256 local storage, master password, biometric unlock         |
| Manual-trigger bonus run | P0       | User-initiated automation for configured platforms               |
| Per-platform scripts     | P0       | Community-maintained Playwright automation scripts               |
| Run log / audit trail    | P0       | Every action logged with timestamp and outcome                   |
| Human-like interaction   | P0       | Random delays, mouse movement simulation, typing speed variation |
| Scheduled automation     | P1       | Smart scheduling based on platform bonus reset times             |
| Failure detection        | P1       | CAPTCHA detection, IP block detection, auto-pause                |
| Mail bonus scraper       | P2       | Gmail/Outlook integration to detect and claim mail bonuses       |
| Headless mode            | P2       | Background operation without visible browser window              |

### 5.4 Analytics & Intelligence Layer (Phase 1-2)

| Feature                         | Priority | Description                                           |
| ------------------------------- | -------- | ----------------------------------------------------- |
| Personal RTP tracking           | P0       | Every spin/bet tracked, personal RTP computed with CI |
| Bonus feature analytics         | P0       | Trigger frequency, average payout, RTP contribution   |
| Session pattern analysis        | P1       | RTP by time of day, day of week, platform load        |
| Platform performance comparison | P1       | Head-to-head platform RTP, volatility, session length |
| Predictive balance modeling     | P2       | ML-based "expected value" projections                 |
| Temporal trend analysis         | P2       | 12-month rolling RTP trends                           |

### 5.5 Data Intelligence Products (Phase 2-3)

These features are data moat builders — each creates proprietary datasets that can't be replicated:

- **Jackpot Intelligence:** Real-time + historical progressive jackpot data (every platform, every game)
- **Game Database:** Crowdsourced RTP, volatility, bonus trigger rates per game
- **Redemption Intelligence:** Actual processing times by platform, method, amount
- **TOS Monitor:** Full change history for every major platform's terms
- **Trust Index:** Weighted composite score per platform, updated weekly
- **Provider Analytics:** Meta-level aggregation by game studio

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Web dashboard: First Contentful Paint < 1.5s
- Browser extension: < 2ms overhead per tracked transaction
- API: 95th percentile response time < 200ms
- Real-time data updates: < 500ms latency via WebSocket

### 6.2 Security

- AES-256-GCM encryption for all credential storage (local only, never transmitted)
- Zero-knowledge vault design — no server-side plaintext credential access possible
- JWT auth with 15-minute access tokens, 7-day refresh tokens
- HTTPS-only, HSTS headers
- Rate limiting on all API endpoints
- Input sanitization and parameterized queries on all DB operations
- SOC 2 Type II compliance target (Year 2)

### 6.3 Privacy

- GDPR and CCPA compliant from day one
- Data minimization principle — collect only what's necessary
- Right to deletion: full account + data purge within 24 hours
- No selling of individual user data
- Aggregate anonymized data MAY be used for Trust Index and Game Database

### 6.4 Reliability

- 99.9% uptime SLA for API and dashboard (targeting 99.95%)
- Graceful degradation: extension works offline in read-only mode
- Automated daily database backups with 30-day retention
- Health check endpoints for all services

### 6.5 Scalability

- Architecture supports horizontal scaling from Day 1
- Target: 100K MAU by end of Year 2
- Database partitioning strategy designed for 1B+ session records

---

## 7. Monetization Requirements

### 7.1 Subscription Tiers

| Tier     | Monthly       | Annual | Users        |
| -------- | ------------- | ------ | ------------ |
| Free     | $0            | $0     | 1            |
| Starter  | $14.99        | $119   | 1            |
| Pro      | $29.99        | $239   | 3            |
| Analyst  | $39.99        | $319   | 3            |
| Elite    | $59.99        | $399   | 6            |
| Lifetime | $499 one-time | —      | 1 (Pro tier) |

**Key Requirement:** Feature gating must be enforced server-side, not client-side only.

### 7.2 Affiliate System

- Unique tracking links per user (referral program)
- Platform affiliate links active for ALL tiers including Free
- Estimated $25–100 commission per referred signup per platform
- Affiliate dashboard showing clicks, signups, and estimated earnings

### 7.3 Platform Certification

- Platforms can apply for "SweepBot Certified" badge
- Badge awarded based on Trust Index score exceeding threshold
- Annual certification fee: $10K–$50K depending on platform size
- Independent Trust Index score cannot be purchased — only certification of it

---

## 8. Legal & Compliance Requirements

- **Not a gambling tool.** SweepBot is explicitly a transparency, automation-of-personal-tasks, and analytics tool. No betting advice, no outcome prediction, no suggestions to gamble more.
- **COPPA compliance:** No users under 18. Age gate at onboarding.
- **Sweepstakes vs. gambling distinction:** Our platform only supports legal sweepstakes casinos operating in the US under sweepstakes law. No real-money gambling sites.
- **Automation disclosures:** Users must confirm they are using automation tools on their own accounts in jurisdictions where permitted.
- **Platform TOS monitoring:** We monitor for terms that prohibit automation tools and alert users.
- **Responsible Play:** Required by brand guidelines; loss limits, time limits, and cool-down features are first-class requirements.
- **Data privacy attorney review required** before launch.
- **Gaming attorney review required** before launch.

---

## 9. Success Metrics (Year 1)

| Metric               | Target   |
| -------------------- | -------- |
| Extension installs   | 25,000   |
| Registered users     | 15,000   |
| Paid subscribers     | 2,000    |
| MRR (Month 12)       | $60,000  |
| ARR (run rate)       | $720,000 |
| Affiliate revenue    | $500K    |
| Net Promoter Score   | > 50     |
| Churn rate (monthly) | < 5%     |
| Platforms tracked    | 40+      |
| Games in database    | 5,000+   |

---

## 10. Out of Scope (v1.0)

- Native mobile app (iOS/Android) — Phase 3
- Live dealer game tracking — post-MVP
- Real-money casino support — never (legal constraint)
- International markets (non-US) — Phase 3
- B2B data API — Phase 2
- White-label solution — Phase 3

---

## 11. Dependencies & Risks

| Risk                         | Likelihood | Impact | Mitigation                                                             |
| ---------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Platform blocking automation | High       | High   | Frame as engagement tool; build extension-first; platform partnerships |
| Chrome Web Store rejection   | Medium     | High   | Legal review; clear privacy policy; no obfuscated code                 |
| Platform TOS changes         | High       | Medium | TOS monitor as core feature; rapid script update pipeline              |
| Data accuracy issues         | Medium     | High   | Confidence intervals; data validation; user corrections                |
| Competitor launches          | Low        | Medium | Time-locked data moat; community network effects                       |
| Legal challenge by platform  | Low        | High   | Gaming attorney; responsible play; transparency positioning            |

---

_Document maintained by APPYness. For questions, contact: vincekinney1991@gmail.com_
