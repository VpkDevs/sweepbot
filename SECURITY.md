# Security Policy

## Supported Versions

| Version              | Supported             |
| -------------------- | --------------------- |
| Latest (main branch) | ✅                    |
| All older versions   | ❌ — update to latest |

---

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in SweepBot — including the web dashboard, API, browser extension, or desktop app — please report it responsibly using one of the following channels:

**Email:** vincekinney1991@gmail.com
**Subject line:** `[SECURITY] Brief description of the issue`

### What to Include

- Description of the vulnerability and its potential impact
- Steps to reproduce (be specific)
- Any proof-of-concept code or screenshots (do not exploit beyond what is necessary to demonstrate the issue)
- Your contact information if you wish to be credited

### What to Expect

- **Acknowledgment:** Within 48 hours of receiving your report
- **Triage and status update:** Within 7 business days
- **Resolution timeline:** We aim to patch critical vulnerabilities within 14 days and high-severity issues within 30 days
- **Credit:** With your permission, we will credit you in our release notes upon fix

We will not take legal action against researchers acting in good faith under this policy.

---

## Scope

### In Scope

- SweepBot web dashboard (sweepbot.app)
- SweepBot API (api.sweepbot.app)
- SweepBot browser extension (Chrome)
- SweepBot desktop automation app
- Authentication and session handling
- Data exposure vulnerabilities (user data accessible to unauthorized parties)
- Cryptographic weaknesses in the credential vault
- Privilege escalation (accessing another user's data)
- Injection vulnerabilities (SQLi, XSS, command injection)
- Stripe webhook authentication bypass
- Affiliate link manipulation

### Out of Scope

- Sweepstakes casino platforms (these are not operated by us)
- Rate limiting or brute force attacks without demonstrated user impact
- Social engineering attacks against SweepBot personnel
- Denial of service attacks
- Issues requiring physical device access
- Self-XSS (where you inject content that only affects your own account)

---

## Security Architecture Summary

For researchers, a brief overview of our security design:

### Authentication

- Supabase Auth with JWT (15-minute access token, 7-day refresh token)
- Access tokens stored in memory only (never localStorage)
- Refresh tokens in httpOnly, Secure, SameSite=Strict cookies
- All API endpoints enforce JWT validation and user ID extraction

### Data Isolation

- PostgreSQL Row Level Security (RLS) on all user-scoped tables
- Even at the database level, users can only read/write their own rows
- API never returns data that doesn't belong to the authenticated user

### Credential Vault (Desktop App)

- Zero-knowledge design: credentials are encrypted client-side before local storage
- AES-256-GCM encryption with a key derived from master password via Argon2id KDF
- Nothing is transmitted to SweepBot servers

### API Security

- Input validation via Zod schemas on all endpoints
- Parameterized queries via Drizzle ORM (no raw string interpolation)
- Rate limiting per user tier (100 req/min Free, 1000 req/min Pro+)
- HTTPS-only with HSTS headers
- CORS restricted to known origins

### Extension Security

- All message passing validated with Zod schemas
- No eval() or inline scripts
- Content Security Policy: strict
- Host permissions limited to known sweepstakes platform domains only

---

## Known Non-Issues

The following are known behaviors that are intentional and not security vulnerabilities:

- The extension intercepts XHR/Fetch responses on casino pages — this is disclosed in the Privacy Policy and is the core mechanism for RTP tracking
- The extension injects a HUD overlay on casino pages — this is disclosed and user-controlled
- Session tokens expire and require refresh — this is intentional (15-minute window)

---

_SweepBot is operated by APPYness. Security disclosures are handled by Vincent Kinney._
