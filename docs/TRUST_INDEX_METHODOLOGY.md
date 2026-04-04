# SweepBot Trust Index — Scoring Methodology

**Version:** 1.0
**Date:** 2026-03-05
**Status:** Defined — Not Yet Live (requires minimum data thresholds)

---

## Purpose

The SweepBot Trust Index produces a **0–100 composite score** for each sweepstakes casino platform. It answers the question: _"How reliable and transparent is this platform with my time and sweepstakes balance?"_

The score is:

- **Data-driven** — derived from real user-reported and system-collected data, not editorial opinion
- **Transparent** — methodology is published so users, platforms, and press can evaluate its validity
- **Bounded** — no score can be purchased; platforms can only achieve certification if their score clears a threshold
- **Versioned** — the methodology has a version number; major changes reset historical comparisons

---

## Score Components

The Trust Index is a weighted average of 7 component scores, each also rated 0–100:

| Component              | Weight | Data Source                                                 |
| ---------------------- | ------ | ----------------------------------------------------------- |
| Redemption Speed       | 25%    | User-reported redemption logs                               |
| Rejection Rate         | 20%    | User-reported redemption outcomes                           |
| TOS Stability          | 15%    | Automated daily TOS monitoring (diffs)                      |
| Community Satisfaction | 15%    | User reviews + ratings                                      |
| Support Responsiveness | 10%    | User-reported support ticket resolution                     |
| Regulatory Standing    | 10%    | Manual research; licensing status, compliance actions       |
| Bonus Generosity       | 5%     | User-reported bonus value relative to wagering requirements |

### Why These Weights

- **Redemption Speed (25%)** is the single most important factor to the target user. Delayed payouts are the #1 source of player frustration and distrust. The most common complaint in r/sweepstakescasino is "I've been waiting X weeks."
- **Rejection Rate (20%)** is equally trust-critical. A platform that frequently rejects payouts without clear cause is predatory behavior, not an operational issue.
- **TOS Stability (15%)** protects users from retroactive rule changes that invalidate winnings. Frequent, unexplained TOS changes are a red flag.
- **Community Satisfaction (15%)** provides aggregate sentiment that doesn't fit neatly into other metrics.
- **Support Responsiveness (10%)** is important but secondary — most users don't need support until something goes wrong.
- **Regulatory Standing (10%)** establishes baseline legitimacy but doesn't vary much between established platforms.
- **Bonus Generosity (5%)** is weighted lowest — it's a nice-to-have that doesn't reflect trustworthiness.

---

## Component Scoring Details

### 1. Redemption Speed Score (0–100)

**Data:** `redemptions` table — `requested_at` and `received_at` columns compute `processing_days`.

**Formula:**

```
avg_processing_days = AVG(processing_days) for this platform (last 6 months, completed redemptions)

score = clamp(100 - (avg_processing_days - 2) * 8, 0, 100)
```

**Mapping:**
| Processing Time | Score |
|----------------|-------|
| ≤ 2 days | 100 |
| 3 days | 92 |
| 5 days | 76 |
| 7 days | 60 |
| 10 days | 36 |
| ≥ 14 days | 0 |

**Minimum data requirement:** 20 completed redemption records from ≥ 10 distinct users.

---

### 2. Rejection Rate Score (0–100)

**Data:** `redemptions` table — ratio of `status = 'rejected'` to total completed decisions.

**Formula:**

```
rejection_rate = COUNT(status='rejected') / COUNT(status IN ('received','rejected'))

score = clamp(100 - (rejection_rate * 400), 0, 100)
```

**Mapping:**
| Rejection Rate | Score |
|---------------|-------|
| 0% | 100 |
| 5% | 80 |
| 10% | 60 |
| 15% | 40 |
| 25% | 0 |

**Minimum data requirement:** 30 completed decisions (received or rejected).

---

### 3. TOS Stability Score (0–100)

**Data:** `tos_snapshots` table — count of `changes_detected = true` in trailing 12 months.

**Formula:**

```
changes_12mo = COUNT(*) WHERE changes_detected = true AND captured_at > NOW() - INTERVAL '12 months'

score = clamp(100 - (changes_12mo * 12), 0, 100)
```

**Mapping:**
| Changes in 12 Months | Score |
|---------------------|-------|
| 0 | 100 |
| 1 | 88 |
| 3 | 64 |
| 5 | 40 |
| ≥ 8 | 0 |

**Note:** "Changes detected" means a material diff in the TOS page content. Minor cosmetic edits (whitespace, formatting) are filtered out by the TOS monitor. Major changes (removal of provisions, new limitations on redemptions) are weighted more heavily.

_Future improvement: use AI-generated `change_summary` to classify severity of change (minor/moderate/major) and weight accordingly._

**Minimum data requirement:** 90+ days of daily TOS snapshots.

---

### 4. Community Satisfaction Score (0–100)

**Data:** User ratings submitted through the platform directory (1–5 stars, with optional comment).

**Formula:**

```
weighted_avg = SUM(rating * recency_weight) / SUM(recency_weight)

where recency_weight = 1 / (1 + days_since_rating / 180)

score = ((weighted_avg - 1) / 4) * 100
```

**Mapping:**
| Weighted Average Rating | Score |
|------------------------|-------|
| 5.0 | 100 |
| 4.5 | 87.5 |
| 4.0 | 75 |
| 3.5 | 62.5 |
| 3.0 | 50 |
| 2.0 | 25 |
| 1.0 | 0 |

**Minimum data requirement:** 15 distinct user ratings.

---

### 5. Support Responsiveness Score (0–100)

**Data:** User-reported support ticket resolution time (self-reported via redemption notes and platform reviews).

This component is **manual / semi-automated** until sufficient crowdsourced data exists.

_Interim approach (Phase 1–2):_ Use web research (Trustpilot, Reddit, BBB) to produce an initial score (0–100) via editorial assessment. Flag as `data_source: 'editorial'` in the score breakdown.

_Target approach (Phase 3+):_ Community-reported support ticket times via structured form in platform reviews.

---

### 6. Regulatory Standing Score (0–100)

**Data:** Manual research — updated quarterly.

Scoring rubric:
| Status | Score |
|--------|-------|
| Licensed by recognized jurisdiction (Malta, UK, Gibraltar, etc.) | 90–100 |
| Operating under US sweepstakes law with legal review | 70–90 |
| No formal licensing but clean operating history (3+ years) | 50–70 |
| New platform (<2 years), no history | 40–60 |
| Regulatory actions in history, resolved | 20–40 |
| Active regulatory actions or complaints | 0–20 |
| Shut down or suspended | 0 |

---

### 7. Bonus Generosity Score (0–100)

**Data:** User-reported wagering requirement ratios and bonus tracking.

**Formula:**

```
avg_wr_multiplier = AVG(wagering_requirement / bonus_amount) for this platform

score = clamp(100 - (avg_wr_multiplier - 1) * 10, 0, 100)
```

**Minimum data requirement:** 10 data points.
_This component may be suppressed if data is insufficient, with weight redistributed to other components._

---

## Composite Score Calculation

```typescript
function computeTrustIndex(components: ComponentScores): number {
  const weights = {
    redemptionSpeed: 0.25,
    rejectionRate: 0.2,
    tosStability: 0.15,
    communitySatisfaction: 0.15,
    supportResponsiveness: 0.1,
    regulatoryStanding: 0.1,
    bonusGenerosity: 0.05,
  }

  // If a component doesn't meet minimum data requirements,
  // redistribute its weight proportionally to the components that do.
  let totalWeight = 0
  let weightedSum = 0

  for (const [key, weight] of Object.entries(weights)) {
    if (components[key] !== null) {
      weightedSum += components[key] * weight
      totalWeight += weight
    }
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null
}
```

---

## Score Tiers (Labels)

| Score Range | Tier Label | Badge Color |
| ----------- | ---------- | ----------- |
| 85–100      | Excellent  | Green       |
| 70–84       | Good       | Blue        |
| 55–69       | Fair       | Yellow      |
| 40–54       | Concerning | Orange      |
| 0–39        | Poor       | Red         |
| No data     | Not Rated  | Gray        |

---

## Update Cadence

| Component              | Recalculation Trigger                          |
| ---------------------- | ---------------------------------------------- |
| Redemption Speed       | New redemption marked `received` or `rejected` |
| Rejection Rate         | New redemption marked `received` or `rejected` |
| TOS Stability          | Daily (next morning after TOS monitor run)     |
| Community Satisfaction | New user rating submitted                      |
| Support Responsiveness | Quarterly (manual update)                      |
| Regulatory Standing    | Quarterly (manual update)                      |
| Bonus Generosity       | New wagering requirement data submitted        |
| **Composite score**    | Any component update → recompute same day      |

Scores are stored as a snapshot in `trust_index_scores` with a timestamp. Historical scores are retained indefinitely — this is the Trust Index time series.

---

## Minimum Data Requirements for Publication

A Trust Index score is **not published** until the platform meets all of the following:

- ≥ 20 completed redemptions from ≥ 10 distinct users
- ≥ 90 days of TOS monitoring data
- ≥ 15 community ratings

Until these thresholds are met, the platform displays "Trust Index: Insufficient Data" with context about how to contribute.

---

## Certification Program

Platforms may apply for **SweepBot Certified** status if:

1. Trust Index score ≥ 75
2. Minimum data requirements met across all components
3. No active regulatory actions

Certification is:

- **Annual** — re-evaluated each year
- **Independent** — certification cannot be purchased; only the badge for a passing score can be purchased
- **Revocable** — if Trust Index drops below 65, certification is suspended until score recovers

Platform certification tiers and fees:
| Platform Size | Annual Fee |
|--------------|-----------|
| Small (<50K MAU) | $10,000 |
| Medium (50K–500K MAU) | $25,000 |
| Large (>500K MAU) | $50,000 |

---

## Methodology Version History

| Version | Date       | Changes         |
| ------- | ---------- | --------------- |
| 1.0     | 2026-03-05 | Initial release |

_When methodology changes materially (weight changes, new components, formula changes), increment version number and note historical scores computed under prior versions._

---

_This methodology document should be publicly accessible at `https://sweepbot.app/trust-index/methodology`._
_Owner: Vincent Kinney / APPYness_
