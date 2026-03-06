# SweepBot — Affiliate Playbook

*Operational reference for the SweepBot affiliate revenue program.*
*This is internal documentation. Keep platform-specific commission rates and contacts confidential.*

---

## Overview

Affiliate revenue is the **dominant near-term revenue stream** for SweepBot. Even free-tier users who never pay a subscription generate revenue via referral commissions when they sign up for new sweepstakes platforms through SweepBot.

**The model:** SweepBot tracks which platforms a user isn't yet on → inserts a referral link when the user visits that platform's signup page → when the user registers, the platform pays SweepBot a bounty → SweepBot shares 70–80% of the bounty back to the referring user.

**Revenue target (Year 1):**
- Conservative: $225K (5,000 affiliate signups × $60 avg × 75%)
- Moderate: $422K (7,500 signups × $75 avg × 75%)
- Optimistic: $600K (10,000 signups × $80 avg × 75%)

---

## Program Enrollment Checklist

For each platform, enrollment requires:

- [ ] Create an affiliate/partner account on the platform's affiliate portal
- [ ] Agree to affiliate terms of service
- [ ] Obtain tracking link(s) and/or API credentials
- [ ] Confirm payout schedule and minimum payout threshold
- [ ] Confirm commission structure (flat bounty vs. revenue share vs. hybrid)
- [ ] Store affiliate credentials securely (not in this repo — use password manager)
- [ ] Add tracking URL pattern to the extension's `affiliate.ts` config
- [ ] Test click tracking and conversion attribution in staging
- [ ] Mark platform as `affiliate_active: true` in the platforms table

---

## Platform Affiliate Programs

### Tier A — Primary Targets (Highest commission, highest volume)

#### Chumba Casino
- **URL:** chumbacasino.com
- **Affiliate portal:** Search "Chumba Casino affiliate program" — they run internally or via a network
- **Commission:** $25–$75 per qualified signup (reported by community)
- **Qualified signup:** User creates account + first purchase (Gold Coin package)
- **Payout:** Monthly, ~Net-30
- **Notes:** One of the most established platforms; high conversion rate due to brand recognition
- **Status:** ⬜ Not yet enrolled

#### Stake.us
- **URL:** stake.us
- **Affiliate portal:** stake.us/affiliate
- **Commission:** $75–$150+ per qualified signup (high-value platform)
- **Revenue share:** Some accounts may negotiate % of NGR
- **Notes:** Premium commission; requires approval; professional application recommended
- **Status:** ⬜ Not yet enrolled

#### LuckyLand Slots
- **URL:** luckylandslots.com
- **Commission:** $25–$60 per qualified signup
- **Notes:** VGW Group platform (same parent as Chumba); may be managed through same affiliate contact
- **Status:** ⬜ Not yet enrolled

#### Global Poker
- **URL:** globalpoker.com
- **Commission:** $75–$150 (poker platform, higher-value player)
- **Notes:** VGW Group platform; poker demographic slightly different from slots players
- **Status:** ⬜ Not yet enrolled

#### Pulsz
- **URL:** pulsz.com
- **Commission:** $30–$75
- **Notes:** Growing rapidly; active community presence on Reddit (r/sweepstakescasino)
- **Status:** ⬜ Not yet enrolled

---

### Tier B — Secondary Targets (Good volume, standard commission)

#### WOW Vegas
- **URL:** wowvegas.com
- **Commission:** $25–$50
- **Status:** ⬜ Not yet enrolled

#### Fortune Coins
- **URL:** fortunecoins.com
- **Commission:** $25–$50
- **Status:** ⬜ Not yet enrolled

#### Funrize
- **URL:** funrize.com
- **Commission:** $20–$40
- **Status:** ⬜ Not yet enrolled

#### Zula Casino
- **URL:** zulacasino.com
- **Commission:** $25–$50
- **Status:** ⬜ Not yet enrolled

#### Crown Coins Casino
- **URL:** crowncoins.com
- **Commission:** $20–$40
- **Status:** ⬜ Not yet enrolled

#### McLuck
- **URL:** mcluck.com
- **Commission:** $25–$50
- **Status:** ⬜ Not yet enrolled

#### NoLimitCoins
- **URL:** nolimitcoins.com
- **Commission:** $20–$40
- **Status:** ⬜ Not yet enrolled

#### Modo Casino
- **URL:** modo.us
- **Commission:** $20–$40
- **Status:** ⬜ Not yet enrolled

---

### Tier C — Lower Priority, Still Worth Pursuing

#### Sweeptastic
- **URL:** sweeptastic.com
- **Status:** ⬜ Not yet enrolled

#### BetRivers.net
- **URL:** betrivers.net
- **Notes:** Rush Street Gaming brand; may have formal partner program
- **Status:** ⬜ Not yet enrolled

#### High 5 Casino
- **URL:** high5casino.com
- **Status:** ⬜ Not yet enrolled

#### Jackpota
- **URL:** jackpota.com
- **Status:** ⬜ Not yet enrolled

#### Spree Casino
- **URL:** spreecasino.com
- **Status:** ⬜ Not yet enrolled

#### Sportzino
- **URL:** sportzino.com
- **Notes:** Sports-focused sweepstakes; different audience than slots players
- **Status:** ⬜ Not yet enrolled

---

## How Affiliate Tracking Works (Technical)

### 1. Extension Detects Eligible Page
`apps/extension/src/lib/affiliate.ts` monitors for navigation to:
- Platform signup/registration pages
- Platform homepage (first visit)

### 2. Link Injection
When an eligible page is detected:
1. Extension checks user's tracked platforms to see if they already have an account on this platform
2. If no account detected → inject SweepBot affiliate link banner
3. Banner is clearly labeled as a SweepBot referral (per ToS and FTC guidelines)
4. User clicks → navigates to platform with `?ref=SWEEPBOT_CODE` or similar parameter

### 3. Attribution
- Platform's system records the referral attribution
- When user completes qualifying action (registration, first deposit/purchase), platform fires a postback or webhook
- SweepBot credits the referring SweepBot user

### 4. API Endpoints
- `POST /api/affiliate/click` — record that a referral link was clicked
- `POST /api/affiliate/signup` — record that a signup was completed (called from extension when signup page completion is detected, OR from platform postback)
- `GET /api/affiliate/earnings` — user's commission summary

---

## Commission Sharing — User Payout Structure

SweepBot retains **20–30% of the commission** as a platform fee.
The referring SweepBot user receives **70–80%.**

| Platform Commission | SweepBot Retains (25%) | User Receives (75%) |
|--------------------|-----------------------|---------------------|
| $25 | $6.25 | $18.75 |
| $50 | $12.50 | $37.50 |
| $75 | $18.75 | $56.25 |
| $100 | $25.00 | $75.00 |
| $150 | $37.50 | $112.50 |

*Exact split is configurable per platform agreement. These are targets.*

Payouts to users:
- Minimum payout: $25 accumulated earnings
- Payout schedule: Monthly (15th of following month)
- Payout methods: PayPal initially; add more over time

---

## FTC Compliance

All affiliate links and referral banners must:
- Be clearly labeled: e.g., "Sponsored by SweepBot • Referral link"
- Not be deceptive about the nature of the referral relationship
- Link to SweepBot's affiliate disclosure in the Privacy Policy

This is enforced in UI copy. Never hide that a link is a referral.

---

## Revenue Share Agreements (Advanced)

Some platforms offer **revenue share** instead of or in addition to flat CPA (cost-per-acquisition):
- Typical rate: 5–15% of the platform's net gaming revenue (NGR) from referred players
- This is longer-term and higher-value but requires ongoing player activity
- Target platforms for rev-share negotiation: Stake.us, Global Poker, Chumba

Revenue share agreements should be tracked separately in a private spreadsheet (not in this repo).

---

## Tracking Infrastructure

**Production tracking links format:**
```
https://sweepbot.app/go/[platform-slug]?ref=[user_ref_code]
```
This URL:
1. Records the click server-side
2. Redirects the user to the platform with our affiliate code appended
3. Allows us to track click → signup conversion funnel

**Postback/webhook URL** (to give to platforms):
```
https://api.sweepbot.app/webhooks/affiliate/[platform-slug]
```
Platforms fire this URL when a qualifying conversion occurs.

---

## Quarterly Check-In Process

For each enrolled platform, check quarterly:
- [ ] Commission rates unchanged?
- [ ] Payout received on schedule?
- [ ] Attribution is tracking correctly (compare platform dashboard vs. SweepBot records)?
- [ ] Any new promotional offers or rate increases available?
- [ ] Platform still operating and in good standing?

If a platform's Trust Index score drops below 40, consider suspending its affiliate program and notifying users.

---

## Notes for AI Agents

- Affiliate commission amounts in this document are **community-reported estimates**, not confirmed contract rates. Treat them as targets and reference points until we have signed agreements.
- Do not hardcode commission rates into application logic — they should be stored in the database and configurable per platform.
- The `platforms.affiliate_url` column in the database stores the affiliate-tagged signup URL per platform. This should be populated when enrollment is complete.
- The affiliate dashboard for users is at `/affiliate` in the web app (not yet built as of Phase 1).
