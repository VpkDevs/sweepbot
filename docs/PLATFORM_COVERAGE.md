# SweepBot — Platform Coverage Registry

_Single source of truth for platform support status._
_Update this file whenever a platform's support status changes._
_Last updated: 2026-03-05_

---

## Status Key

| Symbol | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| ✅     | Fully supported — extension detects, tracks sessions, captures transactions     |
| 🟡     | Partial — extension detects but transaction capture is unreliable or incomplete |
| 🔲     | Planned — listed in database, extension support not yet implemented             |
| ❌     | Not supported — out of scope or platform blocked extension                      |
| 🔗     | Affiliate enrolled — tracking link active and tested                            |

---

## Currently Supported Platforms (Extension)

> As of 2026-03-05: The following list reflects what is in `apps/extension/src/lib/platforms.ts`.
> Verify against that file as it is the authoritative source for extension support.

| Platform           | Slug                 | Extension | Affiliate | DB Seeded | Notes                             |
| ------------------ | -------------------- | --------- | --------- | --------- | --------------------------------- |
| Chumba Casino      | `chumba-casino`      | 🟡        | ❌        | ✅        | Major target; detection confirmed |
| LuckyLand Slots    | `luckylandslots`     | 🟡        | ❌        | ✅        | VGW Group (same parent as Chumba) |
| Stake.us           | `stake-us`           | 🟡        | ❌        | ✅        | High-value platform               |
| Pulsz              | `pulsz`              | 🟡        | ❌        | ✅        | Growing rapidly                   |
| WOW Vegas          | `wow-vegas`          | 🔲        | ❌        | ✅        |                                   |
| Fortune Coins      | `fortune-coins`      | 🔲        | ❌        | ✅        |                                   |
| Funrize            | `funrize`            | 🔲        | ❌        | ✅        |                                   |
| Zula Casino        | `zula-casino`        | 🔲        | ❌        | ✅        |                                   |
| Crown Coins Casino | `crown-coins-casino` | 🔲        | ❌        | ✅        |                                   |
| McLuck             | `mcluck`             | 🔲        | ❌        | ✅        |                                   |
| NoLimitCoins       | `nolimitcoins`       | 🔲        | ❌        | ✅        |                                   |
| Modo Casino        | `modo-casino`        | 🔲        | ❌        | ✅        |                                   |
| Sweeptastic        | `sweeptastic`        | 🔲        | ❌        | ✅        |                                   |
| Global Poker       | `global-poker`       | 🔲        | ❌        | ✅        | Poker; different audience         |
| BetRivers.net      | `betrivers-net`      | 🔲        | ❌        | ✅        | Rush Street Gaming                |
| High 5 Casino      | `high5casino`        | 🔲        | ❌        | ✅        |                                   |
| Jackpota           | `jackpota`           | 🔲        | ❌        | ✅        |                                   |
| Spree Casino       | `spree-casino`       | 🔲        | ❌        | ✅        |                                   |
| Sportzino          | `sportzino`          | 🔲        | ❌        | ✅        | Sports-focused                    |

---

## Platform Launch Priority

For Phase 1 Chrome Web Store submission, we need **at minimum 3 fully working platforms**.
Target the following as the first three to bring to ✅:

1. **Chumba Casino** — Largest user base, most community familiarity
2. **LuckyLand Slots** — Same parent company as Chumba, likely similar API structure
3. **Stake.us** — Highest affiliate commission; strong presence in target community

---

## Platform Detail Cards

### Chumba Casino

- **URL:** https://www.chumbacasino.com
- **Parent company:** VGW Group
- **Founded:** 2012
- **Monthly active users (estimate):** 2M+ (largest sweepstakes platform in the US)
- **Primary games:** Slots, table games
- **Bonus structure:** Daily login bonus, purchase offers
- **Redemption methods:** PayPal, check, bank transfer
- **Typical redemption time (community-reported):** 3–10 business days
- **Notable:** High redemption rejection rate reported in community; Trust Index impact is high
- **Extension challenge:** Heavy SPA; game data likely in WebSocket or encrypted XHR
- **Affiliate:** TBD — check VGW affiliate portal

---

### LuckyLand Slots

- **URL:** https://www.luckylandslots.com
- **Parent company:** VGW Group (same as Chumba)
- **Primary games:** Slots
- **Notes:** May share API structure with Chumba; test together

---

### Stake.us

- **URL:** https://stake.us
- **Parent company:** Stake.com (separate brand for US market)
- **Primary games:** Slots, sports, casino
- **Bonus structure:** Daily rakeback, weekly boost, monthly bonus
- **Affiliate:** stake.us/affiliate — formal program confirmed
- **Notable:** Most active community on Reddit; strong crypto-adjacent user base
- **Extension challenge:** Aggressive anti-automation detection on some features; proceed carefully

---

### Pulsz

- **URL:** https://www.pulsz.com
- **Founded:** 2020
- **Notes:** Rapidly growing; active community; frequent promotions

---

## Platforms Evaluated But Excluded

| Platform                | Reason Excluded                           |
| ----------------------- | ----------------------------------------- |
| DraftKings (real money) | Real-money gambling — outside legal scope |
| FanDuel (real money)    | Real-money gambling — outside legal scope |
| Chumba Casino (AU/UK)   | Non-US markets — Phase 3                  |

---

## How to Add a New Platform

### 1. Database

Add a row to `platforms` via migration or admin:

```sql
INSERT INTO platforms (slug, name, display_name, url, affiliate_url, status)
VALUES ('new-platform', 'New Platform', 'New Platform', 'https://newplatform.com', NULL, 'active');
```

### 2. Extension Detection

In `apps/extension/src/lib/platforms.ts`, add an entry to the platform config:

```typescript
{
  slug: 'new-platform',
  name: 'New Platform',
  displayName: 'New Platform',
  domains: ['newplatform.com', 'www.newplatform.com'],
  // XHR intercept patterns:
  apiPatterns: ['/api/game/', '/casino/spin'],
  // DOM indicators to confirm game is active:
  gameIndicators: ['.game-canvas', '#slot-container'],
}
```

### 3. Test

- [ ] Navigate to the platform's game page with extension loaded
- [ ] Confirm extension shows "active" state for this platform
- [ ] Confirm transaction capture works (check extension popup or API logs)
- [ ] No JS errors on the casino page

### 4. Update This File

- Add platform to the table above
- Set initial status
- Add a platform detail card if it's a Tier A or B target

### 5. Update AGENTS.md

If the total supported platform count changes significantly, reflect it in the AGENTS.md "What's Built" section.

---

## Platform Research Sources

When researching a new platform's API structure for extension development:

- Browser DevTools → Network tab while playing a game
- Look for XHR/Fetch calls during gameplay (the spin response will contain bet amount and win amount)
- Check if WebSocket is used instead (more complex to intercept)
- Community sources: r/sweepstakescasino, individual platform subreddits

---

_This document should be reviewed before every platform expansion decision and extension release._
_Owner: Vincent Kinney / APPYness_
