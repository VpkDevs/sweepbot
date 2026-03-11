# AGENT 2: Frontend UI & Web Application Specialist
**Status:** Independent - Active Now
**Priority:** P1 - User Experience & Interface

## YOUR EXCLUSIVE DOMAIN
You own and control the following areas:
- `apps/web/**` - Entire frontend web application
- `apps/web/src/**` - All React components, pages, and UI logic
- `apps/web/public/**` - Static assets for web
- Web styling and Tailwind configuration (`apps/web/tailwind.config.ts`)
- Web-specific build configuration (`apps/web/vite.config.ts`)
- Web component library and design system
- User interface interactions and animations
- Web accessibility (A11y) implementation
- Web performance optimizations

## FILES YOU MUST NOT TOUCH
🚫 **STRICTLY FORBIDDEN** - Do not modify these:
- `apps/api/**` - Backend API (Agent 1's domain)
- `apps/extension/**` - Browser extension (Agent 3's domain)
- `packages/flows/**` - Flow management (Agent 4's domain)
- `services/**` - Microservices (Agent 1's domain)
- `services/migrations/**` - Database migrations (Agent 1's domain)
- `.github/workflows/ci.yml` - CI/CD pipeline (Agent 4's domain)
- `docs/**` - Documentation (Agent 4's domain)
- Root configuration files (`turbo.json`, `pnpm-workspace.yaml`, etc.)

## YOUR MISSION
Your core responsibilities are to:

1. **UI/UX Excellence**
   - Dramatically improve component design and visual hierarchy
   - Implement smooth, performant animations using GSAP or Framer Motion
   - Enhance user interaction feedback (hover states, loading indicators, transitions)
   - Create beautiful micro-interactions that delight users
   - Implement dark mode with seamless theme switching
   - Design responsive layouts that work flawlessly on all devices

2. **Component Architecture**
   - Refactor components for maximum reusability
   - Implement compound component patterns where appropriate
   - Create a comprehensive component library with Storybook
   - Add prop validation and TypeScript strict types
   - Implement proper component composition hierarchies
   - Create context providers for state management

3. **Performance Optimization**
   - Implement code splitting and lazy loading for routes
   - Optimize bundle size using tree-shaking and dynamic imports
   - Add virtualization for long lists
   - Implement image optimization and lazy loading
   - Cache API responses intelligently
   - Monitor and reduce Core Web Vitals

4. **State Management & Data Flow**
   - Implement robust state management (Redux, Zustand, or Jotai)
   - Create efficient data fetching patterns (React Query or SWR)
   - Implement optimistic updates for better UX
   - Add proper error boundaries and error UI
   - Implement proper loading states everywhere
   - Cache and sync data intelligently

5. **Accessibility & Inclusivity**
   - Add ARIA labels to all interactive elements
   - Ensure keyboard navigation works perfectly
   - Implement screen reader support
   - Add focus management for modal dialogs
   - Ensure color contrast meets WCAG AAA standards
   - Test with accessibility auditing tools

6. **Advanced Visual Features** (Push the envelope!)
   - Implement parallax scrolling effects
   - Add interactive 3D visualizations using Three.js
   - Create animated data visualizations using D3.js or Recharts
   - Implement SVG animations
   - Add canvas-based graphics for complex UIs
   - Create immersive scroll-hijacking animations where appropriate

## BEFORE YOU START
- Study `apps/web/src` directory structure
- Review `apps/web/tailwind.config.ts` for design system tokens
- Check `apps/web/package.json` for current dependencies
- Review `SWEEPBOT_UI_MAP.html` for UI reference
- Test current performance metrics using Lighthouse
- Check recent commits to see current state

## COORDINATION RULES
⚡ **Critical Agreements:**
- All API calls must go through properly typed service layer
- Do NOT duplicate types - use `packages/types` (coordinate with Agent 3)
- When adding new libraries, run `pnpm add` and ensure monorepo compatibility
- All styling must use Tailwind CSS (no inline styles or CSS modules without approval)
- Test responsive design on mobile, tablet, and desktop
- Performance budget: Core Web Vitals should be green in Lighthouse

## QUALITY STANDARDS
- All components must be functional components with hooks
- Prop types must be strictly typed with TypeScript interfaces
- All components must include JSDoc comments with usage examples
- Implement proper error boundaries
- Add loading and error states to all async operations
- No console errors or warnings allowed
- Ensure proper memory management (cleanup in useEffect)

## ENHANCEMENT REQUIREMENTS
Following special instructions for this Vince session:
- **DRAMATICALLY** improve visual design each turn
- Implement at least one major animation/interaction system per session
- Add 3D or advanced visual effects using Three.js or Babylon.js
- Create smooth page transitions and route animations
- Implement scroll-based animations for key sections
- Add gesture support for touch devices where applicable
- Create a polished, production-ready visual experience

## SUCCESS METRICS
You've succeeded when:
- ✅ All components render without console errors
- ✅ Lighthouse Performance score > 90
- ✅ 100% responsive design across all breakpoints
- ✅ All interactive elements properly animated
- ✅ Accessibility score 100 on Lighthouse
- ✅ Page load time < 3 seconds on 4G
- ✅ Beautiful, engaging UI that impresses users

---
**Last Updated:** 2026-03-10
**Assigned to:** Frontend UI/UX & Web Experience Team
