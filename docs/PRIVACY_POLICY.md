# SweepBot Privacy Policy

**Effective Date:** March 5, 2026
**Last Updated:** March 9, 2026
**Operator:** APPYness | Vincent Kinney | vincekinney1991@gmail.com

---

## 1. Introduction

SweepBot ("we," "us," "our") is a transparency and productivity platform for sweepstakes casino players. This Privacy Policy explains what information we collect, how we use it, and what rights you have over it.

SweepBot is **not a gambling product** and does not facilitate gambling of any kind. It is a data tracking, analytics, and automation tool for legally operating sweepstakes platforms.

---

## 2. Who We Are

**APPYness** — _"Developing Joy"_
Operated by Vincent Kinney.
Contact: vincekinney1991@gmail.com

For privacy-related inquiries: vincekinney1991@gmail.com
Response time: within 30 days for standard requests, within 72 hours for data breach notifications.

---

## 3. Age Requirement

SweepBot is intended for users **18 years of age or older**. We do not knowingly collect personal information from minors under 18. If you believe a minor has created an account, contact us immediately and we will delete the account and all associated data within 48 hours.

We comply with the **Children's Online Privacy Protection Act (COPPA)**.

---

## 4. What Data We Collect

### 4.1 Account Information

When you create a SweepBot account:

- Email address
- Display name (you choose this)
- Password (stored as a salted hash via Supabase Auth — we never see your plaintext password)
- Profile photo (optional, if you upload one)
- Timezone and locale preferences

### 4.2 Gambling Session Data (Extension)

When you play sweepstakes casino games with the SweepBot browser extension installed and active:

- **Bet amounts and win amounts** per spin/round (intercepted from the casino platform's own API responses)
- **Running balance** (sweep coins and gold coins)
- **Game name** and **platform name**
- **Session start and end times**
- **RTP (return to player)** calculated locally from the above

We **do not** collect:

- Your casino account username or password
- Your real name as registered with the casino
- Payment card data or bank account information
- Your physical location or IP address for tracking purposes

### 4.3 Redemption Data (User-Submitted)

If you log a redemption request in SweepBot:

- Platform name
- Amount (in sweep coins and estimated USD)
- Payment method type (e.g., PayPal, check — not account details)
- Status, dates, and notes you provide

This data is user-submitted. We do not automatically see your redemption status from the casino.

### 4.4 Automation Configuration (Flows)

If you create automation flows:

- Natural language descriptions of automations
- Platform names and game names referenced
- Schedule configurations (e.g., "run daily at 3 PM")
- Execution logs (what actions ran, outcomes, timestamps)

### 4.5 Affiliate Tracking

When the browser extension detects that you navigate to a sweepstakes platform registration page via a SweepBot referral link:

- Platform name
- Whether a signup occurred (not personal details of the signup)
- Your SweepBot user ID (to credit your referral earnings)

### 4.6 Usage Data

We collect standard web analytics via PostHog:

- Pages visited within the SweepBot dashboard
- Features used
- Session duration
- Browser type and operating system (anonymized)

We do **not** use Google Analytics or any advertising-linked analytics platform.

### 4.7 Technical Data

- Error reports via Sentry — these may include stack traces but are not linked to identifiable user data

### 4.8 Voice-Scripted Commands (Extension)

If you use the optional voice-scripting feature in the browser extension:

- **Real-time audio:** Capturing your voice for transcription. **This audio data is processed locally by your browser's Web Speech API and is NEVER stored or transmitted to our servers.**
- **Transcripts:** The resulting text transcript is processed by our NLP engine.
- **PII Scrubbing:** All transcripts undergo an automated sanitization pass to remove emails and phone numbers before the resulting automation "Flow" is saved to your account.

---

## 5. What We Do NOT Collect

- ❌ Casino platform login credentials (these are stored only in your local credential vault, never transmitted to our servers)
- ❌ Payment card numbers, bank accounts, or financial account credentials
- ❌ Real-money gambling activity (SweepBot only supports legal sweepstakes casinos)
- ❌ Browsing history outside of sweepstakes casino pages while the extension is active
- ❌ Camera data
- ❌ Contacts or social media data
- ❌ Precise GPS location

---

## 6. Credential Vault (Desktop App)

The SweepBot desktop automation app includes a **zero-knowledge credential vault**:

- Casino platform credentials (username + password) are encrypted locally using AES-256-GCM with a key derived from your master password via Argon2id
- **This data never leaves your device.** It is not transmitted to SweepBot servers.
- We cannot access, recover, or reset your credential vault. If you forget your master password, the vault contents cannot be recovered.

---

## 7. How We Use Your Data

| Data Type                         | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| Account information               | Provide account access, customer support, send service notifications      |
| Session / transaction data        | Calculate RTP analytics, portfolio overview, platform statistics          |
| Aggregated anonymous session data | Compute community RTP averages, Trust Index scores                        |
| Redemption data                   | Generate redemption processing time statistics for community Intelligence |
| Automation flows                  | Execute and schedule automations on your behalf                           |
| Voice commands                    | Process voice-to-text scripting (local processing only)                   |
| Affiliate data                    | Credit referral earnings, calculate commissions                           |
| Usage data                        | Improve product functionality, identify bugs                              |

We do **not** use your data to:

- Target you with advertising
- Profile you for sale to third parties
- Train external AI models

---

## 8. Data Sharing

### 8.1 We Do Not Sell Your Data

We do not sell, rent, or trade individual user data to any third party.

### 8.2 Aggregated Community Data

We may publish or share **anonymized, aggregated** statistics derived from user data, such as:

- "The community average RTP on Platform X is 84%"
- "Average redemption processing time on Platform Y is 3.2 days"
- "Platform Z's Trust Index score is 78/100"

Individual users cannot be identified from this data.

### 8.3 Service Providers

We share data with third-party service providers strictly to operate SweepBot:

| Provider | Purpose                     | Data Shared                             |
| -------- | --------------------------- | --------------------------------------- |
| Supabase | Database and authentication | All stored account + session data       |
| Stripe   | Payment processing          | Name, email, payment method for billing |
| Upstash  | Redis caching               | Temporary cached API responses (no PII) |
| Resend   | Transactional email         | Email address, email content            |
| Sentry   | Error monitoring            | Error stack traces (anonymized)         |
| PostHog  | Product analytics           | Anonymized usage events                 |
| Vercel   | Web hosting                 | Request logs (30-day retention)         |
| Railway  | API hosting                 | Request logs (30-day retention)         |

All providers are bound by data processing agreements. None are authorized to use your data for their own marketing or analytics.

### 8.4 Legal Disclosure

We may disclose your data if required by law, court order, or to prevent imminent harm. We will notify you before doing so unless legally prohibited.

---

## 9. Data Retention

| Data Type                       | Retention Period                                     |
| ------------------------------- | ---------------------------------------------------- |
| Account data                    | Duration of account + 30 days after deletion request |
| Session and transaction history | Up to 3 years, or until account deletion             |
| Redemption logs                 | Up to 3 years, or until account deletion             |
| Automation flow definitions     | Until deleted by user                                |
| Execution logs                  | 12 months rolling                                    |
| Access/request logs             | 30 days                                              |
| Billing records                 | 7 years (tax/legal requirement)                      |
| Aggregated anonymous data       | Indefinitely (cannot be re-identified)               |

---

## 10. Your Rights

### For All Users

- **Access:** Request a copy of all personal data we hold about you
- **Correction:** Request correction of inaccurate data
- **Deletion:** Request deletion of your account and all associated data
- **Portability:** Receive your session and redemption data in CSV format
- **Objection:** Object to any processing you did not explicitly consent to

### For EU/EEA Users (GDPR)

All of the above rights apply, plus:

- **Right to restrict processing** — request that we stop processing your data while a dispute is resolved
- **Right to lodge a complaint** with your national supervisory authority

### For California Users (CCPA)

- **Right to know** what categories of personal information we collect
- **Right to delete** personal information we hold about you
- **Right to opt-out** of sale of personal information (we do not sell data; this right is satisfied by default)
- **Right to non-discrimination** for exercising your privacy rights

### How to Exercise Your Rights

Email: vincekinney1991@gmail.com
Subject line: "Privacy Rights Request"
We will respond within **30 days**. Account deletion is completed within **24 hours** for all live data; anonymized derivatives may be retained per the retention schedule above.

---

## 11. Data Security

- All data in transit is encrypted via TLS 1.2+
- All data at rest is encrypted via AES-256
- Database access is protected by Row Level Security (RLS) — users can only ever access their own data
- API authentication uses JWTs with 15-minute expiry and 7-day refresh tokens
- Refresh tokens are stored in httpOnly cookies (not accessible to JavaScript)
- Access tokens are stored in memory only (not localStorage or sessionStorage)
- Security vulnerability reports: see `SECURITY.md`

---

## 12. Browser Extension — Chrome Web Store Compliance

The SweepBot Chrome extension:

- Requests only the permissions necessary to function (storage, alarms, notifications, scripting, tabs, webRequest on listed casino domains)
- Contains no obfuscated code
- Does not perform any network requests to domains not listed in the manifest host permissions
- All data collection is disclosed in this Privacy Policy
- Does not inject advertising or redirect affiliate links without user awareness

Extension permissions and why they are needed:

| Permission      | Reason                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| `storage`       | Save session data and user settings locally                               |
| `alarms`        | Schedule background sync at regular intervals                             |
| `notifications` | Alert user to session events (jackpot, bonus available, time limit)       |
| `scripting`     | Inject the RTP HUD overlay into casino pages                              |
| `tabs`          | Detect when user navigates to/from a casino page                          |
| `webRequest`    | Intercept and read casino API responses to extract spin/bet data          |
| `microphone`    | Allow use of the Web Speech API for voice-scripting (user-triggered only) |

---

## 13. Cookies

SweepBot uses:

- **Authentication cookies** (httpOnly, Secure, SameSite=Strict) — strictly necessary
- **Session cookies** — strictly necessary

We do not use:

- Advertising or tracking cookies
- Third-party analytics cookies
- Cookie-based retargeting

---

## 14. Changes to This Policy

We will notify you of material changes to this Privacy Policy via:

1. Email to your registered address (at least 14 days before changes take effect)
2. In-app notification banner

Continued use of SweepBot after the effective date of changes constitutes acceptance.

---

## 15. Contact

**APPYness / SweepBot**
Email: vincekinney1991@gmail.com
Website: https://sweepbot.app

_SweepBot is a transparency and productivity tool for sweepstakes casino players. It is not a gambling product._
