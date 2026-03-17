# SweepBot — Launch Checklist

_This is the gate document. Nothing ships until every P0 item is checked._
_Last reviewed: 2026-03-05_

---

## Launch Readiness Tiers

**P0 = Hard blockers. Launch is impossible without these.**
**P1 = Strong blockers. Launch without these is embarrassing or legally risky.**
**P2 = Launch degraded but acceptable. Fix within first 2 weeks post-launch.**

---

## P0 — Must Be Done Before Any Public Launch

### Legal & Compliance

- [ ] Privacy Policy live at a public URL (`https://sweepbot.app/privacy`)
- [ ] Terms of Service live at a public URL (`https://sweepbot.app/terms`)
- [ ] Privacy policy URL registered in Chrome Web Store developer console (required for extension submission)
- [ ] Age gate (18+) implemented and enforced at account signup
- [ ] Automation disclosure checkbox implemented and enforced (users confirm they're automating their own accounts in permitted jurisdictions)
- [ ] All affiliate links clearly labeled as referral links (FTC compliance)
- [ ] Responsible play disclosures visible on automation features

### Infrastructure

- [ ] Supabase project created (production) — URL and keys in `.env`
- [ ] Supabase project created (staging) — separate environment
- [ ] Database migration `001_initial_schema.sql` run on production
- [ ] Database migration `002_seed_platforms.sql` run on production
- [ ] Flows schema migration run on production
- [ ] RLS policies verified — test that User A cannot access User B's data
- [ ] Domain acquired: `sweepbot.app` (and `api.sweepbot.app`)
- [ ] DNS configured
- [ ] SSL certificates active (HTTPS-only)
- [ ] Vercel project configured and web app deployed
- [ ] Railway project configured and API deployed
- [ ] Upstash Redis provisioned and connected
- [ ] Environment variables set in Vercel (web) and Railway (api) — not just local `.env`

### Payments

- [ ] Stripe account created and verified
- [ ] Stripe Products created for all 5 tiers (Free, Starter, Pro, Analyst, Elite) + Lifetime
- [ ] Stripe Prices created (monthly + annual for each)
- [ ] Stripe webhook endpoint configured in Stripe dashboard → `https://api.sweepbot.app/webhooks/stripe`
- [ ] `STRIPE_WEBHOOK_SECRET` set in production environment
- [ ] Checkout flow tested end-to-end (Free → Starter upgrade)
- [ ] Subscription created in Stripe → user tier updated in database ✓ (verify with manual test)
- [ ] Subscription cancelled in Stripe → user reverted to Free ✓ (verify)
- [ ] Customer portal link working

### Authentication

- [ ] Supabase Auth email provider enabled
- [ ] Email confirmation flow working (sign up → confirm email → get access)
- [ ] Password reset flow working
- [ ] `handle_new_user()` trigger verified (profile row auto-created on signup)
- [ ] `handle_new_profile()` trigger verified (settings + subscription rows auto-created)
- [ ] JWT validation working end-to-end (API rejects requests without valid token)

### Browser Extension — Chrome Web Store Submission

- [ ] Extension built with `pnpm build:zip` (production build)
- [ ] Privacy policy URL entered in extension submission form
- [ ] Extension description written (2–5 sentences for Web Store listing)
- [ ] Extension screenshots prepared (at least 3, 1280×800 or 640×400)
- [ ] Chrome Developer account created ($5 one-time registration fee paid)
- [ ] Extension submitted for review
- [ ] Extension approved (Web Store review typically takes 1–5 business days)

> **Note:** Do not launch web dashboard to the public before extension is approved or at minimum submitted. Extension is the primary acquisition channel.

---

## P1 — Strong Pre-Launch Requirements

### Error Monitoring

- [ ] Sentry project created and DSN configured in production environments
- [ ] Test error verified in Sentry (manually throw an error, confirm it appears)
- [ ] Sentry alerts configured for critical errors (email/Slack notification)

### Product Analytics

- [ ] PostHog project created
- [ ] PostHog key configured in web app
- [ ] Core events tracked: signup, subscription_upgrade, session_created, flow_created

### Email

- [ ] Resend account created and API key configured
- [ ] Sending domain configured and verified (`mail.sweepbot.app` or similar)
- [ ] Welcome email template created and tested
- [ ] Password reset email tested
- [ ] Subscription confirmation email tested

### Core Functionality Testing

- [ ] User can sign up, verify email, and access dashboard
- [ ] User can add a platform (e.g., Chumba Casino) to their account
- [ ] User installs extension → extension detects platform → HUD appears on casino page
- [ ] Extension captures a session (mock or real) → data appears in dashboard
- [ ] User can create a Flow via chat → flow appears in flows list
- [ ] Stripe checkout completed → tier badge updates in dashboard
- [ ] User can view jackpot data (if poller is running)
- [ ] Redemption can be logged and tracked

### Data Collection (Always-On Services)

- [ ] Jackpot poller deployed (Replit or equivalent) → collecting data for seeded platforms
- [ ] TOS monitor deployed → running daily diffs
- [ ] Platform health checker deployed → running 5-minute pings
- [ ] Verify at least 24 hours of jackpot data exists in `jackpot_snapshots` table before launch

### Content

- [ ] Landing page / marketing site live at `sweepbot.app` (pre-login)
- [ ] Pricing page accessible without login
- [ ] Link to Privacy Policy and Terms of Service in footer
- [ ] "This is not a gambling service" disclaimer visible
- [ ] Social accounts created: Twitter/X (@sweepbot or similar), Reddit account for community presence

### Responsible Play

- [ ] Session time limit alerts working in extension (if user has limit set)
- [ ] Automation flow guardrails enforced: max_duration, cool_down_check cannot be bypassed
- [ ] Responsible play resources link accessible from settings

---

## P2 — Launch Degraded But Acceptable

### Analytics Documentation

- [ ] Google Analytics / web crawl verified (robots.txt is not blocking indexing)
- [ ] Basic SEO: pages have title tags, meta descriptions

### Affiliate Program

- [ ] At least 3 platforms enrolled in affiliate program with working tracking links
- [ ] User affiliate dashboard accessible (even if placeholder for non-enrolled platforms)
- [ ] `platforms.affiliate_url` populated for enrolled platforms

### Extension — Firefox

- [ ] Firefox build tested (WXT handles cross-browser)
- [ ] Firefox Add-ons submission (lower priority than Chrome; defer if needed)

### Community Presence

- [ ] Reddit post in r/sweepstakescasino announcing SweepBot (after launch day)
- [ ] Response plan for first day of questions/feedback

---

## Post-Launch (First 2 Weeks)

- [ ] Monitor Sentry for errors — fix any critical issues same day
- [ ] Monitor request patterns for abuse (rate limiting working?)
- [ ] Collect and review first user feedback
- [ ] Verify affiliate click/conversion tracking is recording correctly
- [ ] First affiliate revenue visible in platform dashboards
- [ ] Begin Phase 2 feature development

---

## Launch Day Sequence

1. ✅ All P0 items complete
2. Deploy web app → Vercel (final production deploy)
3. Deploy API → Railway (final production deploy)
4. Run database migrations on production (if any pending)
5. Smoke test: sign up, browse dashboard, create flow, check Stripe checkout
6. Extension: confirm Chrome Web Store listing is live and search-discoverable
7. Post launch announcement (Reddit, X)
8. Monitor Sentry + PostHog for first hour
9. Be available for immediate bug fixes

---

_This document should be reviewed and updated with each launch-blocking issue resolved._
_Owner: Vincent Kinney / APPYness_
