# SweepBot Platform Health Checker

**Real-time monitoring service** — Checks platform availability, response times, and login accessibility every 5 minutes.

## Why This Matters

Users need to know if a platform is down before attempting automation. Uptime data feeds the Trust Index. Response time trends can predict platform issues before they become outages.

**Business Impact:**
- **Trust Index component:** Uptime score (higher uptime = higher trust)
- **User experience:** Block automation attempts when platform is down
- **Early warning:** Detect degraded performance before full outage
- **Competitive intelligence:** Track platform reliability trends
- **Operations:** Dashboard widget showing real-time status

## Quick Start (Replit)

1. **Create new Repl:**
   - Language: Python
   - Template: Blank
   - Name: `sweepbot-health-checker`

2. **Upload files:**
   - `checker.py`
   - `requirements.txt`
   - `.env` (create from `.env.example`)

3. **Set environment variables:**
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Run:**
   ```bash
   python checker.py
   ```

5. **Keep alive:** Enable "Always On" in Replit

## Database Requirements

### `platform_health_checks` table
```sql
CREATE TABLE platform_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  status TEXT CHECK (status IN ('healthy', 'degraded', 'down', 'error')),
  avg_response_time_ms DECIMAL(10,2),
  endpoint_results JSONB NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_platform_health_platform_time 
  ON platform_health_checks(platform_id, checked_at DESC);

CREATE INDEX idx_platform_health_status 
  ON platform_health_checks(status, checked_at DESC);

-- Partial index for outages only
CREATE INDEX idx_platform_health_outages 
  ON platform_health_checks(platform_id, checked_at DESC)
  WHERE status = 'down';
```

### Add to existing `platform_alerts` table
Already created for ToS monitor. Reuses same schema.

## How It Works

1. **Every 5 minutes:**
   - Loop through all configured platforms
   - Check homepage, login page, API endpoint (if exists)
   - Record HTTP status code + response time

2. **Status determination:**
   - `healthy`: All endpoints return 200, response time < 3s
   - `degraded`: Endpoints return 200 but slow (>3s), or some 4xx errors
   - `down`: Timeout, connection refused, or 5xx errors
   - `error`: Unexpected exception

3. **Outage detection:**
   - Compare current status to previous 5 checks
   - If transition from healthy → down, create alert

4. **Data storage:**
   - Save all checks (288 per day per platform = 8,640 for 30 platforms)
   - Query for uptime % (last 24h, 7d, 30d)

## Configuration

### Adding Endpoints

Edit `PLATFORMS` array in `checker.py`:

```python
{
    'slug': 'new-platform',
    'name': 'New Platform',
    'urls': {
        'homepage': 'https://example.com',
        'login': 'https://example.com/login',
        'api': 'https://api.example.com/health'  # Optional
    },
    'expected_status': 200,
    'timeout': 10  # seconds
}
```

### Adjusting Check Frequency

Edit `CHECK_INTERVAL_SECONDS`:
```python
CHECK_INTERVAL_SECONDS = 300  # 5 minutes (default)
# Or: 60 for 1 minute (more granular, higher cost)
```

## Monitoring Queries

### Current Platform Status
```sql
-- Latest check for each platform
SELECT DISTINCT ON (p.id)
  p.name,
  phc.status,
  phc.avg_response_time_ms,
  phc.checked_at
FROM platform_health_checks phc
JOIN platforms p ON p.id = phc.platform_id
ORDER BY p.id, phc.checked_at DESC;
```

### Uptime Percentage (Last 24 Hours)
```sql
SELECT 
  p.name,
  COUNT(*) as total_checks,
  COUNT(CASE WHEN phc.status IN ('healthy', 'degraded') THEN 1 END) as successful_checks,
  ROUND(
    (COUNT(CASE WHEN phc.status IN ('healthy', 'degraded') THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as uptime_percentage
FROM platform_health_checks phc
JOIN platforms p ON p.id = phc.platform_id
WHERE phc.checked_at > NOW() - INTERVAL '24 hours'
GROUP BY p.name
ORDER BY uptime_percentage DESC;
```

### Slowest Platforms
```sql
SELECT 
  p.name,
  AVG(phc.avg_response_time_ms) as avg_response_time,
  MAX(phc.avg_response_time_ms) as max_response_time
FROM platform_health_checks phc
JOIN platforms p ON p.id = phc.platform_id
WHERE phc.checked_at > NOW() - INTERVAL '7 days'
  AND phc.status != 'error'
GROUP BY p.name
ORDER BY avg_response_time DESC;
```

### Recent Outages
```sql
SELECT 
  p.name,
  phc.status,
  phc.checked_at,
  phc.endpoint_results->>'error' as error_message
FROM platform_health_checks phc
JOIN platforms p ON p.id = phc.platform_id
WHERE phc.status = 'down'
  AND phc.checked_at > NOW() - INTERVAL '7 days'
ORDER BY phc.checked_at DESC;
```

## Integration with Flow Executor

Before running automation, check platform health:

```typescript
// apps/api/src/services/flow-executor.ts
async function canExecuteOnPlatform(platformId: string): Promise<boolean> {
  const latestCheck = await db.platformHealthChecks
    .where('platform_id', platformId)
    .orderBy('checked_at', 'desc')
    .first();
  
  if (!latestCheck) {
    return true; // No data, allow execution
  }
  
  // Block if platform is down
  if (latestCheck.status === 'down') {
    throw new Error('Platform is currently unreachable');
  }
  
  // Warn if degraded
  if (latestCheck.status === 'degraded') {
    logger.warn(`Platform ${platformId} is degraded (slow responses)`);
  }
  
  return true;
}
```

## Dashboard Widget

Real-time status display:

```typescript
// apps/web/src/components/PlatformStatusWidget.tsx
export function PlatformStatusWidget() {
  const { data: statuses } = useQuery({
    queryKey: ['platform-statuses'],
    queryFn: () => api.get('/platforms/health/current'),
    refetchInterval: 60000 // Refresh every minute
  });
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {statuses?.map(status => (
        <div key={status.platformId} className="flex items-center gap-2">
          <StatusIndicator status={status.status} />
          <span>{status.platformName}</span>
          <span className="text-xs text-gray-500">
            {status.avgResponseTimeMs}ms
          </span>
        </div>
      ))}
    </div>
  );
}
```

## Cost

- **Replit Always On:** $20/month
- **Database storage:** ~500 bytes × 288 checks/day × 30 platforms = 4.3MB/day = 130MB/month (free tier)
- **Total:** $20/month

## Advanced Features

### 1. Response Time Alerts
```python
if health_data['avg_response_time_ms'] > 3000:
    create_alert(platform_id, 'slow_response', 
                 f"Response time: {health_data['avg_response_time_ms']}ms")
```

### 2. Geographic Health Checks
Deploy multiple checkers in different regions (US East, US West, EU) to detect regional outages.

### 3. SSL Certificate Monitoring
```python
import ssl
import socket

def check_ssl_expiry(hostname):
    context = ssl.create_default_context()
    with socket.create_connection((hostname, 443)) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
            expires = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
            days_until_expiry = (expires - datetime.now()).days
            return days_until_expiry
```

### 4. Historical Uptime API Endpoint
```typescript
// apps/api/src/routes/platforms.ts
app.get('/platforms/:id/uptime', async (req, res) => {
  const { id } = req.params;
  const { period = '24h' } = req.query;
  
  const uptime = await calculateUptime(id, period);
  
  res.json({
    platformId: id,
    period,
    uptimePercentage: uptime,
    lastCheck: await getLatestCheck(id)
  });
});
```

## Next Steps

1. **Week 1:** Verify 7 days of continuous monitoring
2. **Week 2:** Add uptime to Trust Index calculation
3. **Week 3:** Build "Platform Status" dashboard page
4. **Month 1:** Integrate with flow executor (block runs when platform down)
5. **Month 2:** Add response time trend charts (detect degradation patterns)

---

**Deploy this NOW alongside jackpot poller and ToS monitor.** All three services share infrastructure and create a complete data moat.
