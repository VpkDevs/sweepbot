# SweepBot Terms of Service Monitor

**Critical compliance service** — Tracks daily changes to platform ToS and creates alerts for important modifications.

## Why This Matters

Platforms change their Terms of Service to claw back player advantages, add restrictions, or modify redemption policies. **Historical ToS data cannot be reconstructed** — if you start monitoring today, you'll never know what the ToS said yesterday.

**Business Impact:**

- **Trust Index component:** ToS stability score (fewer changes = higher trust)
- **User engagement:** Email alerts drive daily active usage
- **Legal protection:** Historical record for disputes
- **Media stories:** "This platform changed withdrawal limits 4x in 6 months"
- **Regulatory value:** Provide ToS history to state attorneys general

## Quick Start (Replit)

1. **Create new Repl:**
   - Language: Python
   - Template: Blank
   - Name: `sweepbot-tos-monitor`

2. **Upload files:**
   - `monitor.py`
   - `requirements.txt`
   - `.env` (create from `.env.example`)

3. **Set environment variables:**

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   RUN_ONCE=true  # For initial test, remove after
   ```

4. **Test run:**

   ```bash
   python monitor.py
   ```

5. **Production:** Remove `RUN_ONCE` env var, enable "Always On"

## Database Requirements

### `tos_snapshots` table

```sql
CREATE TABLE tos_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_length INTEGER,
  change_detected BOOLEAN DEFAULT FALSE,
  change_summary JSONB,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_tos_snapshots_platform_time
  ON tos_snapshots(platform_id, captured_at DESC);

CREATE INDEX idx_tos_snapshots_changes
  ON tos_snapshots(platform_id, change_detected)
  WHERE change_detected = TRUE;
```

### `platform_alerts` table

```sql
CREATE TABLE platform_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  alert_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_platform_alerts_platform
  ON platform_alerts(platform_id, created_at DESC);
```

## How It Works

1. **Daily check:** Runs at 00:00 UTC every day
2. **Fetch ToS:** Downloads ToS HTML from each platform
3. **Extract text:** Parses HTML, extracts clean text
4. **Compute hash:** SHA-256 hash for quick change detection
5. **Compare:** Checks if hash differs from previous snapshot
6. **Analyze:** If changed, performs line-by-line diff
7. **Keyword scan:** Detects important terms (withdrawal, wagering, etc.)
8. **Alert:** Creates alert if important keywords found in changes
9. **Save:** Stores new snapshot with diff summary

## Configuration

### Adding Platforms

Edit `PLATFORMS` array in `monitor.py`:

```python
{
    'slug': 'new-platform',
    'name': 'New Platform',
    'tos_url': 'https://example.com/terms',
    'content_selector': '.terms-content'  # CSS selector for main content
}
```

### Important Keywords

Edit `IMPORTANT_KEYWORDS` list to catch specific terms:

```python
IMPORTANT_KEYWORDS = [
    'withdrawal', 'redeem', 'wagering', 'bonus',
    'verification', 'suspend', 'ban', 'dispute',
    # Add platform-specific terms
]
```

## Monitoring

### Check Status

```sql
-- Recent snapshots
SELECT p.name, ts.captured_at, ts.change_detected, ts.content_length
FROM tos_snapshots ts
JOIN platforms p ON p.id = ts.platform_id
ORDER BY ts.captured_at DESC
LIMIT 20;

-- Platforms with changes
SELECT p.name, COUNT(*) as change_count
FROM tos_snapshots ts
JOIN platforms p ON p.id = ts.platform_id
WHERE ts.change_detected = TRUE
GROUP BY p.name
ORDER BY change_count DESC;

-- Recent alerts
SELECT p.name, pa.severity, pa.title, pa.created_at
FROM platform_alerts pa
JOIN platforms p ON p.id = pa.platform_id
WHERE pa.alert_type = 'tos_change'
ORDER BY pa.created_at DESC
LIMIT 10;
```

### View Change Diffs

```sql
-- Get change summary for a specific snapshot
SELECT
  p.name,
  ts.captured_at,
  ts.change_summary->>'important_keywords' as keywords,
  ts.change_summary->>'additions_count' as additions,
  ts.change_summary->>'removals_count' as removals
FROM tos_snapshots ts
JOIN platforms p ON p.id = ts.platform_id
WHERE ts.change_detected = TRUE
ORDER BY ts.captured_at DESC;
```

## Email Alerts Integration

Once alerts are created, send emails to affected users:

```python
# apps/api/src/services/email-service.ts
async function sendToSAlerts() {
  const alerts = await db.platformAlerts
    .where('alert_type', 'tos_change')
    .where('dismissed', false)
    .where('created_at', '>', new Date(Date.now() - 24*60*60*1000));

  for (const alert of alerts) {
    const users = await db.users
      .where('platforms', 'contains', alert.platformId);

    for (const user of users) {
      await resend.emails.send({
        to: user.email,
        subject: `⚠️ ${platform.name} Terms Updated`,
        html: renderToSChangeEmail(alert)
      });
    }
  }
}
```

## Troubleshooting

### "Could not find content selector"

Update the CSS selector for that platform:

```python
'content_selector': 'main'  # Try more generic selectors
```

### Partial content extracted

Some platforms load ToS dynamically via JavaScript. Options:

1. Use Playwright/Puppeteer for JS-rendered content
2. Find API endpoint that returns ToS as JSON
3. Contact platform for static ToS URL

### Too many false positives

Filter out insignificant changes:

```python
# Ignore changes with < 10 lines modified
if change_summary['total_diff_lines'] < 10:
    return {'status': 'minor_change'}
```

## Production Improvements

1. **Intelligent scheduling:** Check high-risk platforms more frequently
2. **AI summarization:** Use Claude API to generate plain-English summaries
3. **Multi-language support:** Detect language, translate summaries
4. **Screenshot comparison:** Visual diff for platforms that render ToS client-side
5. **Blockchain anchoring:** Timestamp snapshots on-chain for legal validity

## Cost

- **Replit Always On:** $20/month
- **Supabase storage:** ~10KB per snapshot × 30 platforms × 365 days = ~110MB/year (free tier)
- **Total:** $20/month

## Next Steps

1. **Week 1:** Collect 7 days of baseline
   snapshots
2. **Week 2:** Implement email alert system
3. **Month 1:** Add ToS stability score to Trust Index
4. **Month 3:** Build public "ToS Change History" pages (SEO gold)
5. **Month 6:** Pitch ToS data to regulators/media

---

**⚠️ Deploy alongside jackpot poller.** Same infrastructure, minimal added cost, irreplaceable data.
