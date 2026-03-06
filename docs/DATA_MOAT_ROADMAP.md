# SweepBot — Data Moat Roadmap

> *"Every day of early data collection is a permanent competitive advantage."*
> — Technical Architecture Doc

**Version:** 1.0
**Date:** March 2026
**Purpose:** To define exactly what data we are collecting, when it becomes monetizable, and what business outcomes each dataset unlocks.

---

## Why This Document Exists

Having vague intentions to "collect a lot of data" is worthless. This document turns data collection into a **revenue activation plan** with specific thresholds, timelines, and dollar outcomes attached to each dataset.

---

## The Six Datasets & Their Milestones

### 1. Jackpot Time-Series

**What it is:** 60-second resolution snapshots of jackpot values across 20+ platforms.
**Why it's irreplaceable:** Progressive jackpots reset to zero when hit. If we don't capture the value at the moment of hit, that data is gone forever. A competitor starting 6 months later will always be 6 months behind.

| Milestone | Threshold | Business Outcome |
|-----------|-----------|-----------------|
| **M1** | 30 days continuous data, 5+ platforms | "Jackpot Trends" feature (basic) goes live |
| **M2** | 90 days, 15+ platforms | "When to Play" timing intelligence (user feature) |
| **M3** | 180 days, 20+ platforms | Jackpot prediction model (Pro tier gate) |
| **M4** | 365 days | Quarterly Industry Report sells for $299/copy |
| **M5** | 2 years | B2B API data licensing opens at $10K+/platform/yr |

**Current status:** Poller not yet deployed. **Priority: P0 — Start this week.**
**Deploy to:** Replit (always-on, cheap, zero-maintenance)

---

### 2. Crowdsourced Real-World RTP

**What it is:** Actual return-to-player percentages observed across millions of real user spins, broken down by game, platform, and time-of-day.
**Why it's irreplaceable:** Casinos advertise theoretical RTPs. We publish *actual* RTPs from real play data. This is legally and competitively explosive intelligence.

| Milestone | Threshold | Business Outcome |
|-----------|-----------|-----------------|
| **M1** | 500K spins tracked | "Your Personal RTP" dashboard feature |
| **M2** | 5M spins, 10+ games | Per-game RTP profiles published (user-facing) |
| **M3** | 50M spins | Game Intelligence Database (Analyst tier gate, $39.99/mo) |
| **M4** | 500M spins across 5+ platforms | Platform RTP comparison (competitor-proof feature) |
| **M5** | 1B+ spins | RTP data licensing to academic researchers, gambling regulators |

**Current status:** Extension interceptor scaffolded. Needs per-platform parsers.
**Revenue unlock:** M3 alone gates the $39.99/mo Analyst tier.

---

### 3. Redemption Timing & Rejection Data

**What it is:** How long each platform actually takes to pay out, what % of redemptions are rejected, and what reasons they cite.
**Why it's irreplaceable:** Platforms have strong incentive to hide this. Players have strong incentive to know it. Only a neutral third party aggregating real user reports can produce this data.

| Milestone | Threshold | Business Outcome |
|-----------|-----------|-----------------|
| **M1** | 100 redemption reports across 3 platforms | "Redemption Tracker" feature goes live |
| **M2** | 1,000 reports across 10 platforms | Trust Index v1 launches (public SEO page) |
| **M3** | 5,000 reports | Trust Index certifications open to platforms ($10K–50K/yr) |
| **M4** | 25,000 reports | Trust Index becomes THE reference — media citations begin |
| **M5** | 100,000 reports | Platform certification is a $300K+ annual revenue line |

**Current status:** Redemption tracker UI designed. API endpoint stubbed.
**Revenue unlock:** M3 opens B2B certification revenue immediately.

---

### 4. Terms of Service Change History

**What it is:** Daily automated snapshots of every platform's ToS, comparing each version to detect changes and translating them into plain English alerts.
**Why it's irreplaceable:** Platforms change ToS to claw back player advantages. The only way to know this happened is to have been watching. Historical ToS archives are literally impossible to reconstruct after the fact.

| Milestone | Threshold | Business Outcome |
|-----------|-----------|-----------------|
| **M1** | 14 days, 10 platforms | ToS Alert emails go live (free tier engagement) |
| **M2** | 90 days, 30 platforms | "ToS Stability Score" component of Trust Index |
| **M3** | 1 year of history | "This platform changed withdraw limits 4 times last year" (media story) |
| **M4** | Regulatory attention | Provide ToS history data to state attorneys general (PR + moat) |

**Current status:** Not yet deployed.
**Deploy alongside:** Jackpot poller on Replit. Same infrastructure, minimal added cost.

---

### 5. Platform Uptime & Performance

**What it is:** Every-5-minute health checks across all supported platforms, tracking login availability, API response times, and known outage windows.
**Why it matters:** Players who are in the middle of an automation run need to know if a platform is down before they hit it.

| Milestone | Threshold | Business Outcome |
|-----------|-----------|-----------------|
| **M1** | 30 days, 10 platforms | "Platform Status" dashboard widget (user feature) |
| **M2** | 90 days | Uptime component of Trust Index |
| **M3** | 6 months | "Platform Reliability Report" (marketing asset) |

**Current status:** Not deployed. Lower priority than Jackpot + ToS, but same Replit instance.

---

### 6. Affiliate Conversion Data

**What it is:** Which affiliate links convert best, what referral paths produce the highest-LTV users, and which platforms have the best bounty programs.
**Why it matters for revenue:** The Monetization Strategy estimates $225K–$600K in Year 1 affiliate revenue. Without conversion data, we're leaving optimization dollars on the table.

| Milestone | Threshold | Business Outcome |
|-----------|-----------|-----------------|
| **M1** | 100 attributed conversions | A/B test link placement in extension popup |
| **M2** | 500 conversions | Optimize link injection heuristic (see Affiliate Injection Logic doc) |
| **M3** | 2,000 conversions | Revenue-share renegotiation with top 3 platforms |

**Current status:** Affiliate link injection scaffolded. Attribution tracking not yet wired.

---

## Deployment Priority Order

This is the order in which to deploy data collection infrastructure, based on data irreversibility (missing a day is a permanent gap) and revenue unlock size.

| Priority | Dataset | Deploy Target | Estimated Setup Time |
|----------|---------|---------------|---------------------|
| **P0** | Jackpot Time-Series | Replit | 1–2 days |
| **P0** | ToS Monitor | Replit (same instance) | 1 day |
| **P1** | Platform Uptime | Replit (same instance) | 0.5 days |
| **P2** | Redemption Tracking | Extension + API | Tied to extension launch |
| **P2** | Crowdsourced RTP | Extension | Tied to extension launch |
| **P3** | Affiliate Conversion | API + Extension | Week 2 post-launch |

**Bottom line:** Deploy the Replit poller before the product launches. Every day without jackpot and ToS data is a day of irreplaceable competitive advantage burned.

---

## Revenue Activation Timeline

| Months from Launch | Data Milestone Hit | Revenue Unlocked |
|--------------------|--------------------|-----------------|
| Month 1 | Trust Index v1 (100 redemptions) | Drives Starter tier conversions |
| Month 3 | RTP Profiles (5M spins) | Analyst tier ($39.99/mo) becomes defensible |
| Month 6 | Jackpot prediction (180 days data) | Pro tier differentiation complete |
| Month 9 | Trust Certification open | First B2B revenue: $10K–50K per platform |
| Month 12 | Industry Report (365 days jackpot data) | $299/report, B2B + media |
| Year 2 | 5,000 redemption reports | Certification is $300K+ annual revenue line |
| Year 3 | 1B+ spins | RTP data licensing opens ($50K–200K/yr enterprise) |

---

*Maintained by APPYness. This document is strategic — treat it as confidential.*
*Last updated March 2026.*
