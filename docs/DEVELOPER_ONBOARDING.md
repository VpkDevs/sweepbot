# SweepBot — Developer Onboarding Guide

**Audience:** New contributors, contractors, and future team members
**Prerequisite:** You have access to the repository and have read `README.md`

---

## 1. Mental Model First

Before touching code, understand what SweepBot IS:

```
SweepBot is not just a data tracker.
It is an automation operating system for sweepstakes casino players.

The core product is this loop:
  OBSERVE (Extension intercepts data)
  → RECORD (API + Supabase stores it)
  → ANALYZE (Dashboard surfaces insights)
  → ACT (Flows Engine executes automations)
  → REPEAT
```

Every piece of code either feeds into, or is enforced by, this loop.

---

## 2. Repository Layout — What Lives Where

```
apps/api/         → The brain. All business logic + data access lives here.
apps/web/         → The face. What users see.
apps/extension/   → The hands + eyes. Reads casino pages. Runs actions.
packages/flows/   → The engine. NLP → AST → Execution. Phase 1 complete.
packages/types/   → The contract. Source of truth for ALL data shapes.
packages/utils/   → The toolbox. Shared helpers only.
packages/config/  → The standards. ESLint, TypeScript, Tailwind config.
docs/             → The knowledge base. Read before building.
```

**Rule:** If you're unsure where something lives, start with `packages/types/`. If the type doesn't exist yet, you probably need to define it there first.

---

## 3. Initial Setup

````bash
# 1. Install dependencies (pnpm is mandatory — do not use npm or yarn)
pnpm install

# 2. Set up environment
cp .env.example .env
# Fill in required secrets:
#   SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY, UPSTASH_REDIS_URL
#   (optional for local dev) VITE_POSTHOG_KEY, VITE_SENTRY_DSN

# 3. Verify everything builds
pnpm typecheck
pnpm lint
pnpm test

# 4. Start dev servers
pnpm dev

## Building & Deploying the Web App

> ⚠️ **Performance & Accessibility**
> Run a local Lighthouse audit (`npx lighthouse http://localhost:5173`) after starting the preview server. Fix any critical accessibility (alt tags, color contrast) or performance issues before merging major UI changes. Several pages already had alt text fixes applied during the sprint.

When you're adding UI that affects navigation or layouts, add a basic end‑to‑end test under `apps/web/src/tests/e2e` and run with `pnpm --filter "@sweepbot/web" run test:e2e`. The tests expect a preview server running on port 5173; start it in another terminal (`pnpm --filter "@sweepbot/web" preview`).


The web dashboard is a Vite project under `apps/web`.

```bash
# build the TypeScript and bundle assets
pnpm --filter "@sweepbot/web" build

# preview locally
pnpm --filter "@sweepbot/web" preview

# deploy (requires Vercel CLI and project configured)
pnpm --filter "@sweepbot/web" deploy
````

The repository already includes a GitHub Actions workflow that runs the build step and pushes to Vercel; the `deploy` script is mainly for local testing or manual pushes.

```

If `pnpm typecheck` fails before you've written a line: stop and read the error. It means a type in `packages/types` has been updated and something downstream hasn't caught up.

---

## 4. How to Add a New Casino Platform

This is the most common extension task. Here's the exact sequence:

**Step 1 — Add to the platform seed data**
```

apps/api/src/db/schema/ → Find the platforms seed file

```
Add the new platform with its `slug`, `name`, `url`, and `affiliate_url`.

**Step 2 — Register in the NLP Entity Recognizer**
```

packages/flows/src/interpreter/entity-recognizer.ts

```
Add the platform's name and all known aliases to the `PLATFORM_ALIASES` map.

**Step 3 — Add host permission to extension**
```

apps/extension/wxt.config.ts

```
Add the platform's domain to `host_permissions`. Do not use wildcards beyond the subdomain level.

**Step 4 — Write the XHR interceptor pattern**
```

apps/extension/src/lib/interceptors/

```
Each platform has a unique API response format for spin results. Write a parser for the new platform that extracts `{ bet, win, balance }` from its response payload.

**Step 5 — Test**
Write a unit test in `apps/extension/src/__tests__/` that replays a captured response and asserts correct extraction.

---

## 5. How to Add a New Flow Action Type

Flow actions are what the executor runs when a user says "claim bonus" or "spin."

**Step 1 — Define the type**
```

packages/flows/src/types.ts → FlowActionType union

```

**Step 2 — Register in the Entity Recognizer**
```

packages/flows/src/interpreter/entity-recognizer.ts → ACTIONS map

```
Add the keywords that should map to this new action.

**Step 3 — Implement the handler**
```

packages/flows/src/executor/executor.ts → executeAction()

```
Add a case to the action type switch. The handler receives `FlowExecutionContext` and must return `FlowActionResult`.

**Step 4 — Write tests**
```

packages/flows/src/**tests**/executor.test.ts

```
Add at minimum: a happy path test, a timeout test, and a guardrail-blocked test.

---

## 6. Adding a New API Endpoint

```

apps/api/src/routes/ → Create or extend a route file
apps/api/src/server.ts → Register the route plugin

````

Every endpoint must have:
1. **Zod input validation** — parse the request body/params before using them
2. **Auth middleware** — verify the JWT (use the shared middleware hook)
3. **Rate limiting** — add the route to the rate-limit config
4. **Typed response** — define the response shape in `packages/types/`
5. **Test** — at minimum a happy path + an auth-failure test

---

## 7. TypeScript Rules (Non-Negotiable)

- **No `any` types** in `packages/flows/`, `packages/types/`, or `apps/api/src/`
- **No type assertions (`as SomeType`)** unless accompanied by a comment explaining why
- **No implicit `any`** — `tsconfig.json` has `strict: true` in all packages
- **Discriminated unions** for any "typed object" patterns (see `FlowNode` in `packages/flows/src/types.ts` as the reference implementation)

Violation of these rules will cause CI to fail. Fix the types, don't suppress the errors.

---

## 8. Testing Standards

| Package | Target Coverage | Test Runner |
|---------|----------------|-------------|
| `packages/flows` | 80%+ (lines, functions, statements) | Vitest |
| `apps/api` | 70%+ (critical paths) | Vitest |
| `apps/extension` | 70%+ (interceptors + actions) | Vitest |
| `apps/web` | 60%+ (components, hooks) | Vitest + Testing Library |

Run coverage locally before pushing:
```bash
pnpm test:coverage
````

---

## 9. Responsible Play — Mandatory Review

**Any feature that touches user automation MUST be reviewed against this checklist:**

- [ ] Does this feature have a configurable limit (time, money, iterations)?
- [ ] Have the mandatory guardrails (`cool_down_check`, `max_duration`) been preserved?
- [ ] Could this feature enable or conceal loss-chasing behavior?
- [ ] Is there a clear user-facing OFF switch?

The `ResponsiblePlayValidator` in `packages/flows/src/validator/` is the enforcer. Do not bypass it. Do not set guardrails to arbitrarily high values to "pass" validation. If a feature can't survive responsible play review, it doesn't ship.

---

## 10. Git Workflow

```bash
# Branch naming
feature/short-description
fix/what-was-broken
docs/what-was-documented
chore/maintenance-task

# Commit style (conventional commits)
feat: add Fortune Coins platform to NLP entity recognizer
fix: correct RTP calculation when win amount is zero
docs: add developer onboarding guide
chore: bump drizzle-orm to 0.31.0

# Before pushing
pnpm typecheck && pnpm lint && pnpm test
```

PRs that fail CI are not merged. No exceptions.

---

## 11. Key Files to Bookmark

| File                                                  | Why                                     |
| ----------------------------------------------------- | --------------------------------------- |
| `packages/flows/src/types.ts`                         | Every Flow data type                    |
| `packages/flows/src/interpreter/entity-recognizer.ts` | NLP keyword maps                        |
| `packages/flows/src/executor/executor.ts`             | Runtime execution logic                 |
| `apps/api/src/server.ts`                              | API server config + plugin registration |
| `packages/types/src/`                                 | All shared interfaces                   |
| `docs/TECHNICAL_ARCHITECTURE.md`                      | System-level decisions                  |
| `docs/SECURITY_ARCHITECTURE.md`                       | Security constraints                    |

---

_Onboarding guide maintained by APPYness. Last updated March 2026._
