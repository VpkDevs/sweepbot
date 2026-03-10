# SweepBot — Security Architecture

**Version:** 1.0
**Date:** March 2026
**Status:** Approved — Required reading before any security-related work

---

## 1. Security Philosophy

SweepBot operates at the intersection of financial data, browser automation, and user credentials. The security model is built on three non-negotiable principles:

1. **Zero-Knowledge for credentials**: Casino login credentials NEVER touch SweepBot servers. Ever.
2. **Minimal surface**: The extension only requests host permissions on known, enumerated platform domains.
3. **Defense in depth**: Every trust boundary (browser ↔ extension, extension ↔ API, API ↔ database) has its own validation layer.

---

## 2. Authentication Flow (Web + API)

```
User signs in
  → Supabase Auth (email/password or OAuth)
  → JWT issued: 15-minute access token + 7-day refresh token
  → Access token: stored in memory (JavaScript variable, NOT localStorage)
  → Refresh token: stored in httpOnly, Secure, SameSite=Strict cookie
  → All API requests: Authorization: Bearer <access_token>
  → API validates JWT signature → extracts user_id → applies RLS
```

**Why memory-only for access tokens:** Prevents XSS attacks from stealing tokens via `localStorage`. The 15-minute TTL limits blast radius if a token is compromised.

**Row Level Security (RLS):** Enabled on ALL user-scoped tables in PostgreSQL. Even if a bug bypasses application-level auth, the database layer enforces isolation. A user can only read or write their own rows.

---

## 3. Credential Vault (Desktop App — Zero-Knowledge Design)

Casino account credentials (usernames and passwords) for automation are stored exclusively on the user's local device. This is a hard architectural constraint, not a preference.

### Encryption Stack

```
User enters master password
  → Argon2id KDF (Key Derivation Function)
     - Memory: 64MB
     - Iterations: 3
     - Parallelism: 4
  → 256-bit symmetric encryption key derived
  → Key + Argon2id parameters stored in device keychain

Platform credentials (username, password)
  → Encrypted with AES-256-GCM
  → Random 96-bit nonce per encryption operation
  → Authentication tag verifies integrity on decryption
  → Encrypted blob stored in local SQLite database

NOTHING is transmitted to SweepBot servers.
```

### What This Means

- SweepBot cannot see your casino passwords. Physically impossible.
- A breach of SweepBot's servers exposes zero casino credentials.
- If a user forgets their master password, credentials cannot be recovered. (By design.)
- The Rust backend of Tauri handles all encryption — no JavaScript access to raw keys.

---

## 4. Browser Extension Security

### Content Security Policy

The extension enforces a strict CSP:
- No `eval()` or `new Function()`
- No inline scripts
- Script sources restricted to the extension's own bundle

### Host Permissions

**Principle of least privilege.** The extension only requests access to explicitly approved platform domains listed in `wxt.config.ts`. It does NOT request `<all_urls>`.

```json
"host_permissions": [
  "https://*.chumba.com/*",
  "https://*.luckyland.com/*",
  "https://*.stake.us/*",
  "https://*.pulsz.com/*"
  // ... other approved platforms only
]
```

### Message Validation

All messages between content scripts and the background service worker are:
1. Typed with strict TypeScript interfaces
2. Validated at runtime with Zod schemas
3. Rejected if they don't conform to the expected shape

This prevents a compromised casino page from injecting malicious messages into the extension.

### XHR Interception

The content script monkey-patches `XMLHttpRequest` and `fetch` to capture transaction data. This is:
- Read-only (it observes responses, it does not modify them)
- Scoped only to responses matching known API patterns for approved platforms
- Stripped of any PII before being sent to the background worker

---

## 5. API Security

### Input Validation

Every API endpoint uses Fastify's built-in JSON Schema validation combined with Zod for complex types. Requests that don't match the schema are rejected with HTTP 400 before reaching business logic.

### Rate Limiting

All endpoints are rate-limited via `@fastify/rate-limit` backed by Redis:
- Authentication endpoints: 5 requests / minute / IP
- Standard endpoints: 100 requests / minute / user
- Batch ingestion (`/transactions/batch`): 10 requests / minute / device

### SQL Injection Prevention

Drizzle ORM uses parameterized queries exclusively. No raw SQL string concatenation is permitted in the codebase. ESLint rules enforce this.

### Secrets Management

- All secrets (Supabase keys, Stripe keys, Redis credentials) are environment variables
- Never committed to the repository
- `.env.example` contains only keys with placeholder values
- Production secrets stored in Railway and Vercel environment variable vaults

---

## 6. Data Privacy

| Data Type | Storage | Who Can Access |
|-----------|---------|----------------|
| Session & transaction data | Supabase (encrypted at rest) | User only (RLS) |
| Casino credentials | Local device only | User only |
| Aggregate RTP / leaderboard | Supabase (anonymized) | All users |
| Jackpot time-series | Supabase | All users |
| Stripe billing data | Stripe (never stored by SweepBot) | Stripe + User |

**No user data is sold or shared with third parties for advertising.**

---

## 7. Responsible Disclosure

If you discover a security vulnerability in SweepBot, please report it privately to the maintainer before public disclosure. Do not open a public GitHub issue for security vulnerabilities.

---

## 8. Security Checklist for Contributors

Before merging any PR that touches security-sensitive areas:

- [ ] No new `any` types introduced in auth or data-handling code
- [ ] New endpoints have Zod validation and rate limiting
- [ ] New database tables have RLS policies
- [ ] No secrets or tokens in committed code (check with `git grep`)
- [ ] Extension host permissions not expanded without explicit review
- [ ] Credential vault logic stays in Rust (Tauri backend), not JavaScript

---

*Security architecture maintained by APPYness. Last updated March 2026.*
