# 🚀 AGENT QUICK START GUIDE
**For Fast Reference - See Detailed Prompts for Full Context**

---

## THE 4-AGENT SYSTEM

```
┌─────────────────────────────────────────────────────────────────┐
│                    SWEEPBOT MONOREPO                           │
├──────────────────┬──────────────────┬──────────────────┬────────┤
│   Agent 1        │    Agent 2       │    Agent 3       │Agent 4 │
│  BACKEND & DB    │  FRONTEND & UI   │  EXTENSION &     │DEVOPS& │
│  ────────────    │  ────────────    │  SHARED          │DOCS    │
│                  │                  │  ──────────      │────────│
│ apps/api/        │ apps/web/        │ apps/extension/  │.github/│
│ services/        │ src/             │ packages/types/  │packages│
│ migrations/      │ components/      │ packages/utils/  │/flows/ │
│                  │ pages/           │ packages/config/ │docs/   │
└──────────────────┴──────────────────┴──────────────────┴────────┘
```

---

## AGENT 1: BACKEND & DATABASE

### 🎯 Your Mission
- Build powerful APIs and microservices
- Design robust database schemas
- Implement security and validation
- Optimize performance and scalability

### 📁 You Own
```
apps/api/src/**
services/**
services/migrations/**
Database schemas, API logic, business logic
```

### 🚫 Never Touch
```
apps/web/**          (Agent 2's frontend)
apps/extension/**    (Agent 3's extension)
docs/**              (Agent 4's docs)
.github/workflows/   (Agent 4's CI/CD)
```

### 💡 Quick Improvements
1. Add request validation with Zod
2. Implement database indexes
3. Add comprehensive error handling
4. Create rate limiting
5. Add request/response logging
6. Optimize database queries
7. Implement caching layer
8. Add API documentation

### ✅ Before Merge
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] API documented
- [ ] Database migrations reversible
- [ ] Security reviewed

**See:** `AGENT_1_BACKEND_DATABASE.md`

---

## AGENT 2: FRONTEND & UI

### 🎯 Your Mission
- Create beautiful, responsive UIs
- Implement smooth animations
- Optimize performance and bundle size
- Ensure accessibility
- Delight users with great UX

### 📁 You Own
```
apps/web/src/**
apps/web/tailwind.config.ts
apps/web/public/**
Components, pages, styling, animations
```

### 🚫 Never Touch
```
apps/api/**          (Agent 1's backend)
apps/extension/**    (Agent 3's extension)
packages/types/**    (Only read)
docs/**              (Agent 4's docs)
```

### 💡 Quick Improvements
1. Add smooth page transitions
2. Implement dark mode
3. Create 3D animations (Three.js)
4. Add loading states
5. Optimize images
6. Implement lazy loading
7. Add ARIA labels for a11y
8. Create beautiful micro-interactions

### ✅ Before Merge
- [ ] Lighthouse score > 90
- [ ] No console errors
- [ ] Responsive on all devices
- [ ] Accessibility score 100
- [ ] All tests pass

**See:** `AGENT_2_FRONTEND_UI.md`

---

## AGENT 3: EXTENSION & SHARED

### 🎯 Your Mission
- Build powerful browser extension
- Create type-safe shared interfaces
- Implement reusable utilities
- Enable seamless cross-app communication

### 📁 You Own
```
apps/extension/src/**
apps/extension/public/**
packages/types/src/**
packages/utils/src/**
packages/config/**
```

### 🚫 Never Touch
```
apps/api/**          (Agent 1's backend)
apps/web/**          (Agent 2's frontend)
docs/**              (Agent 4's docs)
.github/workflows/   (Agent 4's CI/CD)
```

### 💡 Quick Improvements
1. Add comprehensive type definitions
2. Create API client wrapper
3. Implement offline support
4. Add error handling utilities
5. Create validation schemas
6. Implement caching utilities
7. Add formatting helpers
8. Create extension storage layer

### ✅ Before Merge
- [ ] All types properly exported
- [ ] Tests pass in both contexts
- [ ] No TypeScript errors
- [ ] Documentation complete
- [ ] Used by web and extension

**See:** `AGENT_3_EXTENSION_SHARED.md`

---

## AGENT 4: DEVOPS, TESTING & DOCS

### 🎯 Your Mission
- Maintain robust CI/CD pipeline
- Ensure high code quality
- Create excellent documentation
- Manage releases and deployments
- Improve developer experience

### 📁 You Own
```
.github/workflows/ci.yml
packages/flows/**
docs/**
Test configuration
Root configs
Deployment scripts
```

### 🚫 Never Touch
```
apps/*/src/**        (Application code)
services/*.py        (Service logic)
Do not directly modify code, only tests
```

### 💡 Quick Improvements
1. Add E2E tests with Playwright
2. Implement performance benchmarks
3. Create beautiful API docs
4. Add security scanning
5. Implement blue-green deployments
6. Create developer guides
7. Add accessibility testing
8. Improve build times

### ✅ Before Merge
- [ ] All tests pass
- [ ] Code coverage > 80%
- [ ] Documentation updated
- [ ] Security scan clean
- [ ] Performance regression check

**See:** `AGENT_4_DEVOPS_DOCS.md`

---

## 🔄 COORDINATION RULES

### Rule 1: File Ownership is Absolute
👉 Only your agent writes to your domain. Others read-only.

### Rule 2: Shared Types First
👉 Agent 3 defines types. Other agents use them.

### Rule 3: Notify on Changes
👉 Breaking changes? Notify relevant agents first.

### Rule 4: Tests Before Merge
👉 All tests must pass. Agent 4 gates all merges.

### Rule 5: Documentation Reflects Code
👉 If code changes, documentation must update.

---

## 📊 WHO WORKS ON WHAT

```
FEATURE DEVELOPMENT
Agent 1: Backend API endpoint
Agent 2: Frontend component
Agent 3: Define types & utilities
Agent 4: Write tests & docs

DEPENDENCY RESOLUTION
Agent 3 ← Agent 1 (sends API specs)
Agent 2 ← Agent 3 (gets types)
Agent 1 ← Agent 2 (gets requirements)
Agents ← Agent 4 (tests everything)

COMMUNICATION FLOW
New Feature → Agent 1 (backend) → Agent 3 (types)
              → Agent 2 (UI)   → Agent 4 (test/doc)
```

---

## ⚡ QUICK REFERENCE TABLE

| Need | Agent | File | Example |
|------|-------|------|---------|
| New API? | 1 | `apps/api/src/routes/` | Create endpoint |
| New Component? | 2 | `apps/web/src/components/` | Create React component |
| New Type? | 3 | `packages/types/src/` | Define interface |
| New Utility? | 3 | `packages/utils/src/` | Create helper |
| New Test? | 4 | `apps/*/tests/` or `e2e/` | Create test |
| New Doc? | 4 | `docs/` | Create markdown |
| Fix CI? | 4 | `.github/workflows/` | Update workflow |

---

## 🎯 SUCCESS CHECKLIST FOR YOUR SESSION

Before starting work:
- [ ] Read your full agent prompt
- [ ] Review the files you own
- [ ] Check the conflict prevention rules
- [ ] Identify other agents you need to coordinate with
- [ ] Understand the monorepo structure

During work:
- [ ] Only modify your assigned files
- [ ] Follow the quality standards
- [ ] Test thoroughly before committing
- [ ] Update documentation if needed
- [ ] Notify other agents of breaking changes

After work:
- [ ] All tests pass (Agent 4 verifies)
- [ ] No conflicts with other agents
- [ ] Documentation is updated
- [ ] Code is reviewed and approved
- [ ] Ready for merge

---

## 📚 FULL DOCUMENTATION

For complete details, see:
- **Agent 1:** `AGENT_1_BACKEND_DATABASE.md`
- **Agent 2:** `AGENT_2_FRONTEND_UI.md`
- **Agent 3:** `AGENT_3_EXTENSION_SHARED.md`
- **Agent 4:** `AGENT_4_DEVOPS_DOCS.md`
- **Coordination:** `AGENT_COORDINATION.md`

---

## 🚀 Ready to Start?

1. Find your agent number (1-4)
2. Read your detailed prompt file
3. Review the coordination document
4. Check the conflict prevention rules
5. Start working on your domain!

**Remember:** No overlapping files = happy agents = successful Sweepbot! 🎉
