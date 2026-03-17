# 🤖 SWEEPBOT: 4-AGENT AUTONOMOUS SYSTEM

**Independent Coding Agents - Zero File Conflicts**

---

## 📌 OVERVIEW

This is a 4-agent autonomous coding system for Sweepbot development. Each agent has:

- ✅ **Exclusive domain** - Files only they modify
- ✅ **Clear mission** - Specific responsibilities
- ✅ **No overlaps** - Zero file conflicts by design
- ✅ **Coordination protocol** - How to work together
- ✅ **Quality standards** - What success looks like

All agents can work simultaneously without stepping on each other's code.

---

## 🎯 THE 4 AGENTS

### **🔧 AGENT 1: Backend & Database Specialist**

**Focus:** Server-side infrastructure, APIs, microservices, database

| Aspect            | Details                                                |
| ----------------- | ------------------------------------------------------ |
| **Domain**        | `apps/api/`, `services/`, database migrations          |
| **Mission**       | Build robust APIs, optimize databases, ensure security |
| **Key Tasks**     | API endpoints, business logic, data persistence        |
| **Never Touches** | `apps/web/`, `apps/extension/`, `docs/`                |
| **Coordination**  | Types (from Agent 3), Frontend needs (from Agent 2)    |

👉 **Read:** `AGENT_1_BACKEND_DATABASE.md`

---

### **🎨 AGENT 2: Frontend & UI Specialist**

**Focus:** Web interface, user experience, animations, accessibility

| Aspect            | Details                                                |
| ----------------- | ------------------------------------------------------ |
| **Domain**        | `apps/web/`, components, styling, animations           |
| **Mission**       | Beautiful UI, smooth interactions, optimal performance |
| **Key Tasks**     | React components, design system, A11y, animations      |
| **Never Touches** | `apps/api/`, `apps/extension/`, backend code           |
| **Coordination**  | API types (from Agent 3), endpoints (from Agent 1)     |

👉 **Read:** `AGENT_2_FRONTEND_UI.md`

---

### **⚙️ AGENT 3: Extension & Shared Infrastructure Specialist**

**Focus:** Browser extension, shared types, cross-app utilities

| Aspect            | Details                                                  |
| ----------------- | -------------------------------------------------------- |
| **Domain**        | `apps/extension/`, `packages/types/`, `packages/utils/`  |
| **Mission**       | Extension features, type safety, reusable utilities      |
| **Key Tasks**     | Shared types, utilities, extension functionality         |
| **Never Touches** | `apps/api/` logic, `apps/web/` components                |
| **Coordination**  | API specs (from Agent 1), UI requirements (from Agent 2) |

👉 **Read:** `AGENT_3_EXTENSION_SHARED.md`

---

### **📊 AGENT 4: DevOps, Testing & Documentation Specialist**

**Focus:** CI/CD, testing, documentation, developer experience

| Aspect            | Details                                                 |
| ----------------- | ------------------------------------------------------- |
| **Domain**        | `.github/workflows/`, `docs/`, `packages/flows/`, tests |
| **Mission**       | Quality assurance, automation, knowledge management     |
| **Key Tasks**     | Tests, CI/CD pipeline, documentation, deployments       |
| **Never Touches** | Direct code in `apps/*/src/` (only tests)               |
| **Coordination**  | Test all agents, document features, ensure quality      |

👉 **Read:** `AGENT_4_DEVOPS_DOCS.md`

---

## 🔄 MULTI-AGENT WORKFLOW

### Phase 1: Planning

```
Feature Idea
    ↓
Agent 1: Define backend contract (API types)
    ↓
Agent 3: Formalize types and utilities
    ↓
Agent 2: Design UI components
    ↓
Agent 4: Create test plan and documentation outline
```

### Phase 2: Parallel Development

```
Agent 1: Build API endpoints
    ↕ (uses types from Agent 3)
Agent 2: Build UI components
    ↕ (uses types from Agent 3)
Agent 3: Refine types and utilities based on needs
    ↕ (all use from Agent 3)
Agent 4: Write tests as code is completed
```

### Phase 3: Integration & Testing

```
All agents' code → Agent 4 CI/CD pipeline → Tests pass
    ↓
Full feature integration complete
    ↓
Documentation updated by Agent 4
    ↓
Ready for production
```

---

## 📁 FILE OWNERSHIP MATRIX

### Agent 1 (Backend) Owns

```
✅ apps/api/src/**           - All API code
✅ services/**               - All services
✅ services/migrations/**    - Database migrations
✅ apps/api/drizzle.config.ts
✅ Database schemas
✅ API business logic
```

### Agent 2 (Frontend) Owns

```
✅ apps/web/src/**           - All web code
✅ apps/web/components/**    - React components
✅ apps/web/pages/**         - Page components
✅ apps/web/tailwind.config.ts
✅ Web styling and animations
✅ Responsive design
```

### Agent 3 (Extension/Shared) Owns

```
✅ apps/extension/src/**     - All extension code
✅ packages/types/src/**     - Type definitions
✅ packages/utils/src/**     - Utilities
✅ packages/config/**        - ESLint, configs
✅ Shared validation schemas
✅ API client wrappers
```

### Agent 4 (DevOps) Owns

```
✅ .github/workflows/**      - CI/CD pipeline
✅ docs/**                   - All documentation
✅ packages/flows/**         - Flow management
✅ Test infrastructure
✅ Release scripts
✅ Performance monitoring
```

---

## 🚫 CONFLICT PREVENTION RULES

### Rule 1: Exclusive Domains

Each agent has files **only they write to**. Others read-only.

### Rule 2: Shared Packages First

Agent 3 defines types before other agents use them.

### Rule 3: No Code Imports Across Boundaries

```
❌ Frontend should NOT import from apps/api/src
❌ Backend should NOT import from apps/web/src
✅ Use types from packages/types instead
```

### Rule 4: Test Gate

No merge without Agent 4's approval. Tests must pass.

### Rule 5: Documentation is Law

If code changes, docs (Agent 4) must reflect it.

### Rule 6: Notify on Breaking Changes

Any breaking change must be coordinated in advance.

---

## 💡 AGENT ENHANCEMENT TARGETS

**Following special instructions for maximum impact each session:**

### Agent 1

- Dramatically improve API scalability
- Add robust error handling
- Implement caching layers
- Create comprehensive security

### Agent 2

- Dramatically improve UI design
- Add smooth animations (GSAP/Three.js)
- Implement advanced interactions
- Create stunning visual effects

### Agent 3

- Dramatically improve type safety
- Add comprehensive utilities
- Implement error handling layer
- Create robust API client

### Agent 4

- Dramatically improve test coverage
- Add comprehensive documentation
- Implement advanced CI/CD
- Create better developer experience

---

## ✅ SUCCESS METRICS

### All Agents Succeed When

- ✅ Zero file conflicts during development
- ✅ All CI/CD tests pass
- ✅ Code coverage > 80%
- ✅ No circular dependencies
- ✅ Features work end-to-end
- ✅ Documentation is complete
- ✅ Performance is optimized
- ✅ Security standards met

---

## 📚 DETAILED DOCUMENTATION

### For Agents

- `AGENT_1_BACKEND_DATABASE.md` - Backend specialist guide
- `AGENT_2_FRONTEND_UI.md` - Frontend specialist guide
- `AGENT_3_EXTENSION_SHARED.md` - Extension specialist guide
- `AGENT_4_DEVOPS_DOCS.md` - DevOps specialist guide

### For Coordination

- `AGENT_COORDINATION.md` - Full coordination protocol
- `AGENT_QUICK_START.md` - Quick reference guide
- `README_AGENTS.md` - This file

---

## 🚀 QUICK START FOR AGENTS

### Agent 1 (Backend)

1. Read `AGENT_1_BACKEND_DATABASE.md`
2. Start with `apps/api/src/`
3. Implement API improvements
4. Notify Agent 4 when ready
5. Pass all tests

### Agent 2 (Frontend)

1. Read `AGENT_2_FRONTEND_UI.md`
2. Start with `apps/web/src/`
3. Implement UI improvements
4. Use types from Agent 3
5. Pass all Lighthouse checks

### Agent 3 (Extension/Shared)

1. Read `AGENT_3_EXTENSION_SHARED.md`
2. Review types first
3. Update `packages/types/` as needed
4. Ensure all agents can use
5. Document all exports

### Agent 4 (DevOps)

1. Read `AGENT_4_DEVOPS_DOCS.md`
2. Review test configuration
3. Run tests for all agents
4. Update documentation
5. Gate all merges

---

## 🔐 SAFETY CHECKLIST

Before each agent starts work:

- [ ] I've read my full agent prompt
- [ ] I understand my exclusive domain
- [ ] I know what files I cannot touch
- [ ] I understand coordination needs
- [ ] I've reviewed conflict prevention rules
- [ ] I'm ready to work independently

During implementation:

- [ ] I'm only modifying my domain files
- [ ] Tests are passing locally
- [ ] No console errors
- [ ] Code follows standards
- [ ] Documentation is updated

Before merge:

- [ ] CI/CD pipeline passes
- [ ] No file conflicts
- [ ] Tests pass (Agent 4 verified)
- [ ] Other agents notified (if needed)
- [ ] Documentation complete

---

## 📊 SYSTEM STATUS

| Agent | Status   | Domain             | Files    |
| ----- | -------- | ------------------ | -------- |
| 1     | ✅ Ready | Backend & DB       | 15+ dirs |
| 2     | ✅ Ready | Frontend & UI      | 10+ dirs |
| 3     | ✅ Ready | Extension & Shared | 8+ dirs  |
| 4     | ✅ Ready | DevOps & Docs      | 5+ dirs  |

**Total:** Zero file overlaps, 100% parallel development possible

---

## 🎯 FINAL NOTES

This system is designed for **maximum efficiency and zero conflicts**:

1. **Each agent is independent** - Can work without waiting for others
2. **Clear ownership** - No ambiguity about who owns what
3. **Type safety** - Shared contracts prevent integration issues
4. **Quality gates** - Tests ensure all code works together
5. **Documentation** - Everything is recorded and accessible

The key to success: **Stick to your domain, communicate changes, and let Agent 4 coordinate testing.**

---

## 📞 QUESTIONS?

Refer to:

- Your specific agent prompt (AGENT*1/2/3/4*.md)
- The coordination protocol (AGENT_COORDINATION.md)
- The quick reference (AGENT_QUICK_START.md)

**Status:** ✅ All systems ready for parallel autonomous development

**Last Updated:** 2026-03-10
**Version:** 1.0
**Ready:** YES 🚀
