# 🤖 SWEEPBOT: 4-AGENT COORDINATION PROTOCOL

**Last Updated:** 2026-03-10
**Status:** Active Multi-Agent System

---

## 📋 AGENT OVERVIEW

| Agent       | Domain             | Focus                     | Key Files                              |
| ----------- | ------------------ | ------------------------- | -------------------------------------- |
| **Agent 1** | Backend & Database | APIs, Services, DB        | `apps/api/`, `services/`               |
| **Agent 2** | Frontend & UI      | Web Interface, UX         | `apps/web/`, UI components             |
| **Agent 3** | Extension & Shared | Browser Ext, Types, Utils | `apps/extension/`, `packages/`         |
| **Agent 4** | DevOps & Docs      | CI/CD, Testing, Docs      | `.github/`, `docs/`, `packages/flows/` |

---

## 🎯 DOMAIN TERRITORIES

### ✅ AGENT 1: Backend & Database Infrastructure

**Primary Responsibility:** Server-side logic, data persistence, and inter-service communication

**Owns:**

- `apps/api/**` (All backend code)
- `services/**` (All microservices)
- Database schemas and migrations
- API endpoints and business logic
- Server-side validation and security
- Authentication/authorization layers

**Never Touches:**

- Frontend code (`apps/web/*`)
- Extension code (`apps/extension/*`)
- Client-side utilities (`packages/utils/src/*`)
- Documentation files
- Workflow files

---

### ✅ AGENT 2: Frontend UI & Web Application

**Primary Responsibility:** User interface, user experience, and web presentation layer

**Owns:**

- `apps/web/**` (All frontend code)
- React components and pages
- Web styling and animations
- Tailwind configuration
- Web-specific performance optimization
- Responsive design implementation
- Accessibility (A11y) features
- Web animations and transitions

**Never Touches:**

- Backend API code
- Extension code
- Shared type definitions (read-only, ask Agent 3)
- Database schemas
- Microservices
- Documentation files

---

### ✅ AGENT 3: Browser Extension & Shared Infrastructure

**Primary Responsibility:** Extension platform code and cross-application shared systems

**Owns:**

- `apps/extension/**` (All extension code)
- `packages/types/**` (Shared type definitions)
- `packages/utils/**` (Shared utilities)
- `packages/config/` (ESLint, shared configs)
- Type interfaces and contracts
- Shared validation schemas
- API client abstractions
- Cross-app shared utilities

**Never Touches:**

- Backend logic in `apps/api`
- Frontend components in `apps/web`
- Service implementations
- Documentation files
- CI/CD configuration

---

### ✅ AGENT 4: DevOps, Testing & Documentation

**Primary Responsibility:** Quality assurance, infrastructure, and knowledge management

**Owns:**

- `.github/workflows/ci.yml` (CI/CD pipeline)
- `packages/flows/**` (Flow management)
- `docs/**` (All documentation)
- Testing infrastructure and configurations
- Root configuration files
- Deployment and release automation
- Performance monitoring setup
- Developer experience tooling

**Never Touches:**

- Application source code directly (only tests)
- API implementations
- Frontend components
- Extension code
- Database migrations (runs, doesn't write)

---

## 🔄 COMMUNICATION & COORDINATION

### When Agent 1 Needs to Coordinate

**With Agent 2 (Frontend):**

- New API endpoints → Notify Agent 2 with type definitions
- Breaking API changes → Plan migration with Agent 2
- Response format changes → Provide new types via Agent 3

**With Agent 3 (Extension/Shared):**

- Need new types → Request from Agent 3
- Backend-only types → Add to `packages/types`
- API contracts → Define using shared types

**With Agent 4 (DevOps):**

- Database migrations → Make Agent 4 aware for testing
- New services → Update documentation
- Performance metrics → Report to Agent 4

### When Agent 2 Needs to Coordinate

**With Agent 1 (Backend):**

- New API calls → Ask Agent 1 for endpoints
- Type mismatches → Coordinate with Agent 3 for types
- Performance issues → Report to Agent 1 and Agent 4

**With Agent 3 (Extension/Shared):**

- Need utilities → Request from Agent 3
- New types → Coordinate with Agent 3
- Shared components → Use from packages

**With Agent 4 (DevOps):**

- Build failures → Report to Agent 4
- Performance regressions → Alert Agent 4
- Documentation → Work with Agent 4

### When Agent 3 Needs to Coordinate

**With Agent 1 (Backend):**

- API client changes → Notify Agent 1
- New endpoints needed → Submit request to Agent 1

**With Agent 2 (Frontend):**

- Updated types → Notify Agent 2
- Utility changes → Update documentation

**With Agent 4 (DevOps):**

- Flow changes → Update documentation
- Type updates → Run tests to verify

### When Agent 4 Needs to Coordinate

**With All Agents:**

- Test failures → Notify failing agent
- Documentation needs → Coordinate with relevant agent
- Performance issues → Report and collaborate on fixes

---

## 🚫 CONFLICT PREVENTION RULES

### Rule 1: File Ownership is Absolute

Each agent has exclusive write access to their domain. Other agents read-only unless explicitly granted.

### Rule 2: Shared Package Changes Require Coordination

Changes to `packages/types/**` or `packages/utils/**` affect all agents. Must coordinate.

### Rule 3: No Circular Dependencies

- Frontend can't directly import backend code
- Backend shouldn't import frontend code
- Use shared types and API contracts instead

### Rule 4: Type Contracts are Sacred

- Type definitions are contracts between agents
- Breaking type changes require coordination
- Maintain backward compatibility

### Rule 5: Database Migrations Are Sequential

Only Agent 1 writes migrations, but Agent 4 must test them. Never skip database tests.

### Rule 6: Documentation is Authoritative

Documentation (Agent 4) reflects actual code. If code changes, docs must be updated.

### Rule 7: Tests Must Pass

All agents' code must pass tests before merging. Agent 4 maintains test quality.

---

## 📊 DEPENDENCY MATRIX

```
Agent 1 (Backend)
├─ Provides: API endpoints, business logic
├─ Receives: Type definitions (from Agent 3)
└─ Communicates with: Agents 2, 3, 4

Agent 2 (Frontend)
├─ Provides: UI implementation, user flows
├─ Receives: API types, endpoints (from Agents 1, 3)
└─ Communicates with: Agents 1, 3, 4

Agent 3 (Extension & Shared)
├─ Provides: Types, utilities, contracts
├─ Receives: API specifications (from Agent 1)
└─ Communicates with: Agents 1, 2, 4

Agent 4 (DevOps & Docs)
├─ Provides: Testing, CI/CD, documentation
├─ Receives: Code to test, features to document
└─ Communicates with: Agents 1, 2, 3
```

---

## ✅ SUCCESSFUL MULTI-AGENT WORKFLOW

### Phase 1: Planning

1. Agent defines feature scope
2. Identify which agents are involved
3. Document interfaces and contracts
4. Get mutual agreement on approach

### Phase 2: Implementation

1. Agent 3 defines types first (if needed)
2. Agent 1 implements backend
3. Agent 2 implements frontend
4. Agent 3 updates utilities
5. Parallel work with no file conflicts

### Phase 3: Integration

1. All agents test their code
2. Type verification passes
3. Integration tests pass
4. E2E tests pass

### Phase 4: Release

1. Agent 4 runs full test suite
2. Documentation is updated
3. CI/CD pipeline passes
4. Release is deployed

---

## 🎯 NON-OVERLAPPING FILE ASSIGNMENT

### Exclusive Files - No Sharing

**Agent 1 Only:**

- ✅ `apps/api/src/**`
- ✅ `apps/api/drizzle.config.ts`
- ✅ `services/**/*.py` or `.js`
- ✅ `services/migrations/*.sql`
- ✅ `apps/api/.env*`

**Agent 2 Only:**

- ✅ `apps/web/src/**`
- ✅ `apps/web/tailwind.config.ts`
- ✅ `apps/web/vite.config.ts`
- ✅ `apps/web/public/**`
- ✅ `apps/web/.env*`

**Agent 3 Only:**

- ✅ `apps/extension/src/**`
- ✅ `apps/extension/public/**`
- ✅ `apps/extension/wxt.config.ts`
- ✅ `packages/types/src/**`
- ✅ `packages/utils/src/**`

**Agent 4 Only:**

- ✅ `.github/workflows/**`
- ✅ `docs/**`
- ✅ `packages/flows/**`
- ✅ Root test configuration
- ✅ Release scripts

### Shared Files - Read-Only Access (Except Owner)

**Agent 1 Writes, Others Read:**

- `apps/api/package.json` (dependency updates)
- `services/DEPLOYMENT_GUIDE.md` (update manually)

**Agent 2 Writes, Others Read:**

- `apps/web/package.json` (dependency updates)

**Agent 3 Writes, Others Read:**

- `packages/types/package.json`
- `packages/utils/package.json`
- `packages/config/package.json`

**Agent 4 Writes, Others Read:**

- `pnpm-workspace.yaml` (for new packages)
- `turbo.json` (for build config)
- `.github/workflows/**`

---

## 🔐 GUARDRAILS FOR SAFETY

### Checklist Before Each Agent Starts

- [ ] I understand my exclusive domain
- [ ] I know which files I cannot touch
- [ ] I've identified coordination needs
- [ ] I've checked for file conflicts
- [ ] I've reviewed the relevant agent prompts
- [ ] I understand the shared type contracts

### Checklist During Implementation

- [ ] My changes don't affect other agents' files
- [ ] I've used types from Agent 3 where needed
- [ ] I've notified relevant agents of changes
- [ ] Tests are passing locally
- [ ] No console errors or warnings
- [ ] Code follows the project standards

### Checklist Before Merge

- [ ] All my code is in my assigned directories
- [ ] CI/CD pipeline passes
- [ ] No merge conflicts
- [ ] Tests pass (Agent 4 verified)
- [ ] Documentation is updated
- [ ] Relevant agents have been notified

---

## 📞 ESCALATION PROTOCOL

### When Conflicts Arise

1. Identify the conflicting files
2. Determine which agents are involved
3. Review the rules above
4. If unclear, ask Agent 4 to mediate
5. Document the resolution

### When Coordination Fails

1. Stop and don't merge
2. Notify all agents
3. Review domain assignments
4. Resolve systematically
5. Add guardrail to prevent recurrence

---

## 📈 SUCCESS METRICS FOR ALL AGENTS

**All agents succeed when:**

- ✅ Zero file conflicts during implementation
- ✅ All CI/CD tests pass
- ✅ No circular dependencies
- ✅ Type system is consistent
- ✅ Documentation is complete
- ✅ Features work end-to-end
- ✅ Code quality is high
- ✅ Performance is optimal

---

**Version:** 1.0
**Status:** Active
**Last Review:** 2026-03-10
