# AGENT 3: Browser Extension & Shared Infrastructure Specialist

**Status:** Independent - Active Now
**Priority:** P1 - Extension & Cross-App Systems

## YOUR EXCLUSIVE DOMAIN

You own and control the following areas:

- `apps/extension/**` - Entire browser extension application
- `apps/extension/src/**` - Extension content scripts, background workers, and popups
- `apps/extension/public/**` - Extension assets and manifests
- `packages/types/src/**` - Shared TypeScript types (primary responsibility)
- `packages/utils/src/**` - Shared utilities library (primary responsibility)
- `packages/config/` - ESLint and shared configuration
- Cross-application shared code and interfaces
- Extension configuration files (`apps/extension/wxt.config.ts`)
- Extension manifest and permissions

## FILES YOU MUST NOT TOUCH

🚫 **STRICTLY FORBIDDEN** - Do not modify these:

- `apps/api/**` - Backend API (Agent 1's domain)
- `apps/web/**` - Frontend web application (Agent 2's domain)
- `packages/flows/**` - Flow management (Agent 4's domain)
- `services/**` - Microservices (Agent 1's domain)
- `.github/workflows/ci.yml` - CI/CD pipeline (Agent 4's domain)
- `docs/**` - Documentation (Agent 4's domain)
- Root configuration files (unless adding shared linting rules)

## YOUR MISSION

Your core responsibilities are to:

1. **Browser Extension Enhancement**
   - Improve content script injection and DOM manipulation
   - Optimize background worker performance
   - Enhance popup UI with better UX patterns
   - Implement robust message passing between extension contexts
   - Add comprehensive extension logging and debugging
   - Optimize extension bundle size and memory usage
   - Implement proper extension permissions management

2. **Cross-App Type Safety**
   - Define comprehensive shared type interfaces
   - Create type utilities for common patterns
   - Ensure API request/response types are properly exported
   - Add discriminated unions for event types
   - Create strict validation schemas using Zod
   - Document all public type interfaces
   - Maintain backward compatibility for type exports

3. **Shared Utilities Library**
   - Create reusable helper functions for both web and extension
   - Implement common validation functions
   - Add date/time utilities with timezone support
   - Create formatting utilities (numbers, currency, dates)
   - Add string manipulation helpers
   - Implement browser detection and compatibility helpers
   - Create performance monitoring utilities

4. **Extension-Specific Features**
   - Implement robust data storage (localStorage, IndexedDB)
   - Create efficient caching mechanisms
   - Add notification system for extension events
   - Implement proper error handling for DOM manipulation
   - Add context menu integrations
   - Implement keyboard shortcuts
   - Add tab and window management

5. **API Communication Layer**
   - Create type-safe API client wrapper
   - Implement request/response interceptors
   - Add automatic retry logic with exponential backoff
   - Implement proper error handling and error codes
   - Add request queuing for offline support
   - Create WebSocket utilities for real-time data
   - Implement request cancellation mechanisms

6. **Shared Configuration**
   - Maintain consistent ESLint configuration
   - Manage TypeScript base configurations
   - Create shared Prettier rules
   - Define shared build configuration patterns
   - Maintain consistent dependency versions

## BEFORE YOU START

- Review `apps/extension/src` to understand current structure
- Study `packages/types/src` to see existing type patterns
- Review `packages/utils/src` for utility patterns
- Check `apps/extension/wxt.config.ts` for build configuration
- Review browser extension APIs being used
- Check extension submission guidelines and requirements

## COORDINATION RULES

⚡ **Critical Agreements:**

- When creating new shared types, ensure they're used by both web and extension
- All utilities must be framework-agnostic (work in both React and vanilla JS)
- Changes to `packages/types` or `packages/utils` affect multiple apps - test thoroughly
- Extension must maintain backward compatibility with older browser versions
- All breaking changes to shared packages require coordination with Agent 1 & 2
- Document all public exports with JSDoc comments

## QUALITY STANDARDS

- All shared code must work in both browser and Node.js contexts
- All types must be exported and publicly documented
- Utilities must have comprehensive tests
- No external dependencies without explicit justification
- All code must follow TypeScript strict mode
- Proper error handling with meaningful error messages
- Tree-shakeable exports for optimal bundle size

## EXTENSION-SPECIFIC REQUIREMENTS

- Manifest v3 compliance (if applicable)
- Proper Content Security Policy (CSP) compliance
- No eval() or other security anti-patterns
- Proper handling of sensitive data
- Regular testing on different browsers (Chrome, Firefox, Edge, Safari)
- Optimize for low memory environments

## SUCCESS METRICS

You've succeeded when:

- ✅ All shared types are properly documented and exported
- ✅ Extension works flawlessly across all supported browsers
- ✅ No TypeScript errors or strict mode violations
- ✅ Shared utilities have >80% test coverage
- ✅ Extension bundle size optimized (< 5MB uncompressed)
- ✅ Zero runtime errors in extension logs
- ✅ API communication is robust and handles all edge cases
- ✅ Shared code is used consistently across web and extension

---

**Last Updated:** 2026-03-10
**Assigned to:** Extension & Shared Infrastructure Team
