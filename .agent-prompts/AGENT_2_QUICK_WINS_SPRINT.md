# Agent 2: Quick Wins Monetization Sprint

## Mission
Implement 4 high-ROI features that drive immediate conversion and retention improvements. These are 1-4 day features with outsized business impact.

## Context
You are working on **SweepBot** — the Bloomberg Terminal for sweepstakes casino players. See `AGENTS.md` for full project context.

**Current State:**
- Phase 1 complete (NLP flows engine, extension core, API, web dashboard)
- Phase 2 in progress (action execution, live data collection)
- Subscription tiers defined: Free, Starter ($14.99), Pro ($29.99), Analyst ($39.99), Elite ($59.99)
- Tech stack: React 18 + Vite, Fastify 5, PostgreSQL/Supabase, TypeScript strict mode

**Problem:**
- Free-to-paid conversion is sub-optimal (no trial, no streak mechanics, no engagement hooks)
- Missing notification infrastructure for all planned alert features
- Users don't see enough value in first 7 days to upgrade

**Your Goal:**
Implement 4 quick-win features that increase conversion by 20-30% and daily active usage by 25%+.

## Parallel Work Safety
**Agent 1** is building: `services/jackpot-poller/`, `services/tos-monitor/`, `services/health-checker/` (Replit deployments)
**Agent 3** is building: Macro Recorder in `apps/extension/src/lib/macro-recorder.ts`

**You own:** `apps/web/src/` (web dashboard), `apps/api/src/` (API routes/services), database migrations

**Critical:** Do NOT touch:
- `services/` directory
- `apps/extension/src/lib/macro-recorder.ts`
- Any files Agent 1 or Agent 3 are actively editing

## Features to Implement

### Feature 1: 14-Day Pro Trial for New Signups (Priority: P0, Effort: 1 day)

**Business Impact:** +25% free-to-paid conversion (industry standard for SaaS trials)

**Requirements:**
1. **Database Schema:**
   ```sql
   -- Add to users/subscriptions table
   ALTER TABLE subscriptions ADD COLUMN trial_started_at TIMESTAMP;
   ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMP;
   ALTER TABLE subscriptions ADD COLUMN trial_tier TEXT DEFAULT 'pro';
   ALTER TABLE subscriptions ADD COLUMN converted_from_trial BOOLEAN DEFAULT FALSE;
   ```

2. **API Endpoints:**
   - `POST /api/subscriptions/start-trial` — Activate trial (called during onboarding)
   - `GET /api/subscriptions/:userId/trial-status` — Check trial status
   - Add middleware: `checkTrialOrPaidAccess(tier)` for feature gating

3. **Onboarding Flow:**
   - After user signs up, show: "Start Your 14-Day Pro Trial"
   - CTA: "Unlock Unlimited Platforms, Auto-Runs & More"
   - Auto-activate trial on click (no credit card required)
   - Send welcome email via Resend

4. **Trial Countdown UI:**
   - Banner in dashboard header: "7 days left in your Pro trial"
   - Dismissible but reappears daily
   - CTA: "Upgrade Now" → Stripe checkout

5. **Trial Expiration:**
   - Cron job checks daily for expired trials
   - Downgrade to Free tier automatically
   - Send "Trial Ended" email with upgrade CTA
   - Disable Pro features (graceful degradation)

**Files to Create/Edit:**
- `apps/api/src/db/migrations/[timestamp]_add_trial_fields.sql`
- `apps/api/src/services/trial-manager.ts`
- `apps/api/src/routes/subscriptions.ts` (add trial endpoints)
- `apps/api/src/middleware/feature-gate.ts` (trial-aware gating)
- `apps/web/src/components/onboarding/TrialActivation.tsx`
- `apps/web/src/components/layout/TrialBanner.tsx`

**Success Metrics:**
- Trial activation rate: >80% of new signups
- Trial-to-paid conversion: >20%

---

### Feature 2: Daily Streak Counter with Engagement Rewards (Priority: P0, Effort: 2 days)

**Business Impact:** +30% DAU/MAU ratio (Duolingo proved this mechanic)

**Requirements:**
1. **Database Schema:**
   ```sql
   CREATE TABLE user_streaks (
     user_id UUID PRIMARY KEY REFERENCES users(id),
     current_streak INTEGER DEFAULT 0,
     longest_streak INTEGER DEFAULT 0,
     last_activity_date DATE NOT NULL,
     streak_shields INTEGER DEFAULT 0,  -- Allow 1 missed day
     total_xp INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE streak_activities (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     activity_type TEXT, -- 'session_tracked', 'flow_created', 'bonus_claimed', etc.
     xp_earned INTEGER DEFAULT 10,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Streak Logic:**
   - Activity counts as "active day": track session, create flow, claim bonus, log in
   - Check daily at midnight UTC: if no activity yesterday, streak resets (unless shield active)
   - Shields: Earn 1 shield per 7-day streak; auto-consume on missed day
   - XP: 10 XP per activity, 50 XP bonus per streak milestone (7, 30, 90, 365 days)

3. **API Endpoints:**
   - `GET /api/streaks/:userId` — Current streak status
   - `POST /api/streaks/activity` — Log activity (called by extension, web, API)
   - `GET /api/streaks/leaderboard` — Top 100 streaks (opt-in)

4. **UI Components:**
   - Dashboard widget: "🔥 12 Day Streak" with progress bar to next milestone
   - Hover tooltip shows: shields, longest streak, next milestone
   - Celebration animation on milestone (confetti.js)
   - Leaderboard page (opt-in, privacy-first)

5. **Gamification:**
   - Milestones: 7 days → 1 streak shield
   - 30 days → "Committed" badge
   - 90 days → "Dedicated" badge
   - 365 days → "Legend" badge + 1 month free Pro

**Files to Create/Edit:**
- `apps/api/src/db/migrations/[timestamp]_create_streaks.sql`
- `apps/api/src/services/streak-manager.ts`
- `apps/api/src/routes/streaks.ts`
- `apps/api/src/jobs/streak-checker.cron.ts` (daily midnight job)
- `apps/web/src/components/dashboard/StreakWidget.tsx`
- `apps/web/src/pages/StreakLeaderboard.tsx`
- `apps/web/src/hooks/useStreak.ts`

**Success Metrics:**
- 7-day streak rate: >40% of active users
- DAU increase: +25-30%

---

### Feature 3: Push Notification System (Foundation) (Priority: P0, Effort: 3 days)

**Business Impact:** Enables 20+ future alert features (jackpots, RTP warnings, bonus expiration, etc.)

**Requirements:**
1. **Database Schema:**
   ```sql
   CREATE TABLE user_notification_preferences (
     user_id UUID PRIMARY KEY REFERENCES users(id),
     email_enabled BOOLEAN DEFAULT TRUE,
     push_enabled BOOLEAN DEFAULT FALSE,
     push_subscription JSONB,  -- Web Push API subscription object
     
     -- Per-category preferences
     jackpot_alerts BOOLEAN DEFAULT TRUE,
     rtp_warnings BOOLEAN DEFAULT TRUE,
     bonus_expiration BOOLEAN DEFAULT TRUE,
     redemption_updates BOOLEAN DEFAULT TRUE,
     trust_index_changes BOOLEAN DEFAULT TRUE,
     flow_execution_alerts BOOLEAN DEFAULT TRUE,
     
     quiet_hours_start TIME,
     quiet_hours_end TIME,
     timezone TEXT DEFAULT 'America/New_York',
     
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE notifications (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     type TEXT NOT NULL, -- 'jackpot_hit', 'rtp_warning', 'bonus_expiring', etc.
     title TEXT NOT NULL,
     body TEXT NOT NULL,
     data JSONB,
     priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'critical')),
     
     -- Delivery tracking
     sent_at TIMESTAMP,
     read_at TIMESTAMP,
     clicked_at TIMESTAMP,
     delivery_method TEXT[], -- ['email', 'push', 'in_app']
     
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
   ```

2. **Web Push Integration:**
   - Use Web Push API (no third-party service needed)
   - Generate VAPID keys for push authentication
   - Service worker in `apps/web/public/sw.js` to handle push events
   - Request permission on settings page (not annoying popup)

3. **API Endpoints:**
   - `POST /api/notifications/subscribe` — Save push subscription
   - `POST /api/notifications/send` — Internal API for sending
   - `GET /api/notifications/:userId` — Inbox (paginated)
   - `PATCH /api/notifications/:id/read` — Mark as read
   - `GET /api/notifications/:userId/preferences` — Get prefs
   - `PUT /api/notifications/:userId/preferences` — Update prefs

4. **Notification Service:**
   ```typescript
   class NotificationService {
     async send(userId: string, notification: NotificationPayload) {
       const prefs = await this.getPreferences(userId);
       
       // Check quiet hours
       if (this.isQuietHours(prefs)) return;
       
       // Check category preference
       if (!prefs[notification.category]) return;
       
       // Send via enabled channels
       if (prefs.email_enabled) await this.sendEmail(userId, notification);
       if (prefs.push_enabled) await this.sendPush(userId, notification);
       
       // Always log to in-app inbox
       await this.logToInbox(userId, notification);
     }
   }
   ```

5. **UI Components:**
   - Settings page: notification preferences panel
   - Bell icon in header with unread count badge
   - Notification dropdown (5 most recent)
   - Full inbox page with filters (unread, category, date)

**Files to Create/Edit:**
- `apps/api/src/db/migrations/[timestamp]_create_notifications.sql`
- `apps/api/src/services/notification-service.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/lib/web-push.ts` (VAPID key generation, push sender)
- `apps/web/public/sw.js` (service worker for push)
- `apps/web/src/components/notifications/NotificationBell.tsx`
- `apps/web/src/components/notifications/NotificationDropdown.tsx`
- `apps/web/src/pages/NotificationsInbox.tsx`
- `apps/web/src/components/settings/NotificationPreferences.tsx`

**Success Metrics:**
- Push opt-in rate: >40%
- Notification engagement (click-through): >25%

---

### Feature 4: Session Voice Notes (Unique Differentiator) (Priority: P1, Effort: 3 days)

**Business Impact:** Unique feature no competitor has; hands-free journaling during play

**Requirements:**
1. **Database Schema:**
   ```sql
   CREATE TABLE session_notes (
     id UUID PRIMARY KEY,
     session_id UUID REFERENCES sessions(id),
     user_id UUID REFERENCES users(id),
     
     -- Voice data
     audio_url TEXT,  -- Stored in Supabase Storage
     transcript TEXT,
     duration_seconds INTEGER,
     
     -- Metadata extracted from transcript (NLP)
     mentioned_games TEXT[],
     sentiment TEXT, -- 'positive', 'neutral', 'negative', 'frustrated', 'excited'
     tags TEXT[],
     
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE INDEX idx_session_notes_session ON session_notes(session_id);
   CREATE INDEX idx_session_notes_user ON session_notes(user_id);
   ```

2. **Browser Speech API:**
   - Use Chrome's Web Speech API (SpeechRecognition) — FREE
   - No external API costs (runs in browser)
   - Real-time transcription as user speaks
   - Save transcript + optional audio blob to Supabase Storage

3. **NLP Analysis (Post-Process):**
   - Extract game names mentioned (regex + entity recognition)
   - Sentiment analysis (simple keyword matching for MVP)
   - Auto-tag: "big win", "tilt", "bonus", "frustration", "strategy"

4. **API Endpoints:**
   - `POST /api/sessions/:sessionId/notes` — Save voice note
   - `GET /api/sessions/:sessionId/notes` — Get notes for session
   - `GET /api/users/:userId/notes/search` — Search across all notes
   - `GET /api/users/:userId/notes/sentiment-trends` — Sentiment over time

5. **UI Components:**
   - Sessions page: "🎤 Add Voice Note" button
   - Recording UI: waveform animation, transcript live-preview
   - Playback: audio player + transcript display
   - Search interface: full-text search across transcripts
   - Sentiment trend chart (analytics page)

**Files to Create/Edit:**
- `apps/api/src/db/migrations/[timestamp]_create_session_notes.sql`
- `apps/api/src/services/voice-notes-processor.ts`
- `apps/api/src/routes/session-notes.ts`
- `apps/web/src/components/sessions/VoiceNoteRecorder.tsx`
- `apps/web/src/components/sessions/VoiceNotePlayback.tsx`
- `apps/web/src/hooks/useSpeechRecognition.ts`
- `apps/web/src/lib/sentiment-analyzer.ts` (simple keyword-based)

**Success Metrics:**
- Usage rate: >15% of Pro users record voice notes
- Average notes per session: 1.5+
- Sentiment correlation: Detect tilt patterns early

---

## Implementation Order

### Day 1: 14-Day Pro Trial
1. Database migration
2. Trial manager service
3. API endpoints
4. Onboarding UI
5. Trial banner component
6. Test full flow

### Day 2: Daily Streak Counter
1. Database migration
2. Streak manager service
3. Cron job for daily check
4. API endpoints
5. Dashboard widget
6. Leaderboard page

### Day 3-4: Push Notification System
1. Database migration
2. Generate VAPID keys
3. Service worker setup
4. Notification service
5. API endpoints
6. Settings UI
7. Bell icon + dropdown
8. Test with sample notifications

### Day 5: Session Voice Notes
1. Database migration
2. Speech recognition hook
3. Voice recorder component
4. API endpoints
5. Sentiment analyzer
6. Playback UI

---

## Technical Guidelines

**Database:**
- All migrations in `apps/api/src/db/migrations/`
- Use Drizzle ORM schema in `apps/api/src/db/schema/`
- Run: `pnpm --filter @sweepbot/api db:migrate`

**API:**
- Fastify 5 routes
- Type-safe with Zod validation
- Response format: `{ success: true, data: T }` or `{ error: string }`
- Middleware: JWT auth via Supabase

**Frontend:**
- React 18 + TypeScript strict mode
- TanStack Query for data fetching
- Zustand for client state
- shadcn/ui components
- Tailwind CSS v4

**Testing:**
- Vitest for unit tests
- Test each service in isolation
- E2E test critical flows (trial activation, streak increment)

---

## Deliverables

1. ✅ All 4 features fully implemented and tested
2. ✅ Database migrations applied
3. ✅ API endpoints documented in `docs/API_DESIGN.md` (append)
4. ✅ UI components integrated into existing pages
5. ✅ Success metrics tracked in PostHog
6. ✅ README updates in affected packages

---

## Success Criteria

Your sprint is complete when:
- [ ] Trial flow works end-to-end (signup → activate → countdown → convert/downgrade)
- [ ] Streaks increment correctly daily and persist across sessions
- [ ] Push notifications can be sent programmatically and appear in browser
- [ ] Voice notes can be recorded, transcribed, saved, and played back
- [ ] All tests pass (`pnpm test`)
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] Documentation updated

---

## Resources

- **Codebase context:** See `AGENTS.md` at repo root
- **Database schema:** See `docs/DATABASE_SCHEMA.md`
- **API patterns:** See `apps/api/src/routes/sessions.ts` for examples
- **UI patterns:** See `apps/web/src/pages/DashboardPage.tsx` for examples
- **Web Push guide:** https://web.dev/push-notifications-overview/
- **Speech API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

---

**Go build. Every feature you ship increases conversion and retention. These are the highest-ROI tasks in the entire roadmap.**
