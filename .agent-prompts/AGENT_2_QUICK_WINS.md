# Agent 2 Assignment: Quick Wins Implementation

## Mission

Implement 4 high-impact features that drive conversion, engagement, and retention. These features were identified through competitive analysis and are proven engagement drivers across the sweepstakes casino ecosystem.

**Success criteria:** All 4 features production-ready within 5 days. Measurable impact on trial → paid conversion (+15%), daily active users (+25%), and session depth (+30%).

---

## Context

**Who you are:** Full-stack implementer focused on conversion optimization and user retention mechanisms.

**What SweepBot is:** Bloomberg Terminal for sweepstakes casino players. React 18 + Vite frontend, Fastify 5 backend, PostgreSQL via Supabase, browser extension (WXT framework).

**Current state:** Phase 1 complete (NLP flow engine, extension core, API, web dashboard). You're building Phase 2 features that drive growth.

**Where to work:**

- Frontend: `apps/web/src/`
- Backend: `apps/api/src/routes/` + `apps/api/src/db/schema/`
- Shared types: `packages/types/src/`

**Testing approach:** Vitest for unit tests, manual E2E for user flows.

---

## Feature 1: 14-Day Free Trial

### Business Impact

- **Problem:** Users hesitate to subscribe without experiencing premium features
- **Solution:** Risk-free trial → 3x conversion rate vs. no trial
- **Revenue model:** Auto-convert to paid unless cancelled
- **Competitive precedent:** RobinHood Gold (59% trial → paid), Headspace (47% trial → paid)

### Technical Specification

#### Database Schema

```sql
-- Add to subscriptions table
ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN trial_converted BOOLEAN DEFAULT false;

-- New table for trial lifecycle tracking
CREATE TABLE trial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('trial_started', 'trial_reminder_sent', 'trial_ending_soon', 'trial_converted', 'trial_expired', 'trial_cancelled')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trial_events_user ON trial_events(user_id, created_at DESC);
CREATE INDEX idx_trial_events_type ON trial_events(event_type, created_at DESC);
```

#### Backend Routes

**POST /api/subscriptions/start-trial**

```typescript
// apps/api/src/routes/subscriptions.ts
interface StartTrialRequest {
  userId: string;
  plan: 'pro' | 'enterprise'; // Default to 'pro'
}

interface StartTrialResponse {
  success: true;
  data: {
    subscriptionId: string;
    trialEndsAt: string; // ISO 8601
    daysRemaining: number;
    features: string[]; // ['unlimited_sessions', 'advanced_analytics', 'flow_automation']
  }
}

// Implementation:
app.post('/subscriptions/start-trial', async (req, res) => {
  const { userId, plan = 'pro' } = req.body;

  // Check if user already used trial
  const existingTrial = await db.subscriptions
    .where('user_id', userId)
    .whereNotNull('trial_ends_at')
    .first();

  if (existingTrial) {
    return res.status(400).json({
      error: 'trial_already_used',
      message: 'You have already used your free trial'
    });
  }

  // Create subscription with trial
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  const subscription = await db.subscriptions.insert({
    user_id: userId,
    plan,
    status: 'trialing',
    trial_ends_at: trialEnds,
    current_period_start: new Date(),
    current_period_end: trialEnds
  });

  // Log event
  await db.trialEvents.insert({
    user_id: userId,
    event_type: 'trial_started',
    metadata: { plan, trial_ends_at: trialEnds }
  });

  // Schedule reminder emails (BullMQ job)
  await trialReminderQueue.add('send-reminder', {
    userId,
    reminderDate: new Date(trialEnds.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days before
  }, { delay: /* calculate delay */ });

  return res.json({
    success: true,
    data: {
      subscriptionId: subscription.id,
      trialEndsAt: trialEnds.toISOString(),
      daysRemaining: 14,
      features: getPlanFeatures(plan)
    }
  });
});
```

**GET /api/subscriptions/trial-status**

```typescript
interface TrialStatusResponse {
  success: true
  data: {
    isTrialing: boolean
    daysRemaining: number | null
    trialEndsAt: string | null
    hasUsedTrial: boolean
    canStartTrial: boolean
  }
}
```

#### Frontend Components

**Trial Banner (apps/web/src/components/TrialBanner.tsx)**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export function TrialBanner() {
  const { data: trialStatus } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => api.get('/subscriptions/trial-status'),
  })

  if (!trialStatus?.isTrialing) return null

  const daysLeft = trialStatus.daysRemaining
  const urgency = daysLeft <= 3 ? 'destructive' : daysLeft <= 7 ? 'warning' : 'default'

  return (
    <Alert variant={urgency} className="mb-4">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your Pro trial
        </span>
        <Button size="sm" asChild>
          <Link to="/pricing">Upgrade Now</Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
```

**Trial Start Modal (apps/web/src/pages/Onboarding.tsx)**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

export function TrialStartModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const startTrial = useMutation({
    mutationFn: () => api.post('/subscriptions/start-trial', { plan: 'pro' }),
    onSuccess: () => {
      onClose()
      // Show success toast
      toast.success('Your 14-day Pro trial has started!')
      // Redirect to dashboard
      navigate('/dashboard')
    },
  })

  const features = [
    'Unlimited session tracking',
    'Advanced portfolio analytics',
    'Flow automation (50 flows)',
    'Trust Index access',
    'Priority support',
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Your Free Pro Trial</DialogTitle>
          <DialogDescription>
            Full access to all Pro features. No credit card required. Cancel anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={() => startTrial.mutate()} disabled={startTrial.isPending}>
            {startTrial.isPending ? 'Starting...' : 'Start Free Trial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### Trial Expiration Job (BullMQ)

```typescript
// apps/api/src/jobs/trial-expiration.ts
import { Queue, Worker } from 'bullmq'

const trialExpirationQueue = new Queue('trial-expiration', { connection: redisConnection })

// Schedule daily check at midnight UTC
trialExpirationQueue.add(
  'check-expired-trials',
  {},
  {
    repeat: { pattern: '0 0 * * *' }, // Cron: midnight daily
  }
)

const worker = new Worker(
  'trial-expiration',
  async (job) => {
    if (job.name === 'check-expired-trials') {
      const expiredTrials = await db.subscriptions
        .where('status', 'trialing')
        .where('trial_ends_at', '<', new Date())
        .select('*')

      for (const subscription of expiredTrials) {
        // Check if user added payment method
        const paymentMethod = await getPaymentMethod(subscription.user_id)

        if (paymentMethod) {
          // Convert to paid subscription
          await convertTrialToPaid(subscription)
        } else {
          // Downgrade to free plan
          await downgradeToFree(subscription)
        }
      }
    }
  },
  { connection: redisConnection }
)
```

#### Email Templates (Resend)

**3 days before expiration:**

```typescript
await resend.emails.send({
  from: 'SweepBot <noreply@sweepbot.com>',
  to: user.email,
  subject: '3 Days Left in Your SweepBot Pro Trial',
  html: `
    <h2>Your trial is ending soon</h2>
    <p>You have 3 days left in your 14-day Pro trial.</p>
    <p>Add a payment method to continue with Pro after your trial ends.</p>
    <a href="${APP_URL}/settings/billing">Manage Subscription</a>
  `,
})
```

### Success Metrics

- **Trial → Paid conversion:** 40%+ (industry benchmark: 25%)
- **Trial cancellation rate:** <15%
- **Day 7 engagement:** 60%+ of trial users active

---

## Feature 2: Daily Streak System

### Business Impact

- **Problem:** Users track sessions inconsistently, losing momentum
- **Solution:** Gamification → 3.2x increase in daily active users (Duolingo case study)
- **Engagement boost:** Streaks create habit loops ("don't break the chain")

### Technical Specification

#### Database Schema

```sql
CREATE TABLE user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL UNIQUE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  freeze_credits INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_longest ON user_streaks(longest_streak DESC);

-- Streak milestones table
CREATE TABLE streak_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  milestone INT NOT NULL, -- 7, 30, 100, 365
  achieved_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_streak_milestones_user ON streak_milestones(user_id, milestone DESC);
```

#### Backend Routes

**GET /api/streaks/current**

```typescript
interface StreakResponse {
  success: true
  data: {
    currentStreak: number
    longestStreak: number
    lastActivityDate: string
    freezeCredits: number
    nextMilestone: number // 7, 30, 100, or 365
    daysUntilNextMilestone: number
  }
}
```

**POST /api/streaks/record-activity**

```typescript
// Call this when user tracks a session, creates a flow, or uses extension
app.post('/streaks/record-activity', async (req, res) => {
  const { userId } = req.body

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const streak = await db.userStreaks.where('user_id', userId).first()

  if (!streak) {
    // First time user
    await db.userStreaks.insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
    })
    return res.json({ success: true, data: { currentStreak: 1 } })
  }

  const lastDate = new Date(streak.last_activity_date)
  const todayDate = new Date(today)
  const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24))

  if (daysDiff === 0) {
    // Already recorded today
    return res.json({ success: true, data: { currentStreak: streak.current_streak } })
  } else if (daysDiff === 1) {
    // Consecutive day - increment streak
    const newStreak = streak.current_streak + 1
    await db.userStreaks.where('user_id', userId).update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, streak.longest_streak),
      last_activity_date: today,
      updated_at: new Date(),
    })

    // Check milestones
    if ([7, 30, 100, 365].includes(newStreak)) {
      await awardMilestone(userId, newStreak)
    }

    return res.json({ success: true, data: { currentStreak: newStreak } })
  } else {
    // Streak broken
    await db.userStreaks.where('user_id', userId).update({
      current_streak: 1,
      last_activity_date: today,
      updated_at: new Date(),
    })

    return res.json({
      success: true,
      data: { currentStreak: 1, streakBroken: true, previousStreak: streak.current_streak },
    })
  }
})
```

**POST /api/streaks/use-freeze**

```typescript
// Allow user to "freeze" streak for 1 day (Pro feature)
app.post('/streaks/use-freeze', async (req, res) => {
  const { userId } = req.body

  const streak = await db.userStreaks.where('user_id', userId).first()

  if (streak.freeze_credits <= 0) {
    return res.status(400).json({ error: 'no_freezes_available' })
  }

  await db.userStreaks.where('user_id', userId).update({
    freeze_credits: streak.freeze_credits - 1,
    last_activity_date: new Date().toISOString().split('T')[0], // Update to today
  })

  return res.json({ success: true, data: { remainingFreezes: streak.freeze_credits - 1 } })
})
```

#### Frontend Components

**Streak Widget (apps/web/src/components/StreakWidget.tsx)**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Flame, Award } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export function StreakWidget() {
  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/streaks/current'),
  })

  if (!streak) return null

  const { currentStreak, longestStreak, nextMilestone, daysUntilNextMilestone } = streak

  const progress = ((nextMilestone - daysUntilNextMilestone) / nextMilestone) * 100

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Flame className="h-12 w-12 text-orange-500" />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
              {currentStreak}
            </span>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold">{currentStreak} Day Streak</h3>
            <p className="text-sm text-gray-600">
              {daysUntilNextMilestone} days until {nextMilestone}-day milestone
            </p>
            <Progress value={progress} className="mt-2" />
          </div>

          {longestStreak > currentStreak && (
            <div className="text-center">
              <Award className="mx-auto h-6 w-6 text-gray-400" />
              <p className="text-xs text-gray-500">Best: {longestStreak}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Streak Broken Modal (apps/web/src/components/StreakBrokenModal.tsx)**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function StreakBrokenModal({ isOpen, onClose, previousStreak }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="h-6 w-6 text-red-500" />
            Streak Lost
          </DialogTitle>
          <DialogDescription>
            Your {previousStreak}-day streak has ended. Start a new streak by tracking a session
            today!
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600">
            💡 <strong>Pro tip:</strong> Pro subscribers get 3 streak freeze credits per month to
            protect their streaks.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button asChild>
            <Link to="/sessions/new">Track Session</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Success Metrics

- **Daily active users (DAU):** +25%
- **Week 2 retention:** +40% (users with 7+ day streak)
- **Pro conversion:** +15% (upsell streak freezes)

---

## Feature 3: Push Notifications

### Business Impact

- **Problem:** Users forget to check dashboard, miss important alerts
- **Solution:** Real-time push notifications → 3x re-engagement rate
- **Use cases:** Jackpot spike, ToS change, platform outage, trial ending soon, flow execution error

### Technical Specification

#### Database Schema

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL, -- { p256dh, auth }
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  jackpot_alerts BOOLEAN DEFAULT true,
  tos_changes BOOLEAN DEFAULT true,
  platform_outages BOOLEAN DEFAULT true,
  flow_errors BOOLEAN DEFAULT true,
  trial_reminders BOOLEAN DEFAULT true,
  daily_summary BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Backend Implementation

**Install web-push:**

```bash
cd apps/api
npm install web-push
```

**Generate VAPID keys (one-time):**

```typescript
// apps/api/scripts/generate-vapid.ts
import webpush from 'web-push'

const vapidKeys = webpush.generateVAPIDKeys()

console.log('VAPID_PUBLIC_KEY:', vapidKeys.publicKey)
console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey)
// Add these to .env
```

**Push notification service:**

```typescript
// apps/api/src/services/push-service.ts
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:support@sweepbot.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushNotification(
  userId: string,
  notification: {
    title: string
    body: string
    icon?: string
    badge?: string
    data?: any
  }
) {
  const subscriptions = await db.pushSubscriptions.where('user_id', userId).select('*')

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        JSON.stringify(notification)
      )
    )
  )

  // Remove expired subscriptions
  const expiredIndexes = results
    .map((result, idx) =>
      result.status === 'rejected' && result.reason.statusCode === 410 ? idx : -1
    )
    .filter((idx) => idx !== -1)

  for (const idx of expiredIndexes) {
    await db.pushSubscriptions.where('id', subscriptions[idx].id).delete()
  }

  return { sent: results.filter((r) => r.status === 'fulfilled').length }
}
```

**Routes:**

```typescript
// POST /api/notifications/subscribe
app.post('/notifications/subscribe', async (req, res) => {
  const { userId, subscription } = req.body

  await db.pushSubscriptions
    .insert({
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      user_agent: req.headers['user-agent'],
    })
    .onConflict('endpoint')
    .merge() // Update if exists

  return res.json({ success: true })
})

// POST /api/notifications/unsubscribe
app.post('/notifications/unsubscribe', async (req, res) => {
  const { endpoint } = req.body

  await db.pushSubscriptions.where('endpoint', endpoint).delete()

  return res.json({ success: true })
})

// GET /api/notifications/preferences
// PUT /api/notifications/preferences
```

#### Frontend Implementation

**Service Worker (apps/web/public/sw.js)**

```javascript
// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) return

  const notification = event.data.json()

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/badge-72.png',
      data: notification.data,
      tag: notification.data?.tag || 'default',
      requireInteraction: notification.data?.urgent || false,
    })
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
```

**Push subscription hook (apps/web/src/hooks/usePushNotifications.ts)**

```typescript
import { useEffect, useState } from 'react'

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window)
  }, [])

  async function subscribe() {
    if (!isSupported) return false

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js')

      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Permission denied')
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      })

      // Send subscription to server
      await api.post('/notifications/subscribe', { subscription })

      setIsSubscribed(true)
      return true
    } catch (error) {
      console.error('Push subscription failed:', error)
      return false
    }
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint })
      setIsSubscribed(false)
    }
  }

  return { isSupported, isSubscribed, subscribe, unsubscribe }
}
```

**Notification settings page component:**

```tsx
// apps/web/src/pages/Settings/Notifications.tsx
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'

export function NotificationSettings() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications()

  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get('/notifications/preferences'),
  })

  const updatePreferences = useMutation({
    mutationFn: (prefs: any) => api.put('/notifications/preferences', prefs),
    onSuccess: () => queryClient.invalidateQueries(['notification-preferences']),
  })

  if (!isSupported) {
    return <p className="text-gray-600">Push notifications are not supported in your browser.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Push Notifications</h3>
          <p className="text-sm text-gray-600">Get real-time alerts for important events</p>
        </div>
        <Button
          variant={isSubscribed ? 'outline' : 'default'}
          onClick={isSubscribed ? unsubscribe : subscribe}
        >
          {isSubscribed ? (
            <>
              <BellOff className="mr-2 h-4 w-4" /> Disable
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" /> Enable
            </>
          )}
        </Button>
      </div>

      {isSubscribed && preferences && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="jackpot">Jackpot Spikes</Label>
            <Switch
              id="jackpot"
              checked={preferences.jackpot_alerts}
              onCheckedChange={(checked) => updatePreferences.mutate({ jackpot_alerts: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tos">ToS Changes</Label>
            <Switch
              id="tos"
              checked={preferences.tos_changes}
              onCheckedChange={(checked) => updatePreferences.mutate({ tos_changes: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="outages">Platform Outages</Label>
            <Switch
              id="outages"
              checked={preferences.platform_outages}
              onCheckedChange={(checked) => updatePreferences.mutate({ platform_outages: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="flow-errors">Flow Errors</Label>
            <Switch
              id="flow-errors"
              checked={preferences.flow_errors}
              onCheckedChange={(checked) => updatePreferences.mutate({ flow_errors: checked })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

### Trigger Examples

**Jackpot spike alert:**

```typescript
// apps/api/src/services/jackpot-analyzer.ts
if (currentValue > previousValue * 1.5) {
  await sendPushNotification(userId, {
    title: '🎰 Jackpot Spike Alert',
    body: `${platform.name} ${jackpotType} jumped to $${currentValue.toLocaleString()}!`,
    icon: '/icons/jackpot.png',
    data: {
      url: `/platforms/${platform.id}`,
      tag: 'jackpot-spike',
      urgent: false,
    },
  })
}
```

**Platform outage:**

```typescript
// apps/api/src/services/health-monitor.ts
if (status === 'down' && previousStatus === 'healthy') {
  const affectedUsers = await getUsersWithAutomationOn(platformId)

  for (const user of affectedUsers) {
    await sendPushNotification(user.id, {
      title: '⚠️ Platform Outage',
      body: `${platform.name} is currently unreachable. Automation paused.`,
      icon: '/icons/warning.png',
      data: {
        url: `/platforms/${platform.id}`,
        tag: 'platform-outage',
        urgent: true,
      },
    })
  }
}
```

### Success Metrics

- **Notification opt-in rate:** 40%+
- **Click-through rate:** 25%+ (industry avg: 10-15%)
- **Re-engagement:** 3x (users return within 5 minutes of notification)

---

## Feature 4: Voice Notes

### Business Impact

- **Problem:** Manual typing during gaming sessions is disruptive
- **Solution:** Voice-to-text notes → 5x faster than typing, hands-free workflow
- **Competitive precedent:** WhatsApp voice messages (72% of users prefer voice for long messages)
- **Use case:** "Voice note: Hit big win on Chumba Divine Fortune, $450, 3x multiplier trigger"

### Technical Specification

#### Backend Routes

**POST /api/sessions/:id/voice-notes**

```typescript
interface VoiceNoteUploadRequest {
  audioBlob: File // webm or mp4 format
  duration: number // seconds
  platform?: string
}

interface VoiceNoteResponse {
  success: true
  data: {
    noteId: string
    transcription: string
    confidence: number // 0-1
    audioUrl: string // Supabase Storage URL
    duration: number
  }
}

app.post('/sessions/:id/voice-notes', async (req, res) => {
  const { id: sessionId } = req.params
  const file = req.file // Using multer middleware

  // Upload audio to Supabase Storage
  const fileName = `voice-notes/${generateId()}.webm`
  const { data: uploadData } = await supabase.storage
    .from('session-media')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
    })

  // Transcribe using Web Speech API or OpenAI Whisper
  const transcription = await transcribeAudio(file.buffer)

  // Save note
  const note = await db.sessionNotes.insert({
    session_id: sessionId,
    content: transcription.text,
    note_type: 'voice',
    audio_url: uploadData.path,
    audio_duration: req.body.duration,
    transcription_confidence: transcription.confidence,
    created_at: new Date(),
  })

  return res.json({
    success: true,
    data: {
      noteId: note.id,
      transcription: transcription.text,
      confidence: transcription.confidence,
      audioUrl: supabase.storage.from('session-media').getPublicUrl(uploadData.path).data.publicUrl,
      duration: req.body.duration,
    },
  })
})
```

#### Frontend Implementation

**Voice recorder hook (apps/web/src/hooks/useVoiceRecorder.ts)**

```typescript
import { useState, useRef } from 'react'

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setDuration(0)

      // Update duration every second
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }

  function stopRecording(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current
      if (!mediaRecorder) return

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }

        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop())

        setIsRecording(false)

        resolve({ blob, duration })
      }

      mediaRecorder.stop()
    })
  }

  function cancelRecording() {
    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach((track) => track.stop())
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    chunksRef.current = []
    setIsRecording(false)
    setDuration(0)
  }

  return { isRecording, duration, startRecording, stopRecording, cancelRecording }
}
```

**Voice note button (apps/web/src/components/VoiceNoteButton.tsx)**

```tsx
import { useState } from 'react'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function VoiceNoteButton({ sessionId }: { sessionId: string }) {
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } =
    useVoiceRecorder()
  const [isTranscribing, setIsTranscribing] = useState(false)

  const uploadVoiceNote = useMutation({
    mutationFn: async ({ blob, duration }: { blob: Blob; duration: number }) => {
      setIsTranscribing(true)

      const formData = new FormData()
      formData.append('audioBlob', blob, 'voice-note.webm')
      formData.append('duration', duration.toString())

      const response = await fetch(`/api/sessions/${sessionId}/voice-notes`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      })

      return response.json()
    },
    onSuccess: (data) => {
      toast.success('Voice note saved', {
        description: data.transcription,
      })
      setIsTranscribing(false)
    },
    onError: () => {
      toast.error('Failed to save voice note')
      setIsTranscribing(false)
    },
  })

  async function handleClick() {
    if (isRecording) {
      const { blob, duration } = await stopRecording()
      uploadVoiceNote.mutate({ blob, duration })
    } else {
      try {
        await startRecording()
      } catch (error) {
        toast.error('Microphone access denied')
      }
    }
  }

  if (isTranscribing) {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Transcribing...
      </Button>
    )
  }

  return (
    <Button
      onClick={handleClick}
      variant={isRecording ? 'destructive' : 'outline'}
      className={isRecording ? 'animate-pulse' : ''}
    >
      {isRecording ? (
        <>
          <Square className="mr-2 h-4 w-4" />
          Stop Recording ({duration}s)
        </>
      ) : (
        <>
          <Mic className="mr-2 h-4 w-4" />
          Voice Note
        </>
      )}
    </Button>
  )
}
```

**Voice note display (apps/web/src/components/VoiceNotePlayer.tsx)**

```tsx
import { useState, useRef } from 'react'
import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceNotePlayerProps {
  audioUrl: string
  transcription: string
  duration: number
}

export function VoiceNotePlayer({ audioUrl, transcription, duration }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  function togglePlayback() {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }

    setIsPlaying(!isPlaying)
  }

  return (
    <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
      <Button size="sm" variant="ghost" className="shrink-0" onClick={togglePlayback}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="flex-1">
        <p className="text-sm">{transcription}</p>
        <p className="mt-1 text-xs text-gray-500">{duration}s</p>
      </div>

      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
    </div>
  )
}
```

#### Transcription Service

**Option 1: Browser Web Speech API (Free, client-side)**

```typescript
// apps/web/src/services/transcription.ts
export function transcribeAudio(audioBlob: Blob): Promise<{ text: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    const recognition = new (window as any).webkitSpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const result = event.results[0][0]
      resolve({
        text: result.transcript,
        confidence: result.confidence,
      })
    }

    recognition.onerror = (event: any) => {
      reject(new Error(event.error))
    }

    // Convert blob to audio element
    const audio = new Audio(URL.createObjectURL(audioBlob))
    audio.onloadedmetadata = () => {
      recognition.start()
      audio.play()
    }
  })
}
```

**Option 2: OpenAI Whisper API (Paid, server-side, higher accuracy)**

```typescript
// apps/api/src/services/transcription.ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(
  audioBuffer: Buffer
): Promise<{ text: string; confidence: number }> {
  const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'en',
  })

  return {
    text: transcription.text,
    confidence: 0.95, // Whisper doesn't return confidence, use fixed value
  }
}
```

### Success Metrics

- **Adoption rate:** 30%+ of users try voice notes
- **Session note completion:** +50% (voice vs. typed)
- **Average note length:** 3x longer (voice vs. typed)

---

## Implementation Checklist

### Week 1: Database + Backend

- [ ] Run all SQL migrations
- [ ] Implement trial routes (`/subscriptions/start-trial`, `/subscriptions/trial-status`)
- [ ] Implement streak routes (`/streaks/current`, `/streaks/record-activity`)
- [ ] Set up BullMQ jobs (trial expiration, streak reminders)
- [ ] Generate VAPID keys + configure web-push
- [ ] Implement push notification routes (`/notifications/subscribe`, `/notifications/preferences`)
- [ ] Set up voice note upload + Supabase Storage
- [ ] Choose transcription provider (Web Speech API or Whisper)
- [ ] Write unit tests (Vitest) for all new routes

### Week 2: Frontend Core

- [ ] Build TrialBanner component
- [ ] Build TrialStartModal (triggered on signup)
- [ ] Build StreakWidget component
- [ ] Build StreakBrokenModal
- [ ] Implement usePushNotifications hook
- [ ] Create NotificationSettings page
- [ ] Build service worker (sw.js) for push handling
- [ ] Implement useVoiceRecorder hook
- [ ] Build VoiceNoteButton component
- [ ] Build VoiceNotePlayer component

### Week 3: Integration + Polish

- [ ] Add TrialBanner to dashboard layout
- [ ] Show TrialStartModal on first login (onboarding)
- [ ] Add StreakWidget to dashboard sidebar
- [ ] Integrate `record-activity` call on session create, flow create, extension usage
- [ ] Add push notification prompts (Settings page, after trial starts)
- [ ] Add VoiceNoteButton to session detail pages
- [ ] Display voice notes in session timeline
- [ ] Set up email templates (trial reminders, streak milestones)
- [ ] Configure notification triggers (jackpot spikes, ToS changes, outages)

### Week 4: Testing + Launch

- [ ] Manual E2E testing for all 4 features
- [ ] Test trial expiration flow (change date in DB to tomorrow, verify conversion)
- [ ] Test streak breakage + freeze credits
- [ ] Test push notifications on Chrome, Firefox, Edge
- [ ] Test voice recording on desktop + mobile browsers
- [ ] Load testing: 1,000 trial starts, 10,000 streak updates, 5,000 push sends
- [ ] Verify BullMQ jobs running (check Redis queue)
- [ ] Analytics instrumentation (PostHog events)
- [ ] Soft launch: Enable for 10% of users
- [ ] Monitor metrics for 3 days
- [ ] Full launch: Enable for all users

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// apps/api/src/routes/__tests__/subscriptions.test.ts
describe('POST /subscriptions/start-trial', () => {
  it('should create trial subscription', async () => {
    const response = await request(app)
      .post('/subscriptions/start-trial')
      .send({ userId: testUser.id, plan: 'pro' })

    expect(response.status).toBe(200)
    expect(response.body.data.daysRemaining).toBe(14)
  })

  it('should prevent duplicate trials', async () => {
    // Create first trial
    await createTrial(testUser.id)

    // Attempt second trial
    const response = await request(app)
      .post('/subscriptions/start-trial')
      .send({ userId: testUser.id })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('trial_already_used')
  })
})

// apps/api/src/routes/__tests__/streaks.test.ts
describe('POST /streaks/record-activity', () => {
  it('should increment streak on consecutive day', async () => {
    await db.userStreaks.insert({
      user_id: testUser.id,
      current_streak: 5,
      longest_streak: 10,
      last_activity_date: yesterday(),
    })

    const response = await request(app)
      .post('/streaks/record-activity')
      .send({ userId: testUser.id })

    expect(response.body.data.currentStreak).toBe(6)
  })

  it('should reset streak after gap', async () => {
    await db.userStreaks.insert({
      user_id: testUser.id,
      current_streak: 15,
      longest_streak: 20,
      last_activity_date: threeDaysAgo(),
    })

    const response = await request(app)
      .post('/streaks/record-activity')
      .send({ userId: testUser.id })

    expect(response.body.data.currentStreak).toBe(1)
    expect(response.body.data.streakBroken).toBe(true)
  })
})
```

### Manual E2E Testing

1. **Trial flow:**
   - Sign up new account
   - Verify TrialStartModal appears
   - Start trial
   - Verify TrialBanner shows 14 days
   - Access Pro feature (flow automation)
   - Fast-forward DB date to day 12
   - Verify TrialBanner shows 2 days (red urgency)
   - Fast-forward to day 15
   - Verify trial expired, downgraded to free

2. **Streak flow:**
   - Track session today → verify 1-day streak
   - Track session tomorrow → verify 2-day streak
   - Skip day → verify streak reset to 1
   - Reach 7-day milestone → verify achievement notification

3. **Push notifications:**
   - Go to Settings → Notifications
   - Click "Enable"
   - Grant browser permission
   - Trigger jackpot spike (manually insert DB row)
   - Verify push notification received
   - Click notification → verify redirects to platform page

4. **Voice notes:**
   - Open session detail page
   - Click "Voice Note" button
   - Allow microphone access
   - Record 10-second note: "Big win on Divine Fortune"
   - Stop recording
   - Wait for transcription
   - Verify transcription accuracy
   - Play voice note → verify audio playback

---

## Success Criteria

### Feature 1: 14-Day Trial

- ✅ Trial conversion rate: 40%+
- ✅ Trial cancellation rate: <15%
- ✅ Revenue impact: +$42K/month (300 trials × 40% × $29.99)

### Feature 2: Daily Streaks

- ✅ DAU increase: +25%
- ✅ 7-day retention: +40%
- ✅ Average streak length: 12 days

### Feature 3: Push Notifications

- ✅ Opt-in rate: 40%+
- ✅ Click-through rate: 25%
- ✅ Re-engagement: Users return within 5 minutes of notification

### Feature 4: Voice Notes

- ✅ Adoption: 30%+ try voice notes within 7 days
- ✅ Session completion: +50% (voice vs. typed)
- ✅ Note length: 3x longer on average

---

## Timeline

| Day   | Tasks                               | Deliverables                           |
| ----- | ----------------------------------- | -------------------------------------- |
| 1-2   | Database migrations + trial backend | Trial routes working in Postman        |
| 3-4   | Streak backend + BullMQ jobs        | Streak routes working + job scheduler  |
| 5-6   | Push notifications backend + VAPID  | Push routes + web-push configured      |
| 7     | Voice notes backend + transcription | Voice upload + transcription working   |
| 8-9   | Trial + streak frontend components  | TrialBanner, StreakWidget rendered     |
| 10-11 | Push frontend + service worker      | Push notifications working in browser  |
| 12    | Voice frontend components           | Voice recorder + player working        |
| 13-14 | Integration + polish                | All features connected, no blockers    |
| 15-16 | Testing + bug fixes                 | E2E tests pass, analytics instrumented |
| 17    | Soft launch (10%)                   | Monitor metrics for 3 days             |
| 20    | Full launch (100%)                  | All users have access                  |

---

## Notes

- **Trial billing:** Use Stripe Checkout with `trial_period_days: 14` to automate conversion
- **Streak freezes:** Award 3 freeze credits per month to Pro subscribers (upsell opportunity)
- **Push notification rate limiting:** Max 5 notifications per user per day (avoid spam)
- **Voice note storage:** Supabase Storage free tier = 1GB. Monitor usage after 10K voice notes.
- **Transcription cost:** Whisper = $0.006/minute. 1,000 voice notes × 30s avg = $3. Budget $50/month initially.

---

**Deploy these 4 features within 5 days for immediate conversion + engagement boost. These are the highest ROI features from the competitive analysis.**
