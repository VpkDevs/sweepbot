# Atlas Skill — Design Spec

_The AI Co-Founder That Never Forgets, Never Sleeps, and Gets Smarter Every Project_

**Date:** 2026-03-18
**Status:** Approved for implementation
**Target location:** `skills/founder-copilot/` (invoked as `/atlas`)

---

## Vision

Atlas is a Claude Code skill family that functions as a **permanent AI co-founder** for serial product builders. It takes complete ownership of the product lifecycle — finishing code, launching products, automating operations, growing revenue, and building an empire of self-running software businesses — across an unlimited number of projects.

This is not a launch checklist tool. It is not a code review bot. It is the operating system for building a software empire: one command that takes over a project completely and doesn't stop until it runs itself, then moves on to the next one.

**The core promise:** You focus on ideas. Atlas handles everything else. Forever.

---

## Tagline

> _One command. Full takeover. From broken code to financial freedom._

---

## Skill File Structure

```
skills/
└── founder-copilot/
    ├── founder-copilot.md          ← THE entry point — /atlas
    ├── onboarding.md               ← 3-pass intelligence engine + interview
    ├── code-sprint.md              ← fixes all technical blockers
    ├── legal-compliance.md         ← ToS, privacy policy, compliance
    ├── launch-strategy.md          ← researches + writes complete launch guide
    ├── marketing-playbook.md       ← social accounts, content, SEO, community
    ├── business-setup.md           ← entity, banking, accounting, taxes
    ├── automation-handoff.md       ← runs-itself roadmap + automation stack
    ├── operations.md               ← metrics, weekly review, growth signals
    └── portfolio.md                ← empire intelligence layer
```

Single invocation: `/atlas`
Atlas detects context and selects the appropriate operating mode automatically.

---

## Persistent State Layer

Atlas maintains a permanent state directory that survives across all sessions and all projects. This is what transforms Atlas from a per-session tool into a compounding co-founder relationship.

```
~/.atlas/
├── memory.md                       ← accumulated cross-project learnings
├── founder-profile.json            ← who you are as a founder (evolves over time)
├── portfolio/
│   ├── index.md                    ← master registry of all projects
│   └── [project-slug]/
│       ├── context.json            ← business context snapshot
│       ├── decisions.md            ← log of every major decision made
│       ├── metrics.md              ← historical metrics over time
│       └── milestones.md           ← milestone log for brand content
├── patterns/
│   ├── launch.md                   ← what launch strategies worked for this founder
│   ├── tech-stack.md               ← this founder's typical patterns + preferences
│   ├── mistakes.md                 ← mistakes and whether they were repeated
│   └── strengths.md                ← consistently successful behaviors
├── templates/
│   └── [stack-type]/               ← reusable starter templates extracted from past projects
└── automation-library/
    └── [workflow-name].json        ← reusable n8n/Make/cron automation blocks
```

**Read behavior:** Every Atlas invocation reads `~/.atlas/memory.md` and the relevant project context before doing anything else.
**Write behavior:** Every Atlas invocation appends learnings to memory and updates the project context after completing each module.

---

## Operating Modes

Atlas auto-detects mode from context. No flags needed.

### Single-Project Mode

**Trigger:** `/atlas` run from inside a project directory (git repo root)

Full founder copilot for one project. Runs the complete pipeline:

```
Onboarding → Code Sprint → Legal → Launch Strategy →
Marketing → Business Setup → Automation Handoff → Operations
```

Exits when the product has a runs-itself score of 70+.

### Portfolio Mode

**Trigger:** `/atlas` run from a parent directory containing multiple project folders, OR from any directory with no git repo

Empire intelligence layer. Reads all project contexts, generates the weekly empire brief, allocates founder attention, surfaces sell signals, runs the opportunity scanner.

---

## The Onboarding Protocol

The most critical module. Atlas builds a complete mental model of the business before writing a single word of strategy.

### Pass 1: Raw Signals (silent — no user interaction)

Atlas reads everything it can find:

**Code signals:**

- README, CLAUDE.md, PRD, all docs
- All API routes, web pages, database schema, migration history
- `package.json` dependencies (reveals architecture decisions and third-party services)
- Git log: velocity, contributors, decisions made over time
- `.env.example`: infrastructure configured vs. missing
- Test coverage percentage
- Error handling quality and completeness
- Deployment config files (Vercel, Railway, Docker, etc.)

**Business signals:**

- Existing marketing copy, landing page content
- Pricing configuration in code
- Legal docs (if any)
- Stripe/payment integration status
- Email service configuration
- Analytics/monitoring setup

**Maturity signals:**

- Feature flag usage → deployment sophistication
- API versioning → API maturity
- Database migration count → schema stability
- Logging/monitoring setup → operational readiness

### Pass 2: Inferences (silent — no user interaction)

From raw signals, Atlas builds a structured picture:

- Project completion percentage (estimated)
- Project type classification (SaaS / browser extension / developer tool / marketplace / content / API / community / mobile)
- Founder type (solo vs. team, technical vs. non-technical, estimated experience level from code patterns)
- Infrastructure status (dev-only vs. production-ready)
- Legal status (none / partial / complete)
- Market positioning (inferred from landing copy and competitor dependencies)
- Runs-itself score (current baseline)

Every inference is tagged: `[INFERRED]`, `[CONFIRMED]`, `[UNKNOWN]`

### Pass 3: Genuine Gaps (the interview)

Atlas only asks about things it genuinely could not infer. Batched by category for efficiency — this is onboarding, not a conversation.

**Business fundamentals:**

- Geographic location (affects entity type, tax advice, compliance)
- Definition of success (lifestyle business / VC-scale / acquisition target / other)
- Timeline pressure (soft / 3 months / ASAP)
- Financial runway or monthly budget ceiling

**Distribution:**

- Existing audience (email list, social following, community presence — size and platform)
- Prior launch experience (what worked, what didn't)

**Team:**

- Solo founder or co-founders? If team, who does what?
- Any contractors or employees already?

**Personal:**

- Risk tolerance (conservative / moderate / aggressive)

### Confirmation Ritual

Before any sprint begins, Atlas narrates back its complete understanding:

```
Here is my complete understanding of [Product Name].
Please correct anything wrong before I begin.

PRODUCT
  Name: [name]
  Category: [type]
  Target customer: [inferred or stated]
  Pricing: [inferred from code]
  Completion: ~[X]% [INFERRED]
  Current runs-itself score: [X]/100

FOUNDER
  Location: [stated]
  Team: [solo/team]
  Runway: [stated]
  Definition of success: [stated]
  Experience: [inferred from patterns]

MARKET
  Competitors identified: [list]
  Best launch channel (preliminary): [inferred]
  Community opportunities: [list]

BLOCKERS
  Code: [list of critical issues]
  Infrastructure: [list]
  Legal: [status]

RISKS I'VE NOTICED
  [specific risks flagged by Risk Radar]

Is this understanding correct? Any corrections before I begin the sprint?
Type 'correct: [correction]' or 'begin' to start.
```

---

## Business Context Schema

The structured data object Atlas builds during onboarding and updates throughout each module. Passed to every module.

```json
{
  "product": {
    "name": "",
    "slug": "",
    "category": "",
    "type": "saas|extension|tool|marketplace|content|api|community|mobile",
    "description": "",
    "target_customer": "",
    "core_value_prop": "",
    "pricing_model": "",
    "completion_percentage": 0,
    "runs_itself_score": 0,
    "tech_stack": [],
    "deployment_status": "none|dev|staging|production"
  },
  "founder": {
    "location": "",
    "team_size": 1,
    "runway_months": 0,
    "timeline": "",
    "definition_of_success": "lifestyle|grow|acquire|vc",
    "existing_audience": 0,
    "prior_launches": 0,
    "risk_tolerance": "low|medium|high"
  },
  "market": {
    "competitors": [],
    "target_communities": [],
    "launch_channels_ranked": [],
    "estimated_tam": ""
  },
  "status": {
    "current_phase": "",
    "code_blockers": [],
    "infrastructure_gaps": [],
    "legal_gaps": [],
    "completed_modules": []
  },
  "portfolio_context": {
    "total_projects": 0,
    "portfolio_mrr": 0,
    "cross_promotion_opportunities": [],
    "shared_audience_products": []
  }
}
```

---

## Module Specifications

### Module 1: Code Sprint

**Input:** Business Context + codebase
**Purpose:** Eliminate every technical blocker between current state and production-ready.

**Process:**

1. Run priority scorecard: score every gap on (Impact 1-10) × (1/Effort 1-10)
2. Execute in priority order — highest impact, lowest effort first
3. Fix all P0 code blockers (routing bugs, missing tables, schema mismatches, broken imports)
4. Scaffold all missing infrastructure config files (Vercel, Railway, Docker, Sentry, etc.)
5. Generate API documentation from route files
6. Write `RUNBOOK.md` — what breaks, how to fix it, how to hand it to a contractor
7. Update runs-itself score

**Output:**

- Fixed, committed codebase
- `docs/founder/RUNBOOK.md`
- Updated `~/.atlas/portfolio/[project]/context.json`
- Priority scorecard (human-readable)

**Checkpoint:**

```
Code Sprint complete.
  Fixed [N] blockers across [N] files
  Scaffolded [N] config files
  Runs-itself score: [X] → [Y]

Commit created: [hash] — review it at your leisure.
Type 'continue' to proceed to Legal & Compliance.
```

---

### Module 2: Legal & Compliance

**Input:** Business Context + project type + location
**Purpose:** Get legally clean before launch.

**Process:**

1. Draft Terms of Service — filled in with this product's actual data practices and use cases (not a blank template)
2. Draft Privacy Policy — specific to what data this product actually collects (read from codebase)
3. Generate compliance checklist for project type and geographic market
4. Flag specific clauses requiring lawyer review vs. boilerplate-safe
5. Write age verification / responsible use disclosure if product category requires it
6. Run Risk Radar: identify regulatory risks specific to this category and location
7. Identify ongoing compliance obligations (GDPR data deletion requests, CCPA opt-outs, etc.)

**Output:**

- `docs/legal/TERMS_OF_SERVICE.md`
- `docs/legal/PRIVACY_POLICY.md`
- `docs/legal/COMPLIANCE_CHECKLIST.md`
- Risk flags clearly marked with severity and what to do

**Confidence model:** Every legal recommendation carries a confidence level. Low-confidence items are flagged: "Have a lawyer review this."

---

### Module 3: Launch Strategy

**Input:** Business Context + memory (past launches for this founder)
**Purpose:** Write a complete, product-specific launch guide — not generic options, but the right strategy for this exact product.

**Process:**

1. Detect project type and target customer
2. Pull relevant patterns from `~/.atlas/patterns/launch.md` (what worked for this founder before)
3. Research comparable launches in this category (using web search if available)
4. Rank launch channels by ROI for this specific product — with explicit reasoning
5. Write complete launch assets for top 2-3 channels:
   - Product Hunt: tagline, description, first comment, maker story, gallery captions
   - Hacker News: Show HN post — HN-voice, not startup speak
   - Reddit: posts for 3-5 most relevant subreddits, each in that community's voice
   - Newsletter: cold outreach email to relevant newsletters/journalists
   - Direct: email to first 10 potential customers by name (if identifiable)
6. Build Parallel Universe analysis for launch timing decision
7. Write pre-launch checklist with specific timeline
8. Generate personal brand content: launch story for building-in-public

**Output:**

- `docs/founder/LAUNCH_STRATEGY.md` (channel selection + full reasoning)
- Complete copy for each selected channel (ready to post)
- `docs/founder/LAUNCH_TIMELINE.md`
- Building-in-public thread draft

**Parallel Universe model:**
For timing decisions, Atlas models 3 branches with expected outcomes and confidence levels before recommending.

---

### Module 4: Marketing Playbook

**Input:** Business Context + launch channel selection
**Purpose:** Build the complete marketing system — not a strategy doc, an executable playbook.

**Process:**

1. Identify which social platforms actually host the target customer (not which platforms are popular generally)
2. Write platform-specific setup guide for each recommended platform (exact bio copy, profile setup, pinned post)
3. Generate 30-day content calendar with specific posts — not topics, actual post text
4. Write SEO strategy: target keywords with search volume estimates, content gaps vs. competitors, technical SEO checklist
5. Identify top 10 communities; write engagement strategy for each (lurk period, contribution approach, product mention timing)
6. Build affiliate/referral program design if applicable
7. Personal brand layer: document launch journey, generate case study outline

**Output:**

- `docs/founder/MARKETING_PLAYBOOK.md`
- `docs/founder/CONTENT_CALENDAR_30.md` (30 actual posts, ready to schedule)
- `docs/founder/SEO_STRATEGY.md`

---

### Module 5: Business Setup

**Input:** Business Context + founder location + financial situation
**Purpose:** Get the legal/financial infrastructure right the first time — not generically, but for this founder's specific situation.

**Process:**

1. Recommend entity type (LLC/S-Corp/C-Corp) — with reasoning, confidence, and what changes the answer
2. Write state-specific formation guide — the actual steps, not "consult a lawyer"
3. Banking setup guide: which account types, which banks, why (business checking, savings, Stripe payout separation)
4. Accounting setup: which tool (based on complexity), how to configure it, what expense categories to create
5. Tax calendar: every filing deadline for year 1, estimated payment amounts based on revenue trajectory
6. Deduction identification: specific to this business (home office, equipment, software, R&D credit eligibility, health insurance, SEP-IRA)
7. S-Corp election timing calculation: at what income level it makes sense, how to file
8. Holding company signal: flag when portfolio size/income warrants restructuring
9. Exit strategy options: what buyers pay for this type of business, what improves the multiple

**Output:**

- `docs/founder/BUSINESS_SETUP.md`
- `docs/founder/TAX_CALENDAR.md`
- Acquisition Readiness Score (initial) with improvement roadmap

---

### Module 6: Automation Handoff

**Input:** Business Context + current runs-itself score + `~/.atlas/automation-library/`
**Purpose:** Get the product to runs-itself score 70+ — the real definition of "done" for founder time.

**Process:**

1. Calculate gap between current score and 70
2. List every automation that adds points, sorted by points-per-hour
3. Implement each automation:
   - Uptime monitoring (Better Uptime / UptimeRobot config)
   - Error alerting (Sentry config — if not already set up)
   - Revenue alerting (Stripe webhook → email/Slack on anomalies)
   - Email sequences (welcome, activation, day 3, day 7, day 14 — specific to this product's activation moment)
   - Social media scheduling (Buffer/Hypefury — queue 30 days of content from marketing module)
   - Support FAQ bot (Intercom/Crisp rules for top 20 questions from support playbook)
   - n8n/Make workflows for anything repeatable
4. Write contractor onboarding doc — everything a stranger needs to maintain this product
5. Generate SOW templates for foreseeable contracted work
6. Budget estimates at market rates
7. Add reusable automation blocks to `~/.atlas/automation-library/`
8. Recalculate runs-itself score

**Output:**

- Implemented automation configs (committed)
- `docs/founder/CONTRACTOR_ONBOARDING.md`
- Updated runs-itself score (target: 70+)
- New entries in `~/.atlas/automation-library/`

**Exit condition:** Module does not complete until runs-itself score ≥ 70. If 70 is not achievable without human action (account setup, API keys), Atlas provides the exact human steps needed to close the gap and documents the current blocker.

---

### Module 7: Operations

**Input:** Business Context + metrics data (Stripe, PostHog, database — if accessible)
**Purpose:** Build the permanent operating system for this product.

**Process:**

1. Define the 5 North Star metrics for this specific product — not AARRR framework, but the 5 numbers that actually matter here
2. Write weekly review ritual: what to look at, in what order, what questions to ask, how long it takes (target: 15 minutes)
3. Set monitoring and alert thresholds — what numbers trigger action
4. Build support playbook: 20 most likely questions with scripted responses
5. Define milestone triggers:
   - Hire signal (time bottleneck × MRR threshold × acquisition channel clarity)
   - Fundraise signal (growth rate × market size × burn rate)
   - Sell signal (growth plateau × MRR × multiple estimate)
   - Double-down signal (which metrics indicate to invest more)
6. Acquisition Readiness Score: current score + specific improvement roadmap
7. Personal wealth trajectory: at current growth, when does this product reach each financial milestone
8. Write ROADMAP.md: phases from current stage through scale, with entry/exit criteria per phase

**Output:**

- `docs/founder/OPERATIONS_HANDBOOK.md`
- `docs/founder/SUPPORT_PLAYBOOK.md`
- `docs/founder/ROADMAP.md`
- `docs/founder/YOUR_NEXT_ACTION.md` — always exactly one thing, always current

---

### Module 8: Portfolio (Empire Mode)

**Input:** All project contexts from `~/.atlas/portfolio/`
**Purpose:** Run the empire intelligently — allocate founder attention where it has the highest ROI.

**Process:**

1. Read all project contexts and recent metrics
2. Calculate runs-itself scores and trajectories for all products
3. Segment portfolio: running-themselves / need-attention / in-sprint / sunset-candidates
4. Generate attention allocation: which product deserves your hours this week and why
5. Identify cross-promotion opportunities between products with overlapping audiences
6. Flag sell signals: products that have plateaued and are worth more sold than maintained
7. Run Opportunity Scanner:
   - Acquisition targets matching portfolio patterns (Acquire.com / Flippa signals)
   - Unmet demand signals from Reddit/HN/IH ("I wish there was a tool that...")
   - Job postings signaling market gaps
   - Open source projects with traction but no monetization
8. Update empire financial model: total MRR, passive MRR (70+), wealth trajectory
9. Generate personal brand content from recent milestones across all products
10. Update `~/.atlas/memory.md` with new cross-project patterns

**Output:**

- Portfolio weekly brief (terminal output)
- Updated `~/.atlas/portfolio/index.md`
- `YOUR_NEXT_MOVE.md` — single most important action across the entire empire

---

## The New Features (Final Push)

### The Prediction Engine

Before committing to any major strategy, Atlas provides probabilistic outcome modeling:

- Based on comparable products in `~/.atlas/memory.md` + pattern library
- Each prediction has a confidence level (Low / Medium / High) with explicit reasoning
- Parallel Universe model for high-stakes decisions: 3 branches, expected outcomes, trade-offs

### The Pattern Oracle

Activates when 10+ projects are in memory. Surfaces behavioral patterns about this specific founder:

- Consistent blindspots (automatically corrected in future sprints)
- Consistent strengths (amplified in strategy recommendations)
- "You've done X four times — here's what happened each time"
- Prevents repeated mistakes structurally, not just by warning

### The Personal Brand Engine

Every product shipped generates distribution assets automatically:

- Building-in-public thread from git commits + milestones
- Launch story after each significant milestone
- Case study after product reaches $1K MRR
- Founder narrative that compounds across all projects
- Content queued for approval — founder approves, doesn't write

### The Opportunity Scanner (Portfolio Mode)

Atlas proactively surfaces:

- Acquisition targets: undervalued products matching your portfolio + skill profile
- Unmet market demand: community signals from Reddit/HN/IH/communities
- Buy vs. Build analysis: when acquiring is faster than building
- Open source monetization candidates

### The Delegation Engine

Atlas generates complete contractor management artifacts:

- Job postings (Upwork/Toptal) with specific technical requirements
- Contractor onboarding doc for each product
- SOW (Statement of Work) for each foreseeable contracted task
- Quality acceptance criteria
- Budget estimates at current market rates
- The moment a task can be safely delegated is flagged explicitly

### Zero-to-First-Dollar Mode

Specialized sprint mode for getting first paying customer (not just launching):

- Identifies the single feature that most justifies payment
- Finds first 5-10 likely customers by name (LinkedIn, community presence)
- Writes personalized direct outreach message for each
- Provides demo script and close sequence
- Tracks through to first payment before declaring success

### Risk Radar

Runs as part of onboarding and after each module. Surfaces non-obvious risks:

- Legal/regulatory: category-specific (sweepstakes law, GDPR, financial regulations, etc.)
- Technical: production readiness gaps (rate limiting, auth edge cases, data loss vectors)
- Market: competitive timing, pricing traps
- Operational: single points of failure, bus factor = 1 scenarios
  Each risk flagged with: severity, likelihood, specific fix, and whether Atlas can fix it or needs human action.

### Acquisition Readiness Score

Tracks the business as an asset from day one:

- Score: 0-100 based on what acquirers actually buy (revenue quality, documentation, bus factor, growth, contracts, IP, data)
- Specific improvement roadmap: what changes the score most with least effort
- Revenue multiple estimate by category and score level
- Buyer type identification: strategic / PE / indie acquirer

### Cross-Project Compounding

Atlas maintains a personal stack library that grows with every project:

- Reusable components extracted from past projects (auth, billing, notifications, analytics)
- Automation blocks that apply across products
- By project 10: new products start 40% more built
- By project 50: 70% of a new product's infrastructure is pre-built

### Empire Financial Model

Atlas tracks wealth trajectory across the entire portfolio:

```
10 products @ $1K MRR avg  = $10K/mo  = $120K/yr
50 products @ $1K MRR avg  = $50K/mo  = $600K/yr
100 products @ $2K MRR avg = $200K/mo = $2.4M/yr
Portfolio asset value (3x ARR): tracks in real time
Personal net worth trajectory: updates after every new product or milestone
```

---

## The Checkpoint Model

Every module ends with the same structure:

```
─────────────────────────────────────────
[MODULE NAME] COMPLETE

Done:
  ✓ [specific thing accomplished]
  ✓ [specific thing accomplished]
  ✓ [metric that changed]

Runs-itself score: [X] → [Y]

Needs your action before I can finish:
  → [human action required, if any]

Type 'continue' to proceed to [next module]
Type 'skip [module name]' to skip this module
Type 'pause' to save state and stop here
─────────────────────────────────────────
```

State is always saved. Atlas can be resumed at any checkpoint.

---

## Output Artifacts (Complete Single-Project Run)

```
docs/
├── legal/
│   ├── TERMS_OF_SERVICE.md
│   ├── PRIVACY_POLICY.md
│   └── COMPLIANCE_CHECKLIST.md
└── founder/
    ├── RUNBOOK.md
    ├── LAUNCH_STRATEGY.md
    ├── LAUNCH_TIMELINE.md
    ├── CONTENT_CALENDAR_30.md
    ├── SEO_STRATEGY.md
    ├── MARKETING_PLAYBOOK.md
    ├── BUSINESS_SETUP.md
    ├── TAX_CALENDAR.md
    ├── CONTRACTOR_ONBOARDING.md
    ├── OPERATIONS_HANDBOOK.md
    ├── SUPPORT_PLAYBOOK.md
    ├── ROADMAP.md
    └── YOUR_NEXT_ACTION.md          ← always one thing, always current

~/.atlas/
├── memory.md                        ← updated with this project's learnings
├── portfolio/[project-slug]/        ← full context snapshot
└── automation-library/[new-blocks]  ← reusable workflows extracted
```

---

## Key Design Principles

1. **Specificity over generality** — Every output is written for THIS product, not "a product." Atlas never produces generic advice.

2. **Decisions with reasoning** — Every recommendation states its confidence level and the specific evidence behind it. No oracular pronouncements.

3. **Intellectual honesty** — What Atlas cannot assess is explicitly flagged. It never fabricates legal certainty or financial predictions beyond its knowledge.

4. **Compounds over time** — Every run makes every future run better. The skill gets more powerful with each project without any extra effort from the founder.

5. **Two exit criteria** — A product is "done" only when it is (a) launched AND (b) runs itself at score 70+. Not before.

6. **Empire-aware by default** — Every single-product decision is made with the full portfolio in mind. Atlas never optimizes one product at the expense of the empire.

7. **Founder relationship, not tool** — Atlas maintains a persistent relationship that deepens over years. It remembers decisions, tracks growth, and disagrees when it has evidence you're making a mistake.

8. **Action over information** — Atlas does not produce reports for you to read. It produces decisions, copy, code, and configurations — things you can immediately use or approve.

---

## Implementation Notes

### Next Steps (implementation order)

1. Create `skills/founder-copilot/` directory in the superpowers skills location
2. Write `founder-copilot.md` (orchestrator) — handles mode detection, loads Business Context, invokes modules in sequence
3. Write `onboarding.md` — the 3-pass engine; this is the most critical module
4. Write remaining modules in pipeline order
5. Design `~/.atlas/` state schema and read/write conventions
6. Test on SweepBot as the first real run

### The Skill Creator Tool

Use `superpowers:writing-skills` when implementing to ensure the skill files follow the correct format, trigger conditions, and invocation patterns for the superpowers ecosystem.

### SweepBot as Pilot

SweepBot is the ideal first Atlas run — it has:

- Known code blockers (6 missing DB tables, 4 routing bugs)
- Known infrastructure gaps (no production env)
- Known legal gaps (no ToS/Privacy Policy)
- An active founder with a clear empire vision
- Documented in `~/.atlas/` as the founding case study

---

## Formal Spec Location

Once plan mode exits, write the final spec to:
`C:\Users\MQ420_OL\DEV\web\Sweepbot\docs\superpowers\specs\2026-03-18-atlas-founder-copilot-design.md`

And commit to `main`.
