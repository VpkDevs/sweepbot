# SweepBot Browser Extension

The beachhead product for SweepBot — a lightweight Chrome/Firefox extension that provides real-time analytics, RTP tracking, and automation for sweepstakes casino players.

## Architecture

### Core Libraries (`src/lib/`)

- **`platforms.ts`** — Platform detection engine with configs for 10+ sweepstakes platforms
- **`interceptor.ts`** — Network XHR/Fetch interceptor for real-time transaction tracking
- **`rtp-calculator.ts`** — RTP and volatility calculation from spin results
- **`storage.ts`** — Type-safe wrapper around Chrome's local storage API
- **`api.ts`** — Extension API client for communication with backend
- **`affiliate.ts`** — Affiliate link injection and signup tracking

### Entrypoints (`src/entrypoints/`)

- **`background.ts`** — Service worker; manages state, handles message passing, syncs analytics
- **`content.ts`** — Content script injected into casino pages; monitors gameplay, injects HUD
- **`popup/`** — Popup UI (React); shows session stats and quick controls
- **`options/`** — Options page (React); extension settings and preferences

### Workflow

1. **Page Load**: Content script detects platform, initializes network interceptor
2. **Gameplay**: Interceptor captures XHR/Fetch responses, extracts transaction data
3. **Real-time RTP**: RTP calculator updates on every transaction; HUD refreshes
4. **Data Sync**: Background worker periodically syncs analytics to API
5. **User Controls**: Popup and options pages manage HUD visibility, notifications, settings

## Development

```bash
# Install dependencies
pnpm install

# Development mode (hot reload)
pnpm dev

# Run unit & integration tests
pnpm test          # runs all Vitest suites
pnpm test:coverage # coverage report (v8)

# Build for production
pnpm build

# Build as ZIP for submission
pnpm build:zip
```

Additional test utilities live under `src/__tests__`; see `playwright-harness.test.ts` for a lightweight Playwright example that exercises detection logic inside a headless browser.

## Manifest

- **Permissions**: storage, alarms, notifications, scripting, tabs, webRequest
- **Host Permissions**: All major sweepstakes platforms (chumbacasino, luckyland, stake.us, etc.)
- **Content Scripts**: Injected on game pages
- **Background Service Worker**: Always-on state management
- **Storage**: Local Chrome storage (no cloud sync without user consent)

## Key Features

### Session Tracking

- Automatic session detection on game pages
- Spin-by-spin bet/win capture
- Real-time balance monitoring
- Automatic session cleanup

### RTP Analytics

- Real-time RTP calculation (wagered vs. won)
- Volatility classification (low/medium/high)
- Confidence levels based on sample size
- Largest win/loss tracking

### HUD Overlay

- In-page stats display (customizable position)
- Color-coded RTP (green >95%, yellow >85%, red <85%)
- Current session snapshot
- Collapsible/hideable

### Affiliate Integration

- Tracks referral link clicks
- Injects signup banners on registration pages
- Revenue sharing per platform signup
- Even free users generate affiliate revenue

### Responsible Play

- Session time limit alerts
- Loss limit notifications
- Chase detection (compulsive play patterns)
- Self-exclusion support

## Security & Privacy

- **Zero-Knowledge**: Credentials never leave device unencrypted
- **AES-256 Encryption**: Stored credentials protected
- **Network Isolation**: All sensitive data goes over HTTPS
- **Selective Sync**: User explicitly authorizes server sync
- **No Tracking**: Extension does not track user behavior for advertising

## Deployment

1. **Chrome Web Store**: Submit build as extension
2. **Firefox Add-ons**: Submit for manual review
3. **Direct Installation**: Users can load unpacked extension in dev mode

## Testing Checklist

- [ ] Platform detection works on 10+ casino sites
- [ ] Network interceptor captures all transaction types
- [ ] RTP calculation matches expected results
- [ ] HUD displays on casino pages without JavaScript errors
- [ ] Popup shows current session stats correctly
- [ ] Options page saves settings to storage
- [ ] Background worker syncs analytics periodically
- [ ] Affiliate links inject correctly on signup pages
- [ ] Extension doesn't break any casino site functionality

## Future Enhancements

- Headless automation (scheduled bonus claims, daily spins)
- Advanced game intelligence (per-game RTP, volatility)
- Jackpot surge alerts (via WebSocket)
- Responsible play features (time limits, loss alerts)
- Multi-account support
- Export/reporting features
