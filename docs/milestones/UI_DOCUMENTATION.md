# 🤖 Sweepbot Frontend UI Documentation

## Overview

Sweepbot is a **dark-themed analytics platform** for sweepstakes casino players built with React, TanStack Router, React Query, and Tailwind CSS. The application features a responsive sidebar navigation, real-time analytics, automation flows, and gamification elements.

---

## 🏗️ Layout Architecture

### AppShell (Main Container)

```
┌─ Desktop (lg+) ──────────────────────────────────────┐
│ ┌─────────────┬────────────────────────────────────┐ │
│ │  Sidebar    │  Topbar (Notification Panel)       │ │
│ │  (w-64)     └────────────────────────────────────┘ │
│ │             │                                    │ │
│ │  - Logo     │  Page Content (Outlet)             │ │
│ │  - Tier     │                                    │ │
│ │  - Nav (12) │                                    │ │
│ │  - Settings │                                    │ │
│ │  - User     │                                    │ │
│ └─────────────┴────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

┌─ Mobile ──────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────┐  │
│  │ ☰ (toggle) | Notification Panel                │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Page Content                                   │  │
│  │  (Sidebar slides in overlay on mobile)         │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Sidebar Components

- **Logo Section**: SweepBot logo + brand
- **Tier Badge**: Visual indicator (Free/Starter/Pro/Analyst/Elite)
- **Main Navigation**: 12 primary links organized in 3 groups
  - Core (Dashboard, Sessions, Platforms, Analytics)
  - Engagement (Achievements, Heatmap, Records, Big Wins)
  - Automation (SweepBot Flows)
- **Settings & Auth**: Settings link, Sign out button
- **User Profile**: Avatar with initials, email address

### Topbar Components

- **Mobile Menu**: Hamburger toggle (visible on mobile only)
- **Notification Panel**: Real-time alerts and notifications

---

## 📄 Page Map

### 🔐 Authentication Pages (No AppShell)

Use `AuthLayout` - centered, minimal design

#### `/sign-in`

**Sign In Page**

- Email input field
- Password input field
- "Remember me" checkbox
- Sign in button
- "Forgot password?" link
- "Create account" link

#### `/sign-up`

**Sign Up Page**

- Email input
- Password input
- Confirm password input
- Terms & conditions checkbox
- Sign up button
- "Already have an account?" link

#### `/forgot-password`

**Password Recovery**

- Email input to request recovery
- Recovery code input field
- New password input
- Confirm password input
- Reset button

#### `/pricing`

**Pricing & Plans (Public)**

- Tier comparison cards (Free, Starter, Pro, Analyst, Elite)
- Feature matrix table
- CTA buttons per tier
- Upgrade prompts

---

### 📊 Core Dashboard Pages (With AppShell)

#### `/` - **Dashboard (Command Center)**

_Primary landing page after login_

**Layout:**

- Max width: 7xl, centered padding
- Responsive grid system

**Components:**

1. **Header Section**
   - Title: "Command Center"
   - Subtitle: "Your complete sweepstakes portfolio at a glance."

2. **Streak Widget**
   - Current streak counter
   - Streak progress visualization

3. **Stat Cards Grid** (4 cards on lg, 2 on mobile)
   - Net P&L (with TrendingUp/Down icon, colored value)
   - Personal RTP (color-coded: optimal/good/warning)
   - Active Platforms count
   - Hours Played (total all-time)
   - Each card shows sub-label with context

4. **7-Day Activity Chart**
   - Area chart (Recharts)
   - X-axis: dates (formatted as day abbreviations)
   - Y-axis: net SC amount
   - Purple gradient fill
   - Interactive tooltip on hover

5. **Jackpot Tracker Mini-Panel**
   - Trophy icon header
   - 4 stat rows:
     - Total jackpots tracked
     - Total jackpot value (in SC)
     - Hits in last 24h
     - Paid out in last 30d

6. **Platform Performance Table**
   - Columns: Platform | Sessions | Wagered | Net | RTP | Last Played
   - Hover effect: subtle background highlight
   - Platform logo + name
   - Color-coded net (green for wins, red for losses)
   - Time-ago format for last played
   - "View all →" link to /platforms

#### `/sessions`

**Session History & Management**

- Sessions data table with filters
- Columns: Date | Platform | Duration | Wagered | Net | RTP
- Filter options: date range, platform, result type
- Session detail modal/side panel on click
- Export functionality
- Search/quick filter

#### `/platforms`

**Platform Management**

- Grid or list view of all platforms
- Platform cards showing:
  - Platform logo
  - Name & summary stats
  - Quick actions (edit, view, delete)
- New platform button
- Filter by status (active, paused, etc.)
- Search functionality

#### `/platforms/:platformId`

**Platform Detail Page**

- Platform header with logo & name
- Overview stats cards
- Session history for this platform
- Platform-specific performance charts
- Configuration/settings for platform
- Connection status indicator

---

### �️ Error Handling

- All major routes are now wrapped with a global `Sentry.ErrorBoundary` (see `src/main.tsx`).
- This ensures UI crashes are captured and a friendly fallback is shown.

### �📈 Analytics & Insights Pages

#### `/analytics`

**Comprehensive Performance Analysis**

- Date range selector (7d, 30d, 90d, custom)
- Multiple visualization options:
  - Time series line chart
  - Performance metrics breakdown
  - RTP analysis and trends
  - Win/loss distribution
- Downloadable reports/exports
- Comparison tools (vs previous period)

#### `/jackpots`

**Jackpot Tracking & Management**

- Jackpots table with columns:
  - Name | Platform | Current Value | Last Hit | Status
- Value timeline chart
- Hit frequency indicator
- Alert configuration
- Notifications for value changes

#### `/redemptions`

**Prize Redemptions History**

- Redemptions table:
  - Date | Platform | Amount | Prize Type | Status
- Status badges (pending, completed, approved, denied)
- Summary cards:
  - Total redeemed
  - Pending redemptions
  - Redemption rate
- History timeline visualization

#### `/trust-index`

**Platform Reliability Metrics**

- Trust score cards per platform (0-100)
- Reliability indicators:
  - Payment speed
  - Customer support rating
  - Game fairness score
  - Uptime percentage
- Historical trend chart
- Benchmarking against other platforms
- Trust score explanation/legend

#### `/heatmap`

**Activity Calendar Visualization**

- Calendar grid showing activity intensity
- Color-coded cells (darker = more activity)
- Date range selector
- Mouse-over tooltip with activity stats
- Legend showing intensity ranges
- Export option

---

### 🎯 Engagement & Gamification Pages

#### `/achievements`

**Badges & Milestones**

- Achievement grid/card layout
- Locked vs unlocked indicators
- Progress bars for in-progress achievements
- Achievement detail panel:
  - Title, description, requirements
  - Reward/badge visual
  - Progress percentage
  - Share button
- Filter by status (all, unlocked, in-progress, locked)

#### `/records`

**Personal Records & Best Stats**

- Record cards showing:
  - Biggest single win
  - Highest RTP session
  - Longest winning streak
  - Most sessions in 1 day
  - Highest hourly average
- Detailed stats for each record:
  - Value/amount
  - Date achieved
  - Platform
  - Session duration
- Trending direction indicators

#### `/big-wins`

**Major Wins Showcase**

- Win cards with:
  - Large win amount (prominent display)
  - Platform name & logo
  - Date & time
  - Session screenshot (if available)
  - Game name (if available)
  - Celebration animation on view
- Filters:
  - Date range
  - Platform
  - Amount range
- Share to social functionality

---

### 🤖 Automation Pages

#### `/flows`

**Automation Flows Dashboard**

- Header with "New Flow" CTA button
- Filter tabs: All | Active | Draft | Paused
- Flows list/grid showing:
  - Flow name & description
  - Status badge (color-coded)
  - Last run timestamp
  - Action buttons:
    - Play/Pause toggle
    - Edit (pencil icon)
    - Delete (trash icon)
    - Share (share icon)
- Empty state message when no flows exist

#### `/flows/new`

**Flow Chat Interface (Create)**

- Chat-based conversation UI
- Messages from assistant explaining flow creation
- Message input field at bottom
- Flow preview panel (right side on desktop)
- Save & Test buttons
- Variables/configuration sidebar

#### `/flows/:flowId`

**Flow Detail & Execution View**

- Flow name header with controls
- Visual flow diagram showing steps
- Step-by-step breakdown:
  - Step number & type
  - Description/action
  - Conditional logic (if applicable)
  - Status indicator
- Execution logs:
  - Timestamp
  - Step executed
  - Result/status
- Edit button opens flow editor
- Run flow button for manual execution
- Settings/configuration panel

---

### ⚙️ Settings Page

#### `/settings`

**User Account & Preferences**

**Sections:**

1. **Profile**
   - Display name
   - Email address
   - Avatar/profile picture
   - Bio/description

2. **Account**
   - Password change
   - Two-factor authentication
   - Account deletion option
   - Connected accounts (OAuth)

3. **Notifications**
   - Email notification preferences
   - Push notification toggles
   - Alert thresholds (big win amount, etc.)
   - Quiet hours settings

4. **API & Integrations**
   - API keys display/generation
   - API documentation links
   - Webhook configurations
   - Connected third-party services

5. **Privacy & Security**
   - Data export option
   - Activity log viewer
   - Login history
   - Authorized devices/sessions

6. **Billing** (for paid tiers)
   - Subscription status
   - Payment method
   - Billing history
   - Upgrade/downgrade options

---

## 🎨 Design System

### Color Palette

- **Dark Theme**: Zinc & Slate colors
  - Background: `zinc-950`, `zinc-900`
  - Borders: `zinc-800`
  - Text: `white`, `zinc-400`, `zinc-500`
- **Brand**: `brand-600` (primary), `brand-400` (accent)
- **Status Colors**:
  - Win: `text-win` (green-like)
  - Loss: `text-loss` (red-like)
  - Jackpot: `text-jackpot` (gold-like)

### Typography

- Headers: Font weight 600-700 (`font-bold`)
- Labels: Font weight 500 (`font-medium`)
- Body: Regular weight
- Small text: Font size `text-xs` or `text-sm`

### Spacing & Layout

- Standard padding: `p-4`, `p-5`, `p-6`
- Standard gaps: `gap-2`, `gap-3`, `gap-4`
- Cards: Rounded corners `rounded-lg` or `rounded-xl`, border `border-zinc-800`
- Max content width: `max-w-7xl`

### Interactive Elements

- **Buttons**: Hover states with `hover:text-white`, `hover:bg-zinc-800`
- **Links**: Brand color with hover variant
- **Tables**: Hover rows with `hover:bg-zinc-800/30`
- **Modals/Dialogs**: Radix UI components
- **Tooltips**: Recharts-integrated or Radix UI

### Icons

- Lucide React icons (4x4 default, `w-4 h-4`)
- Flex-shrink applied to prevent layout shifts
- Color: White for primary, `text-zinc-400` for muted

### Responsive Design

- Mobile-first approach
- Sidebar: Hidden on mobile, toggle with hamburger
- Grids: `grid-cols-2` (mobile) → `lg:grid-cols-4` (desktop)
- Tables: Overflow scroll on mobile
- Spacing reduced on mobile for compact view

---

## 🔄 Data Flow & State Management

### React Query

- Query keys follow pattern: `['resource', 'action']` or `['resource', { filters }]`
- Stale time: 30 seconds default
- Retry: 1 attempt on failure
- Refetch on window focus: disabled

### Zustand Auth Store

- Manages: User session, authentication state, tier information
- Methods: `refreshSession()`, `signOut()`
- Automatically checked on app load (beforeLoad in router)

### React Router

- TanStack React Router v1.56+
- Route-based code splitting
- Context provided at root (QueryClient, auth)
- Protected routes via `beforeLoad` check

---

## 📱 Key Features

### Real-time Updates

- Notifications panel for live alerts
- Auto-refresh of jackpot data
- WebSocket support (if implemented)

### Data Export

- CSV downloads from tables
- PDF report generation
- Screenshot capabilities for wins

### Mobile Experience

- Responsive sidebar (collapses to overlay)
- Touch-optimized buttons
- Simplified tables with scroll
- Mobile-first touch gestures

### Performance

- Code splitting by route
- Image optimization (logos, avatars)
- Virtual scrolling for large tables
- Debounced filters & searches

---

## 🚀 Getting Started Notes

### Install & Run

```bash
cd apps/web
npm run dev    # Start Vite dev server (port 5173)
npm run build  # Build for production
npm run preview # Preview build locally
```

### Key Dependencies

- `react@18.3.1`
- `@tanstack/react-router@1.56.0`
- `@tanstack/react-query@5.56.0`
- `tailwindcss@latest`
- `lucide-react@0.441.0`
- `recharts` (charts)
- `@radix-ui/*` (UI primitives)
- `@supabase/supabase-js` (auth/database)

---

## 📝 Development Workflow

1. **Add new page**: Create `.tsx` file in `/pages/`
2. **Add route**: Update `/routeTree.tsx`
3. **Add navigation**: Update `navItems` in `/components/layout/AppShell.tsx`
4. **Style**: Use Tailwind classes + design system tokens
5. **Query data**: Use `@tanstack/react-query` with API client
6. **Test responsive**: Use browser dev tools (mobile toggle)

---

Generated: 2025-03-01 | Sweepbot v0.1.0
