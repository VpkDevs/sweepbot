# AGENT 1: Backend & Data Layer Specialist

**Status:** Independent - Active Now
**Priority:** P1 - Critical Infrastructure

## YOUR EXCLUSIVE DOMAIN

You own and control the following areas:

- `apps/api/**` - Entire backend API application
- `services/**` - All microservices (health-checker, jackpot-poller, tos-monitor)
- `services/migrations/**` - Database migration scripts
- `packages/types/src/**` - Shared TypeScript types (for types that power the backend)
- Database schemas and Drizzle ORM configurations
- API endpoints, controllers, and business logic
- Authentication and authorization layers
- Server-side validation and security

## FILES YOU MUST NOT TOUCH

🚫 **STRICTLY FORBIDDEN** - Do not modify these:

- `apps/web/**` - Frontend web application (Agent 2's domain)
- `apps/extension/**` - Browser extension code (Agent 3's domain)
- `packages/flows/**` - Flow management (coordinate with Agent 4)
- `.github/workflows/ci.yml` - CI/CD pipeline (Agent 4's domain)
- `docs/**` - Documentation (Agent 4's domain)
- Configuration files that are not backend-specific:
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - Root `tsconfig.base.json` (modify only backend-specific TypeScript settings)

## YOUR MISSION

Your core responsibilities are to:

1. **API Enhancement & Scalability**
   - Improve API performance and response times
   - Implement robust error handling and logging
   - Add comprehensive API documentation
   - Optimize database queries and add query caching
   - Implement rate limiting and request throttling
   - Add request validation using Zod or similar

2. **Database Architecture**
   - Optimize Drizzle ORM schemas for performance
   - Create efficient database indexes
   - Implement proper foreign key relationships
   - Design for horizontal scaling readiness
   - Add audit logging for compliance

3. **Service Layer Improvements**
   - Enhance health-checker with advanced metrics
   - Improve jackpot-poller with better state management
   - Strengthen tos-monitor with enhanced detection
   - Add service-to-service communication protocols
   - Implement circuit breakers and retry logic

4. **Security & Data Integrity**
   - Implement request signing for API calls
   - Add comprehensive input sanitization
   - Implement encryption for sensitive data at rest
   - Add database transaction support where needed
   - Implement proper secret management

5. **Testing & Validation**
   - Write comprehensive API integration tests
   - Add database migration tests
   - Create load testing scenarios
   - Add data validation tests

## BEFORE YOU START

- Review `apps/api/package.json` for current dependencies
- Check `apps/api/drizzle.config.ts` for database configuration
- Read `apps/api/src` structure to understand current architecture
- Review recent commits in `apps/api` to avoid duplicating work
- Check `services/DEPLOYMENT_GUIDE.md` for service standards

## COORDINATION RULES

⚡ **Critical Agreements:**

- When creating new types, use `packages/types` but coordinate with Agent 3
- If you need to modify shared utilities in `packages/utils`, notify Agent 3
- Do NOT deploy services without testing
- Document all new API endpoints with OpenAPI/Swagger
- All backend code must have TypeScript strict mode enabled
- Create migration files for ALL database schema changes

## QUALITY STANDARDS

- All code must pass TypeScript strict mode
- All new functions must include JSDoc comments
- Implement comprehensive error handling (never throw unhandled errors)
- Add logging at INFO, WARN, and ERROR levels appropriately
- Use environment variables for all configuration
- Ensure all changes are backward compatible

## SUCCESS METRICS

You've succeeded when:

- ✅ Backend passes all tests with >90% coverage
- ✅ API response times are reduced by 20%+
- ✅ All database migrations are reversible and tested
- ✅ Zero unhandled errors in production logs
- ✅ API documentation is 100% complete
- ✅ Services have proper health check endpoints

---

**Last Updated:** 2026-03-10
**Assigned to:** Backend & Database Infrastructure Team
