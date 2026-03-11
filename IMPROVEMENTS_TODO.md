# Codebase Improvements TODO

## Phase 1: Type System Fixes ✅ COMPLETED

### 1.1 Fix types package exports ✅ DONE
- [x] Export `validation.ts` from `packages/types/src/index.ts`
- [x] Fixed duplicate type exports (Session, Platform, Subscription)

### 1.2 Fix analytics types ✅ ALREADY DONE
- [x] Analytics types are properly set up in TypeScript

### 1.3 Export Zod schemas from flows package ✅ ALREADY DONE
- [x] Flows package exports types which include Zod schemas

## Phase 2: Security Improvements ✅ COMPLETED

### 2.1 Fix executor expression evaluation ✅ DONE
- [x] Created safe-evaluator.ts with secure expression parsing
- [x] Replaced unsafe `new Function()` with safe recursive descent parser
- [x] Added expression validation

## Phase 3: Web App Improvements ✅ COMPLETED

### 3.1 Add environment validation to web app ✅ DONE
- [x] Created `apps/web/src/lib/env.ts` with Zod validation
- [x] Added `.env.example` for web app
- [ ] Import and validate on app startup (optional)

### 3.2 Improve React Query error handling ✅ DONE
- [x] Created `apps/web/src/lib/query-provider.tsx` with retry logic
- [x] Added loading/error/empty fallback components

## Phase 4: API Improvements ⏳ PENDING

### 4.1 Add consistent error typing
- [ ] Create shared error types for API routes
- [ ] Add proper error return typing

### 4.2 Add Flow interpretation types to API
- [ ] Export proper types for Flow interpretation response
- [ ] Add frontend types for interpret endpoint

## Phase 5: Additional Improvements ⏳ PENDING

### 5.1 Add missing validation schemas
- [ ] Add platform CRUD schemas
- [ ] Add analytics query schemas

### 5.2 Improve code organization
- [ ] Add JSDoc comments to key functions
- [ ] Organize exports consistently

---

## Summary of Completed Improvements

1. **Type Exports Fixed**: Exported validation schemas from types package, fixed duplicate exports
2. **Security Enhanced**: Created safe expression evaluator to replace unsafe `new Function()`
3. **Web App Validated**: Added environment validation with Zod schemas
4. **Query Provider**: Added React Query provider with retry logic and fallback components

