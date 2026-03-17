# SweepBot Extension — Chrome Web Store Submission Checklist

_Use this before every submission or resubmission. Chrome reviews take 1–5 business days._
_A rejection resets the clock. Check everything here first._

---

## Pre-Submission Build

- [ ] Run `pnpm build` in `apps/extension/` — no TypeScript errors
- [ ] Run `pnpm build:zip` — produces the submission ZIP
- [ ] Verify ZIP size is under 50MB (Chrome limit)
- [ ] Open `chrome://extensions` → enable Developer Mode → "Load unpacked" the `dist/` folder → no console errors on any page

---

## Manifest Compliance (MV3)

- [ ] `manifest_version` is `3` (not 2)
- [ ] `name` is clear and descriptive (not "SweepBot Extension" — use "SweepBot — Sweepstakes Casino Tracker")
- [ ] `version` follows semver (e.g., `1.0.0`)
- [ ] `description` is 132 characters or fewer (Chrome enforces this)
- [ ] `icons` present at 16px, 48px, 128px (PNG, no transparency issues)
- [ ] `host_permissions` are declared (not `<all_urls>` — only specific casino domains)
- [ ] `permissions` list is minimal and justified (see mapping below)
- [ ] No `background.persistent: true` (not allowed in MV3)
- [ ] Background script is `service_worker` type, not persistent
- [ ] No remote code execution (no `eval()`, no loading scripts from external URLs)

### Permission Justifications (Required in Store Listing)

| Permission      | Justification                                                           |
| --------------- | ----------------------------------------------------------------------- |
| `storage`       | Saves session tracking data and user preferences locally                |
| `alarms`        | Schedules periodic data sync without persistent background process      |
| `notifications` | Alerts user to session events (time limits, bonus available)            |
| `scripting`     | Injects the RTP HUD overlay and affiliate banners on casino pages       |
| `tabs`          | Detects when user navigates to/from a tracked casino page               |
| `webRequest`    | Reads casino API responses to capture spin/bet data for RTP calculation |

---

## Privacy Policy

- [ ] Privacy policy is publicly accessible at a permanent URL (e.g., `https://sweepbot.app/privacy`)
- [ ] Privacy policy URL entered in Chrome Web Store Developer Dashboard
- [ ] Privacy policy explains EVERY type of data the extension collects
- [ ] Privacy policy explicitly mentions XHR/Fetch interception and what data is extracted
- [ ] Privacy policy explains that credentials are stored locally (zero-knowledge vault)
- [ ] Privacy policy includes user rights (deletion, GDPR, CCPA)

---

## Code Quality (Chrome Reviewers Look for These)

- [ ] No obfuscated or minified code that makes intent unclear (source maps OK; intentional obfuscation not OK)
- [ ] No `eval()`, `new Function()`, or `innerHTML` with user-supplied strings
- [ ] No `document.write()`
- [ ] Content Security Policy (CSP) in manifest is strict — no `unsafe-eval` or `unsafe-inline`
- [ ] All external URLs in host_permissions are specifically listed (no wildcard catch-all)
- [ ] Extension only sends data to `api.sweepbot.app` — no unexpected third parties

---

## Functionality Testing

Test each of these manually in a fresh Chrome profile before submitting:

### Platform Detection

- [ ] Navigate to chumbacasino.com/play — extension icon shows "active" state
- [ ] Navigate to luckylandslots.com — detected
- [ ] Navigate to stake.us — detected
- [ ] Navigate to pulsz.com — detected
- [ ] Navigate to a non-casino site (google.com) — extension shows "inactive" / neutral state

### Session Tracking

- [ ] Open a casino game in supported platform → session starts (visible in popup)
- [ ] Play several rounds → spin count increments in popup HUD
- [ ] RTP updates in real-time as spins are captured
- [ ] Close casino tab → session ends and is stored

### HUD Overlay

- [ ] HUD appears on game pages (not the lobby — just game pages)
- [ ] HUD shows: current RTP, spins counted, wagered, won
- [ ] HUD can be collapsed/hidden via toggle
- [ ] HUD does not break any casino page functionality (no JS errors, no UI corruption)
- [ ] HUD does not appear on non-casino sites

### Popup

- [ ] Popup opens on extension icon click
- [ ] Popup shows current session stats if session is active
- [ ] Popup shows "No active session" if not on a casino game page
- [ ] "Open Dashboard" link in popup opens sweepbot.app correctly

### Affiliate Banners

- [ ] Navigate to a casino signup/registration page → banner appears
- [ ] Banner is clearly labeled as a SweepBot referral
- [ ] Banner has a dismiss/close button
- [ ] Banner click correctly redirects to platform with SweepBot affiliate code

### Settings / Options Page

- [ ] Options page loads without errors
- [ ] Toggling HUD visibility persists across browser restart
- [ ] Disconnect from SweepBot account works

### Notifications

- [ ] Session time limit notification fires when enabled and limit is reached
- [ ] Notification can be clicked to open popup

---

## Store Listing Content

### Short Description (≤ 132 characters)

```
Track RTP, automate bonus claims, and analyze performance across 20+ sweepstakes casino platforms.
```

(Adjust as needed; must be ≤132 characters)

### Detailed Description — Required Elements

- [ ] Clear explanation of what the extension does
- [ ] What data is collected and why
- [ ] What permissions are needed and why
- [ ] Links to Privacy Policy and Terms of Service
- [ ] Statement that it is NOT a gambling product
- [ ] Statement about which platforms are supported
- [ ] Responsible play statement

### Screenshots — Required

- [ ] At least 3 screenshots (1280×800 OR 640×400, PNG)
- [ ] Screenshot 1: HUD overlay on a casino game page
- [ ] Screenshot 2: Extension popup with session stats
- [ ] Screenshot 3: Dashboard view (from web app, showing data the extension collected)
- [ ] Screenshots must not contain real winnings or any misleading claims

### Category

- [ ] Category: **Productivity** (not "Shopping" or "News")
- [ ] Language: English (United States)

---

## Common Rejection Reasons (Avoid These)

| Reason                                   | Prevention                                                 |
| ---------------------------------------- | ---------------------------------------------------------- |
| Privacy policy doesn't match permissions | Match every permission to a clear privacy policy statement |
| Requesting unnecessary permissions       | Audit manifest — only keep what you actually use           |
| Remote code execution                    | Double-check no eval(), no dynamic script loading          |
| Misleading store listing                 | Don't claim the extension can help users "win" at casinos  |
| UI clutters or breaks casino pages       | Test HUD on all supported platforms before submission      |
| Affiliate links not disclosed            | Always label referral links clearly                        |
| Obfuscated code                          | Confirm build output is readable (source maps are fine)    |
| Missing 128px icon                       | Verify icons array in manifest                             |

---

## After Submission

- [ ] Note the submission date
- [ ] Monitor the Chrome Web Store Developer Dashboard for status
- [ ] If rejected: read rejection reason carefully, address root cause, do not just resubmit without changes
- [ ] If approved: verify live listing looks correct before announcing

---

## Resubmission (After Rejection)

1. Read the rejection notice in full — identify the specific policy violation
2. Fix the root cause (not just the symptom)
3. Update the store listing description if the reviewer misunderstood the extension's purpose
4. Re-run this entire checklist
5. Submit with a clear changelog in the "What's New" field explaining what was fixed

---

_Owner: Vincent Kinney / APPYness_
_Document version: 1.0 | 2026-03-05_
