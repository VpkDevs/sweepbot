# SweepBot API Design

Comprehensive REST and WebSocket API specification for the SweepBot backend.

## Overview

- **Base URL**: `https://api.sweepbot.app` (production) or `http://localhost:3001` (development)
- **Authentication**: JWT Bearer tokens via Supabase Auth
- **Rate Limits**: 100 req/min per user (Free tier), 1000 req/min (Pro+)
- **WebSocket**: `ws://localhost:3001/ws/*` (separate endpoints for different data streams)

---

## Authentication

All API endpoints (except `/auth/*`) require a `Authorization: Bearer <JWT>` header.

```bash
# Example
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.sweepbot.app/api/users/me
```

---

## REST Endpoints

### Auth

#### `POST /auth/sign-in`
Authenticate user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "...",
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "pro"
  }
}
```

#### `POST /auth/sign-up`
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "display_name": "John Doe"
}
```

#### `POST /auth/refresh`
Refresh an expired JWT using a refresh token.

**Request:**
```json
{
  "refresh_token": "..."
}
```

---

### Users

#### `GET /api/users/me`
Get current authenticated user profile.

**Response:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "ref_code": "VINCE123",
  "subscription_tier": "pro",
  "subscription_expires_at": "2026-12-31T23:59:59Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### `PATCH /api/users/me`
Update user profile.

**Request:**
```json
{
  "display_name": "Jane Doe",
  "notification_prefs": {
    "enable_jackpot_alerts": true,
    "enable_daily_digest": false
  }
}
```

#### `DELETE /api/users/me`
Delete user account and all associated data.

**Response:**
```json
{
  "success": true,
  "message": "Account deleted. All data will be purged within 30 days."
}
```

---

### Sessions

#### `POST /api/sessions`
Start a new gaming session.

**Request:**
```json
{
  "platform_slug": "chumba",
  "game_id": "sweet-bonanza-100"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "started_at": "2024-12-01T14:30:00Z",
  "platform_slug": "chumba"
}
```

#### `GET /api/sessions/:session_id`
Get session details.

**Response:**
```json
{
  "session_id": "uuid",
  "platform_slug": "chumba",
  "started_at": "2024-12-01T14:30:00Z",
  "ended_at": "2024-12-01T15:45:00Z",
  "total_wagered": 1500.00,
  "total_won": 1200.00,
  "rtp": 80.0,
  "transaction_count": 150,
  "confidence_level": "medium"
}
```

#### `PATCH /api/sessions/:session_id/balance`
Update session balance (called from extension when balance changes).

**Request:**
```json
{
  "sc_balance": 5000,
  "gc_balance": 2500
}
```

#### `POST /api/sessions/:session_id/transactions`
Log a transaction (spin result).

**Request:**
```json
{
  "game_id": "sweet-bonanza-100",
  "bet_amount": 10.00,
  "win_amount": 15.50,
  "result": "win"
}
```

#### `POST /api/sessions/:session_id/end`
End the session and calculate final RTP.

**Response:**
```json
{
  "session_id": "uuid",
  "ended_at": "2024-12-01T15:45:00Z",
  "rtp": 80.0,
  "duration_minutes": 75,
  "transaction_count": 150
}
```

---

### Analytics

#### `GET /api/analytics/sessions`
Get user's session history.

**Query Parameters:**
- `platform_slug` (optional) — Filter by platform
- `limit` (default: 20) — Number of sessions to return
- `offset` (default: 0) — Pagination offset
- `from_date` (ISO 8601) — Start date filter
- `to_date` (ISO 8601) — End date filter

**Response:**
```json
[
  {
    "session_id": "uuid",
    "platform_slug": "chumba",
    "started_at": "2024-12-01T14:30:00Z",
    "ended_at": "2024-12-01T15:45:00Z",
    "rtp": 80.0,
    "total_wagered": 1500.00,
    "total_won": 1200.00,
    "transaction_count": 150
  }
]
```

#### `GET /api/analytics/platform/:slug`
Get aggregate stats for a platform.

**Response:**
```json
{
  "platform_slug": "chumba",
  "total_sessions": 150,
  "total_wagered": 50000.00,
  "total_won": 42000.00,
  "overall_rtp": 84.0,
  "avg_session_duration": 45,
  "win_rate": 68.5,
  "last_session_at": "2024-12-01T15:45:00Z"
}
```

#### `GET /api/analytics/dashboard`
Get comprehensive dashboard overview.

**Response:**
```json
{
  "total_wagered_all_time": 500000.00,
  "total_won_all_time": 420000.00,
  "rtp_all_time": 84.0,
  "platform_count": 8,
  "total_sessions": 500,
  "this_month": {
    "wagered": 45000.00,
    "won": 38000.00,
    "rtp": 84.4
  },
  "top_platforms": [
    { "slug": "chumba", "sessions": 120, "rtp": 85.5 },
    { "slug": "luckyland", "sessions": 100, "rtp": 83.2 }
  ]
}
```

---

### Jackpots

#### `GET /api/jackpots`
Get active jackpots.

**Query Parameters:**
- `platform_slug` (optional) — Filter by platform
- `tier` (optional) — Filter by tier (mega/major/minor/mini)
- `sort_by` (default: "growth_rate") — Sort by current_amount, growth_rate, or hit_time

**Response:**
```json
[
  {
    "jackpot_id": "uuid",
    "game_id": "sweet-bonanza-100",
    "platform_slug": "chumba",
    "current_amount": 125000.50,
    "historical_high": 250000.00,
    "growth_rate": 1500.00,
    "tier": "major",
    "last_hit_at": "2024-11-28T08:15:00Z",
    "days_since_hit": 3,
    "estimated_hit_date": "2024-12-15"
  }
]
```

#### `GET /api/jackpots/:jackpot_id/history`
Get historical data for a jackpot.

**Query Parameters:**
- `days` (default: 30) — Number of days of history
- `granularity` (default: "hourly") — hourly, daily, or weekly

**Response:**
```json
{
  "jackpot_id": "uuid",
  "data_points": [
    { "timestamp": "2024-12-01T00:00:00Z", "amount": 100000.00 },
    { "timestamp": "2024-12-01T01:00:00Z", "amount": 101500.00 }
  ]
}
```

#### `GET /api/jackpots/leaderboard`
Get top growing jackpots across all platforms.

**Response:**
```json
[
  {
    "rank": 1,
    "jackpot_id": "uuid",
    "game_id": "sweet-bonanza-100",
    "platform_slug": "chumba",
    "current_amount": 250000.00,
    "growth_rate_daily": 5000.00,
    "progress_to_high": 95.2
  }
]
```

---

### Redemptions

#### `POST /api/redemptions`
Log a redemption request.

**Request:**
```json
{
  "platform_slug": "chumba",
  "amount_sc": 1000,
  "payment_method": "paypal",
  "requested_at": "2024-12-01T14:30:00Z",
  "notes": "Withdrawal request"
}
```

**Response:**
```json
{
  "redemption_id": "uuid",
  "platform_slug": "chumba",
  "amount_sc": 1000,
  "status": "pending",
  "requested_at": "2024-12-01T14:30:00Z"
}
```

#### `GET /api/redemptions`
Get user's redemption history.

**Query Parameters:**
- `status` (optional) — pending, processing, completed, rejected
- `platform_slug` (optional) — Filter by platform

**Response:**
```json
[
  {
    "redemption_id": "uuid",
    "platform_slug": "chumba",
    "amount_sc": 1000,
    "status": "completed",
    "requested_at": "2024-12-01T14:30:00Z",
    "completed_at": "2024-12-02T09:15:00Z",
    "processing_days": 1,
    "payment_method": "paypal"
  }
]
```

#### `PATCH /api/redemptions/:redemption_id`
Update redemption status (mark as complete, rejected, etc.).

**Request:**
```json
{
  "status": "completed",
  "completed_at": "2024-12-02T09:15:00Z"
}
```

---

### Trust Index

#### `GET /api/trust-index/platforms`
Get Trust Index scores for all platforms.

**Response:**
```json
[
  {
    "platform_slug": "chumba",
    "platform_name": "Chumba Casino",
    "trust_score": 87.5,
    "tier": "A",
    "factors": {
      "redemption_speed": 90,
      "rejection_rate": 85,
      "tos_stability": 88,
      "community_satisfaction": 84,
      "bonus_generosity": 86,
      "support_responsiveness": 82,
      "regulatory_standing": 91
    },
    "recent_changes": [
      {
        "factor": "redemption_speed",
        "change": -2,
        "date": "2024-11-15"
      }
    ]
  }
]
```

#### `GET /api/trust-index/platforms/:slug`
Get detailed Trust Index for a specific platform.

#### `GET /api/trust-index/history`
Get historical Trust Index changes.

---

### Affiliate

#### `POST /api/affiliate/click`
Track affiliate link click (called from extension).

**Request:**
```json
{
  "platform_slug": "chumba"
}
```

#### `POST /api/affiliate/signup`
Track affiliate signup (called from extension when user registers).

**Request:**
```json
{
  "platform_slug": "chumba",
  "external_user_id": "chumba_user_12345"
}
```

#### `GET /api/affiliate/earnings`
Get affiliate earnings summary.

**Response:**
```json
{
  "total_earnings": 5250.00,
  "pending_payout": 1200.00,
  "paid_out": 4050.00,
  "by_platform": [
    { "platform_slug": "chumba", "referrals": 12, "earnings": 1800.00 }
  ],
  "next_payout_date": "2024-12-15T00:00:00Z"
}
```

---

## WebSocket Endpoints

### Jackpot Stream

**Endpoint**: `ws://localhost:3001/ws/jackpots`

**Authentication**: Pass JWT as query param or header

**Messages Sent to Client:**

```json
{
  "type": "snapshot",
  "data": {
    "jackpot_id": "uuid",
    "current_amount": 125000.50,
    "updated_at": "2024-12-01T14:35:00Z"
  }
}
```

```json
{
  "type": "hit",
  "data": {
    "jackpot_id": "uuid",
    "amount": 125000.50,
    "winner_platform": "chumba",
    "hit_at": "2024-12-01T14:35:00Z"
  }
}
```

```json
{
  "type": "surge",
  "data": {
    "jackpot_id": "uuid",
    "growth_rate": 2500.00,
    "surge_at": "2024-12-01T14:35:00Z"
  }
}
```

---

### Session Stream

**Endpoint**: `ws://localhost:3001/ws/sessions/:session_id`

**Messages Sent to Client:**

```json
{
  "type": "transaction",
  "data": {
    "game_id": "sweet-bonanza-100",
    "bet": 10.00,
    "win": 15.50,
    "rtp": 80.0,
    "timestamp": "2024-12-01T14:35:00Z"
  }
}
```

```json
{
  "type": "balance_update",
  "data": {
    "sc_balance": 5000,
    "gc_balance": 2500
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "INVALID_REQUEST",
  "message": "Field 'email' is required",
  "status": 400,
  "timestamp": "2024-12-01T14:35:00Z"
}
```

**Common Status Codes:**
- `200` — Success
- `201` — Created
- `400` — Bad Request
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Not Found
- `429` — Rate Limited
- `500` — Internal Server Error

---

## Rate Limiting

Response headers indicate rate limit status:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1701426900
```

---

## Pagination

Endpoints returning lists support pagination:

```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "pages": 8
  }
}
```

---

## Versioning

API version is specified in base URL: `https://api.sweepbot.app/v1/`

Current stable version: **v1**

---

## Changelog

### v1.0.0 (2024-12-01)
- Initial API release
- Core endpoints: auth, users, sessions, analytics, jackpots, redemptions, trust-index, affiliate
- WebSocket support for live jackpots and session data
