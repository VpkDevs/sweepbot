# SweepBot Database Migrations

SQL migration scripts for all data collection services and quick wins features.

## Migration Order

Run migrations in numerical order. Each migration is idempotent (safe to run multiple times).

### Data Collection Services (001-004)
1. `001_jackpot_snapshots.sql` - Progressive jackpot tracking (partitioned)
2. `002_tos_snapshots.sql` - Terms of Service monitoring
3. `003_platform_health_checks.sql` - Uptime and response time tracking
4. `004_platform_alerts.sql` - User-facing alert system

### Quick Wins Features (005-008)
5. `005_user_streaks.sql` - Daily activity streak gamification
6. `006_trial_system.sql` - 14-day free trial tracking
7. `007_push_notifications.sql` - Web Push subscriptions and preferences
8. `008_session_voice_notes.sql` - Voice recording with transcription

## Running Migrations

### Option 1: Supabase SQL Editor (Recommended)

1. Go to https://app.supabase.com/project/YOUR_PROJECT/sql/new
2. Copy/paste each migration file content
3. Click "Run"
4. Verify success (no errors in output)

### Option 2: psql Command Line

```bash
# Set connection string
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Run all migrations
for file in services/migrations/*.sql; do
  echo "Running $file..."
  psql $DATABASE_URL -f $file
done
```

### Option 3: Supabase CLI

```bash
# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Verification Queries

After running migrations, verify tables exist:

```sql
-- Check all tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'jackpot_snapshots',
    'tos_snapshots',
    'platform_health_checks',
    'platform_alerts',
    'user_streaks',
    'streak_milestones',
    'trial_events',
    'push_subscriptions',
    'notification_preferences',
    'session_notes'
  )
ORDER BY table_name;

-- Check partitions created
SELECT 
  parent.relname AS parent_table,
  child.relname AS partition_name
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'jackpot_snapshots'
ORDER BY child.relname;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('jackpot_snapshots', 'tos_snapshots', 'platform_health_checks')
ORDER BY tablename, indexname;

-- Check RLS enabled
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%snapshot%' OR tablename LIKE '%health%' OR tablename LIKE '%streak%'
ORDER BY tablename;
```

## Storage Requirements

Expected database growth after 1 year:

| Table | Daily Growth | Monthly | Yearly | Notes |
|-------|--------------|---------|--------|-------|
| jackpot_snapshots | 21 MB | 630 MB | 7.6 GB | 30 platforms × 1440 checks/day |
| tos_snapshots | 1.5 MB | 45 MB | 540 MB | Daily checks, full text storage |
| platform_health_checks | 4.3 MB | 130 MB | 1.6 GB | 288 checks/day/platform |
| platform_alerts | ~1 MB | 30 MB | 360 MB | Estimated 100 alerts/day |
| user_streaks | < 1 MB | < 1 MB | < 1 MB | One row per user |
| push_subscriptions | < 1 MB | < 1 MB | < 1 MB | ~2 devices per user |
| session_notes | Variable | Variable | Variable | Depends on voice note usage |
| **Total** | **28 MB** | **836 MB** | **10 GB** | **Well within free tier limits** |

Supabase free tier: 500 MB database + 1 GB file storage.  
Upgrade to Pro ($25/month) when approaching limits (~18 months).

## Partition Maintenance

Create new quarterly partitions 2 weeks before quarter end:

```sql
-- Example: Create Q1 2027 partition
CREATE TABLE jackpot_snapshots_2027_q1 PARTITION OF jackpot_snapshots
  FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');
```

Add this to calendar reminders:
- March 15 → Create Q2 partition
- June 15 → Create Q3 partition
- September 15 → Create Q4 partition
- December 15 → Create Q1 next year partition

## Data Archival

After 12-18 months, consider archiving old data to cold storage:

```sql
-- Export old partitions to CSV (backup first!)
COPY (SELECT * FROM jackpot_snapshots_2025_q1) 
TO '/tmp/jackpot_snapshots_2025_q1.csv' CSV HEADER;

-- Drop old partition (after backup verified)
DROP TABLE jackpot_snapshots_2025_q1;
```

## Rollback

To rollback a migration:

```sql
-- Drop tables (CAUTION: destroys data)
DROP TABLE IF EXISTS session_notes CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS trial_events CASCADE;
DROP TABLE IF EXISTS streak_milestones CASCADE;
DROP TABLE IF EXISTS user_streaks CASCADE;
DROP TABLE IF EXISTS platform_alerts CASCADE;
DROP TABLE IF EXISTS platform_health_checks CASCADE;
DROP TABLE IF EXISTS tos_snapshots CASCADE;
DROP TABLE IF EXISTS jackpot_snapshots CASCADE;
```

## Troubleshooting

### "relation already exists"
Migration is idempotent. This warning is safe to ignore.

### "must be owner of table"
Use service role key, not anon key. Check Supabase dashboard → Settings → API.

### "permission denied for schema public"
```sql
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO authenticated;
```

### Partition errors
Ensure `captured_at` or `checked_at` values fall within partition range. Check logs for timestamp issues.

---

**Run all 8 migrations before deploying Replit services.**
