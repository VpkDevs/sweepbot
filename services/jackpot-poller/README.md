# SweepBot Jackpot Poller

**Critical data collection service** — Captures progressive jackpot values every 60 seconds across 20+ sweepstakes casino platforms.

## Why This Matters

Progressive jackpots reset to zero when hit. If we don't capture the value at the moment of hit, that data is **gone forever**. A competitor starting 6 months later will always be 6 months behind.

**Business Impact:**

- Month 1: Basic jackpot trends feature
- Month 3: "When to Play" timing intelligence
- Month 6: Jackpot prediction model (ML)
- Year 1: Quarterly industry reports ($299/copy)
- Year 2: B2B data licensing ($10K+/platform/year)

## Quick Start (Replit)

1. **Create new Repl:**
   - Language: Python
   - Template: Blank
   - Name: `sweepbot-jackpot-poller`

2. **Upload files:**
   - `poller.py`
   - `requirements.txt`
   - `.env` (create from `.env.example`)

3. **Set environment variables:**

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Run:**

   ```bash
   python poller.py
   ```

5. **Keep alive:** Enable "Always On" in Replit (requires Hacker plan)

## Database Requirements

The poller requires these tables to exist in Supabase:

### `platforms` table

```sql
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  -- other fields...
);
```

### `jackpot_snapshots` table (partitioned)

```sql
CREATE TABLE jackpot_snapshots (
  id UUID DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  game_name TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'SC',
  game_id TEXT,
  jackpot_type TEXT DEFAULT 'progressive',
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

-- Create quarterly partitions
CREATE TABLE jackpot_snapshots_2026_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE jackpot_snapshots_2026_q2 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

-- Add index for fast queries
CREATE INDEX idx_jackpot_snapshots_platform_game 
  ON jackpot_snapshots(platform_id, game_name, captured_at DESC);
```

## Configuration

### Adding New Platforms

Edit `PLATFORMS` array in `poller.py`:

```python
{
    'slug': 'new-platform',           # Must match DB slug
    'name': 'New Platform',
    'jackpot_url': 'https://api.example.com/jackpots',
    'parser': 'generic_json',         # or custom parser function
    'requires_auth': False
}
```

### Custom Parsers

If a platform has a unique API response format:

```python
def parse_custom_platform(data: Dict, platform_slug: str) -> List[Dict]:
    jackpots = []
    # Custom parsing logic
    for game in data['customField']['games']:
        jackpots.append({
            'platform_slug': platform_slug,
            'game_name': game['title'],
            'value': float(game['jackpotAmount']),
            'currency': 'SC',
            'captured_at': datetime.now(timezone.utc).isoformat()
        })
    return jackpots

# Then reference in PLATFORMS config
'parser': 'custom_platform'
```

## Monitoring

### Check Health

```bash
# View logs in Replit console
# Look for: "✓ Found X jackpots from Platform"
```

### Alert on Failures
Set up Sentry (optional):

```python
import sentry_sdk
sentry_sdk.init(dsn=os.environ.get('SENTRY_DSN'))
```

### Query Collected Data
```sql
-- Total snapshots collected
SELECT COUNT(*) FROM jackpot_snapshots;

-- Snapshots per platform (last 24 hours)
SELECT p.name, COUNT(*) as snapshots
FROM jackpot_snapshots js
JOIN platforms p ON p.id = js.platform_id
WHERE js.captured_at > NOW() - INTERVAL '24 hours'
GROUP BY p.name
ORDER BY snapshots DESC;

-- Highest jackpot ever recorded
SELECT p.name, js.game_name, MAX(js.value) as max_value
FROM jackpot_snapshots js
JOIN platforms p ON p.id = js.platform_id
GROUP BY p.name, js.game_name
ORDER BY max_value DESC
LIMIT 10;
```

## Cost Optimization

**Replit Always On:** $20/month
**Supabase:** Free tier (up to 500MB, 2GB transfer)
**Estimated data:** ~1MB per day = 30MB/month (well within free tier)

**Total cost:** $20/month for irreplaceable data moat

## Troubleshooting

### "Platform not found in DB"
Run this query to seed platforms:
```sql
INSERT INTO platforms (slug, name) VALUES
  ('chumba-casino', 'Chumba Casino'),
  ('stake-us', 'Stake.us'),
  ('pulsz', 'Pulsz'),
  ('luckylandslots', 'LuckyLand Slots'),
  ('wow-vegas', 'WOW Vegas');
```

### "Connection refused" errors
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Verify Supabase project is not paused (free tier pauses after 1 week inactivity)

### Rate limiting
- Current delay: 1 second between platforms
- Increase if needed: `time.sleep(2)`

## Production Improvements

Before scaling beyond 20 platforms:

1. **Add retry logic with exponential backoff**
2. **Implement circuit breakers for failing platforms**
3. **Add Prometheus metrics** (requests/sec, errors, latency)
4. **Set up alerting** (PagerDuty, Opsgenie)
5. **Deploy to Railway or Fly.io** (more reliable than Replit for production)

## Next Steps

Once data collection is running:

1. **Week 1:** Verify 7 days of continuous data
2. **Week 2:** Build jackpot history API endpoint
3. **Week 4:** Launch "Jackpot Trends" feature in dashboard
4. **Month 3:** Train ML prediction model
5. **Month 6:** Launch "Optimal Play Timing" alerts

---

**⚠️ Deploy this TODAY.** Every day without data collection is a permanent competitive disadvantage.
