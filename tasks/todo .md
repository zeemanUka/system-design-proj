# Stage 9 Execution Plan

## Scope
Implement and verify:
- Stage 9: audit logs, request/job telemetry, security hardening, load testing, runbooks, and beta readiness sign-off

## Plan
- [x] 1. Mark Stage 9 in progress in trackers
- [x] 2. Add persistence models/migration for `audit_logs`, `request_telemetry`, and `job_telemetry`
- [x] 3. Implement API observability layer (request telemetry + audit log capture on response hook)
- [x] 4. Implement API security hardening (global rate limiting, secure headers, stricter CORS/body/input handling)
- [x] 5. Implement worker-side job telemetry for simulation and grading queues
- [x] 6. Add load-test tooling for critical API paths and queue enqueue throughput
- [x] 7. Add Stage 9 operational docs (runbook, incident response, authZ review matrix)
- [x] 8. Add beta checklist + go/no-go decision document
- [x] 9. Run verification (`prisma generate`, lint, typecheck, tests, load test, live smoke)
- [x] 10. Mark Stage 9 done in trackers

## Review
Completed Stage 9 hardening, observability, and beta readiness.

Verification evidence:
- Prisma + schema updates:
  - `npm --workspace @sdc/api run prisma:generate` passed.
  - `npx prisma db push --schema apps/api/prisma/schema.prisma --accept-data-loss` applied Stage 9 schema.
- Workspace quality gates passed:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
- Stage 9 load test executed:
  - `npm run loadtest:stage9`
  - Results saved to `docs/load-test-results.json` (all suites 16/16 success).
- Security verification passed:
  - Rate limit check: repeated `/auth/login` requests produced `429` responses after threshold.
  - Secure headers check via `curl -I` confirmed `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, and rate-limit headers.
- Telemetry persistence verified:
  - `RequestTelemetry` rows present.
  - `AuditLog` rows present.
  - `JobTelemetry` rows present for queue states (`queued`, `running`, `completed`).
- Worker telemetry live smoke:
  - Started simulation/grading workers.
  - Triggered simulation + grading runs that reached `completed`.
  - Job telemetry rows recorded lifecycle events.

Delivery notes:
- Added Stage 9 models + migration:
  - `AuditLog`, `RequestTelemetry`, `JobTelemetry`
  - migration `0007_stage9_observability_hardening`
- Added API security/hardening:
  - global rate-limit guard
  - secure response headers via Fastify hook
  - stricter CORS origin config + body limit
  - param/query hardening utility used across controllers
- Added API observability:
  - request telemetry + audit capture on response hook
  - queue enqueue telemetry in API services
- Added worker observability:
  - simulation + grading workers now emit lifecycle job telemetry
- Added operational artifacts:
  - `docs/stage9-runbook.md`
  - `docs/incident-response.md`
  - `docs/authz-review-matrix.md`
  - `docs/beta-readiness.md`
  - `docs/load-test-results.json`

---

# README Authoring Task (2026-02-28)

## Scope
Create a root `README.md` that lets a new engineer set up and run the full system quickly.

## Plan
- [x] 1. Gather source-of-truth commands, scripts, and environment variables from the repository
- [x] 2. Draft `README.md` with overview, architecture, setup, run, and troubleshooting sections
- [x] 3. Verify command accuracy against package scripts and docker/prisma setup
- [x] 4. Mark task complete with a short review note

## Review
- Added root `README.md` with:
  - platform overview and architecture map
  - local dev setup/run sequence (docker, prisma, seed, api/web/workers)
  - env variable reference including AI provider switching via `.env`
  - build/start commands, shutdown steps, and quick troubleshooting
- Verified README commands against current `package.json` scripts, `apps/*/package.json`, `.env.example`, and Docker compose.

---

# Grafana Observability Enablement (2026-02-28)

## Scope
Add an online visualization path for Stage 9 telemetry using Grafana with automatic datasource/dashboard provisioning.

## Plan
- [x] 1. Update Docker Compose to include Grafana service
- [x] 2. Add Grafana datasource provisioning for local Postgres telemetry tables
- [x] 3. Add prebuilt observability dashboard (requests, latency, errors, jobs, audits)
- [x] 4. Add env vars for Grafana credentials to `.env.example` and `.env`
- [x] 5. Document step-by-step usage in project docs/README
- [x] 6. Verify provisioning paths and startup commands

## Review
- Added Grafana service on `http://localhost:3002` in Docker Compose with persisted storage and provisioning mounts.
- Added provisioning assets:
  - datasource: `infra/grafana/provisioning/datasources/postgres.yml`
  - dashboard provider: `infra/grafana/provisioning/dashboards/dashboards.yml`
  - dashboard JSON: `infra/grafana/dashboards/system-design-coach-observability.json`
- Added Grafana credentials to `.env` and `.env.example`.
- Added usage docs to:
  - `README.md` (new Observability Dashboard section)
  - `docs/observability-dashboard.md` (step-by-step setup/use guide)
- Verification completed:
  - `docker compose ... config` passed.
  - Grafana container started successfully (`sdc-grafana`).
  - Grafana API confirmed provisioned datasource `SDC Postgres`.
  - Grafana API confirmed provisioned dashboard `System Design Coach - Observability` (`uid: sdc-observability`).

---

# CORS Fix - Workspace Autosave and Traffic Save (2026-02-28)

## Scope
Fix CORS failures blocking `PATCH` requests for workspace autosave and traffic profile save.

## Plan
- [x] 1. Reproduce CORS preflight behavior for both failing endpoints
- [x] 2. Patch API CORS config to allow required methods/headers for authenticated PATCH requests
- [x] 3. Ensure common local origins are covered (`localhost` + `127.0.0.1`)
- [x] 4. Verify preflight responses for both endpoints and both origins
- [x] 5. Run API lint/typecheck

## Review
- Root cause found: CORS preflight allowed methods were only `GET,HEAD,POST`, so browser blocked `PATCH` calls.
- Updated API CORS config in `apps/api/src/main.ts`:
  - `methods`: `GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS`
  - `allowedHeaders`: `Authorization, Content-Type, Accept, Origin, X-Requested-With`
  - `exposedHeaders`: rate-limit headers
  - `maxAge`: `86400`
  - safer local defaults in origin parsing for `http://localhost:3000` and `http://127.0.0.1:3000`
- Updated env defaults:
  - `.env.example`: `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`
  - `.env`: `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`
- Verification:
  - `OPTIONS` preflight for both endpoints now returns `204` with `Access-Control-Allow-Methods` including `PATCH`
  - `Access-Control-Allow-Origin` confirmed for both `http://localhost:3000` and `http://127.0.0.1:3000`
  - `npm --workspace @sdc/api run typecheck` passed
  - `npm --workspace @sdc/api run lint` passed

---

# UI Redesign Rollout (2026-02-28)

## Scope
Apply the redesign guidance from `docs/ui-redesign-prompts.md` across all targeted pages and shared styling.

## Plan
- [x] 1. Audit prompt requirements + map impacted pages/components
- [x] 2. Upgrade global design system in `apps/web/app/globals.css` (themes, motion, cards, layout primitives)
- [x] 3. Redesign landing page (`/`) with sticky nav, animated hero, trust counters, stepper, footer, dark-mode toggle
- [x] 4. Redesign auth + dashboard + scenario picker pages
- [x] 5. Redesign workspace + traffic profile pages
- [x] 6. Redesign simulation + failure lab + grading pages
- [x] 7. Redesign compare page and align report/shared surfaces with updated visual system
- [x] 8. Run web lint/typecheck and fix regressions
- [x] 9. Update review notes with files changed and verification

## Review
- Completed full UI redesign rollout guided by `docs/ui-redesign-prompts.md`.
- Upgraded global design system in `apps/web/app/globals.css`:
  - theme tokens + dark mode variable overrides
  - glassmorphism cards, motion keyframes, animated backgrounds
  - page-specific UI primitives for landing, auth, dashboard, workspace, simulation, grading, failure lab, compare, traffic
- Redesigned route surfaces:
  - `apps/web/app/page.tsx` (sticky nav, animated hero, reveal sections, trust counters, dark mode toggle, timeline stepper, footer)
  - `apps/web/app/auth/page.tsx` (split layout, animated brand panel, pill tab switch, floating labels, loading spinner, shake errors)
  - `apps/web/app/dashboard/page.tsx` (welcome header, trend chart, animated stats, heatmap, quick actions, richer project cards, empty state)
  - `apps/web/app/scenarios/page.tsx` (sticky filter bar, search, difficulty/domain chips, hover previews, curated cards)
  - `apps/web/app/projects/[projectId]/versions/[versionId]/page.tsx` (tool-style workspace UI, zoom/undo/redo/minimap toolbar, animated palette/nodes/edges, warning toasts, slider-based scaling)
  - `apps/web/app/projects/[projectId]/versions/[versionId]/traffic/page.tsx` (preset cards, slider controls, live chart preview, sticky computed summary)
  - `apps/web/app/runs/[runId]/page.tsx` (real-time KPI dashboard, bottleneck bars, timeline, architecture overlay)
  - `apps/web/app/runs/[runId]/failure-injection/page.tsx` (war-room shell, failure mode cards, before/after deltas, blast-radius visualization)
  - `apps/web/app/grades/[gradeId]/page.tsx` (score ring hero, category bars, strengths/risks cards, prioritized action list with expandable details, fix-version CTA)
  - `apps/web/app/projects/[projectId]/compare/page.tsx` (side-by-side compare, delta arrows, transition animation, score progression sparkline)
  - aligned supporting pages for consistency:
    - `apps/web/app/onboarding/page.tsx`
    - `apps/web/app/projects/[projectId]/page.tsx`
    - `apps/web/app/projects/[projectId]/report/page.tsx`
    - `apps/web/app/shared/reports/[shareToken]/page.tsx`
- Verification:
  - `npm --workspace @sdc/web run lint` passed
  - `npm --workspace @sdc/web run typecheck` passed

---

# Stage 10 Roadmap Planning (2026-02-28)

## Scope
Define GA-focused implementation backlog after Stage 9 completion, including team workflows, quality gates, release automation, and operational controls.

## Plan
- [x] 1. Define Stage 10 epics and outcomes
- [x] 2. Break down Stage 10 into screen/API/platform tickets
- [x] 3. Add acceptance criteria and execution dependencies
- [x] 4. Prioritize ticket sequence into execution waves

## Stage 10 Epics
| Epic ID | Epic | Outcome |
|---|---|---|
| E10-1 | Collaboration and Access | Shared projects with role-scoped access and auditable collaboration events |
| E10-2 | Quality Gates and Reliability | Stable E2E coverage and reduced regression/flicker risk |
| E10-3 | Performance and Experience | Faster interaction and route responsiveness with budget enforcement |
| E10-4 | Release Automation and Safety | Repeatable deploy/rollback with automated smoke checks |
| E10-5 | Data Lifecycle and Compliance | Backup/restore confidence and retention governance |
| E10-6 | Product Analytics and GA Readiness | Measurable activation/completion loops and GA sign-off controls |

## Ticket Breakdown (Screen/API/Platform)
| Ticket | Surface | Scope | Acceptance Criteria | Depends On | Priority |
|---|---|---|---|---|---|
| FE-101 | Dashboard | Add shared projects panel with member role badges and pending invites | Shared projects list loads from API, role badges render, empty state CTA visible, loading/error states covered | BE-101 | P0 |
| FE-102 | Workspace | Add collaborator presence strip and edit-lock indicator for conflicting edits | Presence updates in near real-time, conflict lock appears/disappears without page reload, user sees clear recovery action | FE-101, BE-104 | P0 |
| FE-103 | Workspace | Add node-level comments and mention chips | Users can add/edit/delete comments, comments attach to node IDs, unresolved count appears in workspace sidebar | BE-103 | P0 |
| FE-104 | Grading Report | Add action-item assignment and status (`todo`, `in-progress`, `done`) | Action owner/status persists, filters by owner/status work, completion ratio appears in report summary | BE-105 | P1 |
| FE-105 | Compare/Report | Add regression summary banner when candidate is worse than baseline | Banner appears only on negative rubric/KPI deltas, includes direct navigation to affected sections | FE-104 | P1 |
| BE-101 | API | Membership model and endpoints (`POST /projects/:id/invites`, `PATCH /projects/:id/members/:memberId`, `DELETE /projects/:id/members/:memberId`) | Role checks enforced, invite lifecycle persisted, audit log entries created for each membership change | None | P0 |
| BE-102 | API | Shared project listing endpoint (`GET /projects/shared`) | Returns only projects where user has membership, includes role + last activity, paginated response contract documented | BE-101 | P0 |
| BE-103 | API | Comment endpoints (`GET/POST/PATCH/DELETE /projects/:id/versions/:id/comments`) | Comment CRUD works with authorization checks, comment history auditable, schema validated | BE-101 | P0 |
| BE-104 | API/Realtime | Presence and optimistic conflict resolution channel (WebSocket or polling contract) | Presence heartbeat documented, stale sessions expire, conflicting updates return deterministic error payloads | BE-101 | P0 |
| BE-105 | API | Grading action-item ownership/status endpoints | Item assignments are role-aware, status transitions validated, report payload includes ownership fields | BE-101 | P1 |
| QA-101 | CI/Testing | Add full E2E suite for top journeys (auth, scenario, workspace autosave, simulate, grade, compare, export/share) | CI gate fails on E2E regression, flaky rate threshold defined (<2%), retry policy documented | FE-101..105, BE-101..105 | P0 |
| QA-102 | Frontend Quality | Add visual regression checks for key pages (dashboard/workspace/results/report) | Snapshot baseline approved, diff failures block merge, update workflow documented | QA-101 | P1 |
| OPS-101 | Performance | Define and enforce route budgets (LCP, INP, CLS, API latency SLOs) | Budgets published, alerts configured, failing budget blocks release candidate | QA-101 | P0 |
| OPS-102 | Release | Build release pipeline with pre-deploy smoke + rollback script | One-command rollback validated in staging, smoke tests auto-run post deploy, deploy checklist linked in docs | OPS-101 | P0 |
| OPS-103 | Data Lifecycle | Implement retention jobs + backup/restore drill automation | Retention jobs run on schedule, restore drill passes with evidence artifacts, runbook updated | OPS-102 | P1 |
| OPS-104 | Product Analytics | GA readiness dashboard (activation, completion, regrade cadence, failure rate) | Dashboard available in Grafana/product analytics, weekly review template updated, go/no-go thresholds documented | OPS-101 | P1 |

## Execution Waves
1. Wave 10A (P0 Core): `BE-101`, `BE-102`, `BE-103`, `BE-104`, `FE-101`, `FE-102`, `FE-103`, `QA-101`.
2. Wave 10B (Quality + Perf): `FE-104`, `FE-105`, `BE-105`, `QA-102`, `OPS-101`.
3. Wave 10C (Release + GA Ops): `OPS-102`, `OPS-103`, `OPS-104`.

## Review
- Stage 10 roadmap and ticket backlog defined.
- Ticket dependencies and priorities are ready for sprint planning.

---

# Stage 10 Execution (2026-02-28)

## Scope
Deliver Stage 10 GA productization features end-to-end:
- collaboration model v1
- node comment workflow
- E2E/smoke quality gates
- frontend performance telemetry + budget surfacing
- release automation + rollback helper
- data lifecycle + analytics scripts
- public reliability status page
- icon-based theme toggle

## Plan
- [x] 1. Add Stage 10 collaboration data model and shared contracts
- [x] 2. Implement role-aware collaboration APIs (shared projects, members, invites, comments)
- [x] 3. Update existing access controls to support owner/editor/viewer project access
- [x] 4. Implement frontend collaboration surfaces (dashboard shared list, project member management, workspace comments/conflict lock)
- [x] 5. Add icon-based landing page theme toggle
- [x] 6. Add frontend performance monitor + telemetry ingestion endpoint
- [x] 7. Add Stage 10 operational scripts (E2E, smoke, retention, analytics, rollback)
- [x] 8. Add release automation workflow + GA operations doc + reliability page
- [x] 9. Run full workspace verification and update trackers

## Review
- Completed collaboration model:
  - Prisma models: `ProjectMember`, `ProjectInvite`, `VersionComment`
  - migration: `apps/api/prisma/migrations/0008_stage10_collaboration_workflows/migration.sql`
  - shared type contracts for collaboration + comments + frontend metrics
- Completed collaboration APIs:
  - `GET /projects/shared`
  - `GET /projects/:id/members`
  - `POST /projects/:id/invites`
  - `POST /projects/invites/:inviteToken/accept`
  - `PATCH/DELETE /projects/:id/members/:memberId`
  - `GET/POST/PATCH/DELETE /projects/:id/versions/:versionId/comments...`
- Completed role-scoped project access:
  - owner/editor/viewer access checks in `ProjectsService`
  - simulation/grading/report flows moved from owner-only checks to shared access checks
  - optimistic autosave conflict lock support via `lastKnownUpdatedAt`
- Completed frontend Stage 10 surfaces:
  - Dashboard shared projects panel with role badges
  - Project history member management + invite flow
  - Workspace collaborator strip + node comments + conflict lock UX
  - Landing page theme toggle now uses icon button (sun/moon SVG)
  - Public reliability page at `/status`
- Completed performance monitoring:
  - web `PerformanceMonitor` captures route transitions + Web Vitals (`TTFB/FCP/LCP/CLS/INP`)
  - API ingestion endpoint `POST /observability/frontend-metrics`
  - metrics persisted via request telemetry pipeline
- Completed GA operations assets:
  - E2E journey script: `infra/scripts/stage10-e2e.mjs`
  - smoke checks: `infra/scripts/stage10-smoke.mjs`
  - retention job: `infra/scripts/stage10-retention.mjs`
  - analytics summary: `infra/scripts/stage10-analytics-summary.mjs`
  - rollback helper: `infra/scripts/stage10-rollback.sh`
  - release workflow: `.github/workflows/release.yml`
  - docs: `docs/stage10-ga-operations.md`
  - root scripts added: `e2e:stage10`, `smoke:stage10`, `retention:stage10`, `analytics:stage10`

### Verification
- `npm --workspace @sdc/api run prisma:generate` passed
- `npm run lint` passed (all workspaces)
- `npm run typecheck` passed (all workspaces)
- `npm run test` passed (all workspaces)
- `node --check infra/scripts/stage10-e2e.mjs` passed
- `node --check infra/scripts/stage10-smoke.mjs` passed
- `node --check infra/scripts/stage10-retention.mjs` passed
- `node --check infra/scripts/stage10-analytics-summary.mjs` passed

---

# Prisma Tooling Mismatch Fix (2026-02-28)

## Scope
Resolve Prisma `datasource.url` false-positive errors caused by Prisma 7 tooling against a Prisma 6 codebase.

## Plan
- [x] 1. Confirm effective Prisma version used by workspace commands
- [x] 2. Add explicit Prisma workspace scripts to avoid ambiguous `npx` paths
- [x] 3. Update setup and runbook docs to use workspace scripts
- [x] 4. Add troubleshooting guidance for Prisma 7 vs Prisma 6 mismatch
- [x] 5. Verify `prisma:validate`, `prisma:generate`, and `prisma:db:push` commands

## Review
- Root cause: the project runs Prisma `6.19.2`; the reported error text comes from Prisma 7 schema rules.
- Updated API Prisma scripts in `apps/api/package.json` to execute from repo root (stable `.env` loading):
  - `prisma:validate`
  - `prisma:generate`
  - `prisma:db:push`
  - `prisma:migrate`
  - `prisma:seed`
- Updated docs to use workspace scripts instead of direct `npx prisma ...`:
  - `README.md`
  - `docs/stage9-runbook.md`
- Added a troubleshooting entry in `README.md` for the specific error and VS Code version switching path.
- Verification completed with local workspace Prisma commands:
  - `npm --workspace @sdc/api run prisma:validate`
  - `npm --workspace @sdc/api run prisma:generate`
  - `npm --workspace @sdc/api run prisma:db:push -- --accept-data-loss`

---

# Security Audit Remediation (2026-02-28)

## Scope
Remediate all identified security findings across auth/session handling, API abuse controls, rate limiting, header safety, credential defaults, and deployment hygiene.

## Plan
- [x] 1. Implement server-set secure auth cookies and remove client-set sensitive token cookies
- [x] 2. Remove JWT secret fallback and enforce required `JWT_SECRET`
- [x] 3. Add token revocation mechanism and logout endpoint
- [x] 4. Strengthen password policy and enforce account lockout on repeated login failures
- [x] 5. Protect frontend observability ingestion endpoint with authentication
- [x] 6. Sanitize report download filenames before setting `Content-Disposition`
- [x] 7. Upgrade rate limiting to Redis-backed storage with safe fallback
- [x] 8. Harden Grafana/default secret configuration and prevent accidental `.env` tracking
- [x] 9. Run schema/code verification (`prisma`, lint, typecheck, tests) and document outcomes

## Review
- Authentication cookie hardening:
  - Added API-side auth cookie management with `HttpOnly`, `SameSite=Lax`, and production-secure behavior.
  - Auth cookies are now set in `POST /auth/signup` and `POST /auth/login`.
  - Added `POST /auth/logout` to revoke current token (when valid) and always clear auth cookie.
  - Frontend no longer writes sensitive JWT cookies from `document.cookie`; token is kept in session storage for existing Bearer flows.
- JWT secret hardening:
  - Removed all `JWT_SECRET` fallback values.
  - Added startup fail-fast in API bootstrap when `JWT_SECRET` is missing.
- Revocation and lockout:
  - Added `tokenVersion`, `failedLoginAttempts`, `lockoutUntil` fields to `User`.
  - JWT includes `tv` claim; `JwtAuthGuard` validates it against DB for token revocation.
  - Login now enforces account lockout after repeated failures and resets counters on success.
- Observability endpoint protection:
  - Added `JwtAuthGuard` to `POST /observability/frontend-metrics`.
  - Updated frontend performance monitor to only send metrics when authenticated.
- Header injection mitigation:
  - Added filename sanitization helper and applied it to both PDF download endpoints before setting `Content-Disposition`.
- Rate limiting hardening:
  - Reworked `RateLimitGuard` to use Redis-backed counters for multi-instance consistency.
  - Retains in-memory fallback if Redis is unavailable.
- Secret/config hygiene:
  - Hardened Grafana defaults in `.env.example` and Docker Compose fallback values.
  - Added CI and release workflow guard that fails if `.env` is tracked.
  - Verified `.env` is not currently tracked and has no git history.

### Verification
- `npm --workspace @sdc/api run prisma:generate` passed.
- `npm --workspace @sdc/api run prisma:db:push -- --accept-data-loss` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed.

---

# CI Prisma Generation Gate Fix (2026-02-28)

## Scope
Fix CI typecheck/build failures caused by missing generated Prisma client types after clean dependency install.

## Plan
- [x] 1. Reproduce CI failure locally from clean install
- [x] 2. Confirm `prisma generate` resolves missing Prisma namespace/model exports
- [x] 3. Patch CI workflows to generate Prisma client before lint/typecheck/build
- [x] 4. Re-verify local typecheck flow with/without generate

## Review
- Reproduced CI failure after clean `npm ci` with matching errors:
  - missing `Prisma.ProjectGetPayload`, `Prisma.ProjectMemberGetPayload`, `Prisma.InputJsonValue`, `Prisma.JsonValue`
  - missing `User` export from `@prisma/client`
- Confirmed root cause:
  - Prisma client is not generated in CI before `npm run typecheck`.
  - Running `npm --workspace @sdc/api run prisma:generate` restores generated types and fixes workspace typecheck.
- Updated workflows:
  - `.github/workflows/ci.yml`: added `Generate Prisma Client` step after install.
  - `.github/workflows/release.yml`: added `Generate Prisma Client` step after install.
- Verification:
  - `npm run typecheck` fails immediately after clean `npm ci` (before generate).
  - `npm --workspace @sdc/api run prisma:generate && npm run typecheck` passes.

---

# Security Hardening Follow-Up (2026-02-28)

## Scope
Remediate additional security gaps discovered after the first audit pass, focused on cookie-auth safety, CSRF controls, origin hardening, session token exposure, and auth-path resiliency.

## Plan
- [x] 1. Migrate web/API auth flow to cookie-centric usage without exposing JWT in browser storage or payloads
- [x] 2. Add CSRF origin validation for cookie-authenticated state-changing API requests
- [x] 3. Enforce stricter production behavior for secure cookie handling and allowed CORS origin defaults
- [x] 4. Tighten auth rate-limit behavior when Redis is unavailable (production fail-closed option)
- [x] 5. Strengthen middleware auth checks to validate JWT signature/claims, not just cookie presence
- [x] 6. Update docs/env references and run full verification

## Review
- Cookie/session hardening:
  - API auth endpoints now return user profile only and set cookie server-side; no token in response body.
  - Frontend auth helper no longer stores JWT value client-side.
  - Added centralized `apiFetch` helper that defaults to `credentials: include` and strips `Authorization` headers.
- CSRF and origin protections:
  - `JwtAuthGuard` now distinguishes cookie vs bearer auth source.
  - For cookie-authenticated `POST/PUT/PATCH/DELETE`, guard validates `Origin` against configured allowed origins.
- Production configuration hardening:
  - Auth cookies are always `Secure` in production regardless of env override.
  - CORS parsing no longer injects localhost defaults in production when env is absent.
- Auth-rate-limit resiliency:
  - Added `AUTH_RATE_LIMIT_REQUIRE_REDIS` control.
  - In production (default), auth endpoints fail with `503` if Redis-backed limiting is unavailable instead of falling back to per-process in-memory.
- Frontend middleware hardening:
  - Middleware now verifies HS256 JWT signature and required claims (`sub`, `tv`, `exp`) using `JWT_SECRET` instead of trusting cookie presence.
- Docs/config updates:
  - Added `AUTH_RATE_LIMIT_REQUIRE_REDIS` to `.env.example` and README.
  - Documented requirement that `JWT_SECRET` must be present for both API and web middleware.

### Verification
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed.
- `git log --all -- .env` returned no commits for `.env` (no tracked history).
- Confirmed observability ingestion endpoint remains guard-protected (`@UseGuards(JwtAuthGuard)`).
