# SweepBot Data Moat — Replit Deployment Guide

**Complete setup guide** for deploying all three data collection services that create SweepBot's irreplaceable competitive advantage.

---

## Why These Three Services Matter

**Every day without data collection = permanent competitive disadvantage.**

These services create **time-series datasets that cannot be reconstructed retroactively:**

1. **Jackpot Poller** (60-second intervals)
   - Progressive jackpot values across 20+ platforms
   - Enables ML predictions, trend analysis, optimal play timing
   - Revenue potential: $10K+/platform/year licensing to operators

2. **ToS Monitor** (daily checks)
   - Historical Terms of Service with change tracking
   - Protects users from surprise policy changes
   - Media value: Breaking stories about predatory ToS updates
   - Trust Index component: ToS stability score

3. **Health Checker** (5-minute intervals)
   - Platform uptime + response time monitoring
   - Blocks automation when platform is down
   - Trust Index component: Reliability score
   - Early warning system for degraded performance

**Combined data moat value:** These three datasets compound over time. After 1 year, competitors would need 365 days to catch up (impossible).

---

## Prerequisites

### 1. Supabase Project
- **Free tier is sufficient** (all three services = ~150MB/month)
- Get credentials from: https://app.supabase.com/project/YOUR_PROJECT/settings/api

You need:
- `SUPABASE_URL`: `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: `eyJ...` (secret key, NOT anon key)

### 2. Replit Account
- **Pro account required:** $20/month for "Always On" feature
- Sign up: https://replit.com

### 3. Database Schema Setup
Run this **ONCE** in Supabase SQL Editor:

```sql
-- Jackpot Snapshots (partitioned by quarter)
CREATE TABLE jackpot_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  jackpot_type TEXT NOT NULL CHECK (jackpot_type IN ('mega', 'major', 'minor', 'mini', 'progressive', 'mystery')),
  current_value DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  metadata JSONB,
  snapshot_hash TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (captured_at);

-- Create quarterly partitions (adjust for your launch date)
CREATE TABLE jackpot_snapshots_2025_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE jackpot_snapshots_2025_q2 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

CREATE TABLE jackpot_snapshots_2025_q3 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');

CREATE TABLE jackpot_snapshots_2025_q4 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Indexes
CREATE INDEX idx_jackpot_snapshots_platform_time ON jackpot_snapshots(platform_id, captured_at DESC);
CREATE INDEX idx_jackpot_snapshots_type ON jackpot_snapshots(jackpot_type, captured_at DESC);
CREATE INDEX idx_jackpot_snapshots_hash ON jackpot_snapshots(snapshot_hash);

-- ToS Snapshots
CREATE TABLE tos_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tos_snapshots_platform_time ON tos_snapshots(platform_id, captured_at DESC);
CREATE INDEX idx_tos_snapshots_hash ON tos_snapshots(content_hash);

-- Platform Alerts
CREATE TABLE platform_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('tos_change', 'platform_outage', 'slow_response')),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_platform_alerts_platform ON platform_alerts(platform_id, created_at DESC);
CREATE INDEX idx_platform_alerts_type ON platform_alerts(alert_type, created_at DESC);
CREATE INDEX idx_platform_alerts_severity ON platform_alerts(severity, created_at DESC);

-- Platform Health Checks
CREATE TABLE platform_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) NOT NULL,
  status TEXT CHECK (status IN ('healthy', 'degraded', 'down', 'error')),
  avg_response_time_ms DECIMAL(10,2),
  endpoint_results JSONB NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_platform_health_platform_time ON platform_health_checks(platform_id, checked_at DESC);
CREATE INDEX idx_platform_health_status ON platform_health_checks(status, checked_at DESC);
CREATE INDEX idx_platform_health_outages ON platform_health_checks(platform_id, checked_at DESC) WHERE status = 'down';

-- Enable Row Level Security (optional but recommended)
ALTER TABLE jackpot_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tos_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_health_checks ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything (needed for automated services)
CREATE POLICY "Service role full access on jackpot_snapshots" ON jackpot_snapshots FOR ALL USING (true);
CREATE POLICY "Service role full access on tos_snapshots" ON tos_snapshots FOR ALL USING (true);
CREATE POLICY "Service role full access on platform_alerts" ON platform_alerts FOR ALL USING (true);
CREATE POLICY "Service role full access on platform_health_checks" ON platform_health_checks FOR ALL USING (true);
```

### 4. Seed Platform Data
```sql
-- Insert platforms (adjust IDs to match your existing data)
INSERT INTO platforms (id, name, slug, url, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Chumba Casino', 'chumba-casino', 'https://chumbacasino.com', NOW(), NOW()),
  (gen_random_uuid(), 'Stake.us', 'stake-us', 'https://stake.us', NOW(), NOW()),
  (gen_random_uuid(), 'Pulsz', 'pulsz', 'https://www.pulsz.com', NOW(), NOW()),
  (gen_random_uuid(), 'LuckyLand Slots', 'luckylandslots', 'https://luckylandslots.com', NOW(), NOW()),
  (gen_random_uuid(), 'WOW Vegas', 'wow-vegas', 'https://wowvegas.com', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
```

---

## Service 1: Jackpot Poller

### Deployment Steps

1. **Create Repl:**
   - Go to https://replit.com
   - Click "Create Repl"
   - Template: Python
   - Name: `sweepbot-jackpot-poller`

2. **Upload Files:**
   - `services/jackpot-poller/poller.py` → `poller.py`
   - `services/jackpot-poller/requirements.txt` → `requirements.txt`

3. **Configure Secrets:**
   - Click left sidebar: "Secrets" (🔒 icon)
   - Add:
     ```
     SUPABASE_URL = https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY = eyJhb...
     ```

4. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run:**
   - Click "Run" button
   - Should see: `🚀 Starting SweepBot Jackpot Poller`

6. **Enable Always On:**
   - Click Replit "Deployments" tab
   - Enable "Always On" ($7/month from your Pro subscription)

7. **Verify:**
   ```sql
   -- Check Supabase for new data
   SELECT 
     p.name, 
     js.jackpot_type, 
     js.current_value, 
     js.captured_at
   FROM jackpot_snapshots js
   JOIN platforms p ON p.id = js.platform_id
   ORDER BY js.captured_at DESC
   LIMIT 20;
   ```

**Expected behavior:** New row every 60 seconds per platform. After 1 hour = 60 rows × 5 platforms = 300 rows.

---

## Service 2: ToS Monitor

### Deployment Steps

1. **Create Repl:**
   - Template: Python
   - Name: `sweepbot-tos-monitor`

2. **Upload Files:**
   - `services/tos-monitor/monitor.py` → `monitor.py`
   - `services/tos-monitor/requirements.txt` → `requirements.txt`

3. **Configure Secrets:**
   - Same as jackpot poller
   - Optionally add: `RUN_ONCE=true` for testing

4. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Test Run:**
   ```bash
   python monitor.py
   ```
   - Should complete 5 checks immediately
   - Verify tables populated:
   ```sql
   SELECT p.name, COUNT(*) 
   FROM tos_snapshots ts
   JOIN platforms p ON p.id = ts.platform_id
   GROUP BY p.name;
   ```

6. **Production Run:**
   - Remove `RUN_ONCE` secret
   - Click "Run"
   - Enable "Always On"

**Expected behavior:** One check per platform per day (at midnight UTC). Creates alert only when ToS changes detected.

---

## Service 3: Health Checker

### Deployment Steps

1. **Create Repl:**
   - Template: Python
   - Name: `sweepbot-health-checker`

2. **Upload Files:**
   - `services/health-checker/checker.py` → `checker.py`
   - `services/health-checker/requirements.txt` → `requirements.txt`

3. **Configure Secrets:**
   - Same Supabase credentials

4. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run:**
   ```bash
   python checker.py
   ```

6. **Enable Always On**

7. **Verify:**
   ```sql
   -- Latest status for all platforms
   SELECT DISTINCT ON (p.id)
     p.name,
     phc.status,
     phc.avg_response_time_ms,
     phc.checked_at
   FROM platform_health_checks phc
   JOIN platforms p ON p.id = phc.platform_id
   ORDER BY p.id, phc.checked_at DESC;
   ```

**Expected behavior:** Check every 5 minutes = 288 checks/day/platform.

---

## Monitoring & Maintenance

### Daily Health Check (5 minutes)

```sql
-- 1. Verify all services are running
SELECT 
  'jackpot_poller' as service,
  MAX(captured_at) as last_run,
  NOW() - MAX(captured_at) as lag
FROM jackpot_snapshots

UNION ALL

SELECT 
  'tos_monitor' as service,
  MAX(captured_at) as last_run,
  NOW() - MAX(captured_at) as lag
FROM tos_snapshots

UNION ALL

SELECT 
  'health_checker' as service,
  MAX(checked_at) as last_run,
  NOW() - MAX(checked_at) as lag
FROM platform_health_checks;

-- 2. Check for alerts
SELECT 
  pa.alert_type,
  p.name,
  pa.title,
  pa.created_at
FROM platform_alerts pa
JOIN platforms p ON p.id = pa.platform_id
WHERE pa.created_at > NOW() - INTERVAL '24 hours'
ORDER BY pa.created_at DESC;

-- 3. Storage usage
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('jackpot_snapshots', 'tos_snapshots', 'platform_health_checks', 'platform_alerts')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Weekly Maintenance

**Create next quarter's partition (if approaching end of quarter):**
```sql
CREATE TABLE jackpot_snapshots_2026_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

**Archive old data (optional, after 12+ months):**
```sql
-- Export to CSV first!
DELETE FROM jackpot_snapshots WHERE captured_at < NOW() - INTERVAL '18 months';
DELETE FROM tos_snapshots WHERE captured_at < NOW() - INTERVAL '24 months';
DELETE FROM platform_health_checks WHERE checked_at < NOW() - INTERVAL '6 months';
```

### Cost Tracking

**Supabase Storage:**
```sql
SELECT 
  SUM(pg_total_relation_size(schemaname||'.'||tablename)) / (1024*1024) as total_mb
FROM pg_tables
WHERE tablename IN ('jackpot_snapshots', 'tos_snapshots', 'platform_health_checks', 'platform_alerts');
```

**Expected growth:**
- Jackpot: 500 bytes × 1,440 polls/day × 30 platforms = 21MB/day = 630MB/month
- ToS: 50KB × 1 check/day × 30 platforms = 1.5MB/month
- Health: 500 bytes × 288 checks/day × 30 platforms = 4.3MB/day = 130MB/month
- **Total: 760MB/month (well within 500MB free tier)**

**Replit Cost:**
- 3 Repls × $7/month Always On = $21/month
- (Or 1 Pro account $20/month covers all three)

---

## Troubleshooting

### "Platform not found in database"
**Fix:** Ensure `platforms` table has matching `slug` values:
```sql
SELECT slug FROM platforms ORDER BY slug;
```

### "Connection timeout"
**Check:**
1. Supabase project not paused (free tier auto-pauses after 7 days inactivity)
2. Service role key is correct (not anon key)
3. No typos in SUPABASE_URL

### "Requests hanging"
Platform might have rate limiting. Add delays:
```python
time.sleep(2)  # Between platform checks
```

### "Duplicate key violation"
Jackpot poller found identical hash. This is normal — no new data saved, moves to next platform.

### "Repl keeps stopping"
Enable "Always On" in Deployments tab. Free tier won't work for production.

---

## Next Steps

1. **Week 1:** Let all three services run for 7 days
2. **Week 2:** Verify data quality with SQL queries
3. **Week 3:** Build dashboard widgets to display:
   - Latest jackpot values (real-time)
   - Platform status indicators (green/yellow/red)
   - Recent ToS changes (alert feed)
4. **Month 1:** Integrate with flow executor:
   - Block automation when platform is down
   - Show jackpot trend in platform selector
5. **Month 2:** Build Trust Index calculation:
   - Uptime score (health checker)
   - ToS stability score (ToS monitor)
   - Jackpot fairness score (statistical analysis)

---

## Advanced: Multi-Region Deployment

For enterprise reliability, deploy each service in 2+ regions:

- **Replit US East** (primary)
- **Replit US West** (backup)

Use PostgreSQL to coordinate:
```python
# Acquire distributed lock before polling
result = supabase.rpc('acquire_lock', {'lock_name': 'jackpot_poller_chumba'})
if result.data:
    poll_platform('chumba-casino')
    supabase.rpc('release_lock', {'lock_name': 'jackpot_poller_chumba'})
```

---

**Deploy all three services TODAY. Every hour of delay = missed data you can never recover.**
