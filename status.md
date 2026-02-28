# System Design Coach - Delivery Status Tracker

## How to Use
1. Work stages in numeric order unless an explicit dependency is removed.
2. Mark stage checkbox when all exit criteria are met.
3. Update `Status`, `Start Date`, `End Date`, and `Notes` as work progresses.
4. Keep this file aligned with `Onboarding document.md`.

## Status Legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Done`

## Stage Order (Single Source of Execution)
| Stage | Name | Depends On | Status | Start Date | End Date | Owner | Notes |
|---|---|---|---|---|---|---|---|
| 0 | Foundation and Repo Setup | None | Done | 2026-02-27 | 2026-02-27 | Engineering | Monorepo/tooling/CI/Docker/prisma scaffolding completed; lint/typecheck/test passing; web/api/workers boot verified. |
| 1 | Identity and Onboarding | Stage 0 | Done | 2026-02-27 | 2026-02-27 | Engineering | Signup/login, onboarding persistence, auth guard protection, frontend auth/onboarding/dashboard flows implemented and verified. |
| 2 | Scenario and Project Lifecycle | Stage 1 | Done | 2026-02-27 | 2026-02-27 | Engineering | Scenario catalog seeded and filterable; project + version APIs live; dashboard and project history UI integrated. |
| 3 | Design Workspace and Canvas | Stage 2 | Done | 2026-02-27 | 2026-02-27 | Engineering | Workspace route added with component palette, edge builder, scaling/config controls, validation warnings, and debounced autosave via version patch API. |
| 4 | Traffic Profile and Capacity Inputs | Stage 3 | Done | 2026-02-27 | 2026-02-27 | Engineering | Added strict traffic profile schema and presets, per-version traffic GET/PATCH APIs, workspace traffic summary link, dedicated traffic profile screen with validation, plus a full frontend UX refresh with landing page and interactive draggable workspace canvas. |
| 5 | Simulation Engine and Results UI | Stage 4 | Done | 2026-02-27 | 2026-02-27 | Engineering | Implemented simulation run persistence, queue flow (`POST /versions/:id/simulate` + `GET /runs/:id`), deterministic worker output (throughput/latency/error/bottlenecks/timeline), and `/runs/:runId` UI with pending/running/completed/failed states. |
| 6 | Failure Injection Lab | Stage 5 | Done | 2026-02-27 | 2026-02-27 | Engineering | Implemented `POST /runs/:id/failure-injection`, worker-side failure mode application (node down, AZ down, lag, surge), persisted blast-radius artifacts, and `/runs/:runId/failure-injection` before/after comparison UI. |
| 7 | AI Grading and Feedback | Stage 5 | Done | 2026-02-27 | 2026-02-27 | Engineering | Implemented grading queue flow (`POST /versions/:id/grade` + `GET /grades/:id`), deterministic rubric scoring with evidence traces, configurable AI feedback providers via `.env`, and `/grades/:id` report UI with prioritized P0/P1/P2 actions. |
| 8 | Version Compare and Reporting | Stage 7 | Done | 2026-02-27 | 2026-02-27 | Engineering | Implemented compare API/UI, KPI+rubric deltas, final report generation, PDF export path, and revocable read-only share links; lint/typecheck/test + live smoke passed. |
| 9 | Hardening, Security, Observability, Beta | Stage 8 | Done | 2026-02-27 | 2026-02-27 | Engineering | Added audit/request/job telemetry, global rate limiting + secure headers + input hardening, load-test tooling/results, and beta runbook/IR/authZ docs with go decision. |
| 10 | GA Productization and Team Workflows | Stage 9 | Done | 2026-02-28 | 2026-02-28 | Engineering | Implemented collaboration model, shared-project/team workflows, node comments, Stage 10 E2E/smoke scripts, frontend performance telemetry ingestion, GA ops scripts, and public reliability page. |

## Detailed Stage Checklist

### [x] Stage 0 - Foundation and Repo Setup
Goal: establish monorepo and delivery baseline.
- [x] Create monorepo layout (`apps`, `packages`, `infra`, `tasks`, `docs`).
- [x] Configure TypeScript workspace, linting, formatting, test runner.
- [x] Set up CI for lint, typecheck, and tests.
- [x] Provision local PostgreSQL + Redis via Docker.
- [x] Create base migrations and seed scaffolding.
Exit criteria:
- [x] `web`, `api`, and worker apps boot locally.
- [x] CI runs and passes on a clean branch.

### [x] Stage 1 - Identity and Onboarding
Goal: users can create accounts and complete profile setup.
- [x] Implement auth APIs (`signup`, `login`) with secure password hashing.
- [x] Add frontend auth screens and error states.
- [x] Implement onboarding form and persistence.
- [x] Add auth guards and route protection.
Exit criteria:
- [x] New and returning user flows are fully functional.
- [x] Unauthorized access is blocked across protected routes.

### [x] Stage 2 - Scenario and Project Lifecycle
Goal: users can start practice scenarios and create versioned projects.
- [x] Implement scenarios API and seed initial scenario library.
- [x] Build scenario picker with filters.
- [x] Implement project creation and version creation APIs.
- [x] Implement dashboard recent-project and history summary data.
Exit criteria:
- [x] Starting a scenario creates `project` + initial `version`.
- [x] Dashboard shows retrievable project history.

### [x] Stage 3 - Design Workspace and Canvas
Goal: interactive architecture modeling with versioned saves.
- [x] Build canvas with component palette and edge connections.
- [x] Add component configuration panel (capacity + behavior fields).
- [x] Add horizontal/vertical scaling controls.
- [x] Add topology validation (SPOF, disconnected path, invalid links).
- [x] Add autosave for meaningful edits.
Exit criteria:
- [x] User can build and save a valid architecture graph.
- [x] Validation warnings appear accurately.

### [x] Stage 4 - Traffic Profile and Capacity Inputs
Goal: load assumptions are configurable and versioned.
- [x] Build traffic profile screen and presets.
- [x] Persist traffic profile per architecture version.
- [x] Validate profile ranges and required fields.
Exit criteria:
- [x] Simulation input contract includes architecture + traffic profile.

### [x] Stage 5 - Simulation Engine and Results UI
Goal: run simulations and visualize what breaks first.
- [x] Implement simulation queue flow (`POST /versions/:id/simulate`).
- [x] Build simulation worker throughput/latency/error calculations.
- [x] Return bottlenecks and failure timeline artifacts.
- [x] Build results screen (`/runs/:runId`) with KPI cards and event list.
- [x] Add pending/running/completed/failed UI states.
Exit criteria:
- [x] End-to-end run completes and results render from real worker output.

### [x] Stage 6 - Failure Injection Lab
Goal: resilience testing via controlled failure scenarios.
- [x] Implement failure-injection API and worker path.
- [x] Support baseline failure modes (node down, AZ down, lag, surge).
- [x] Build before/after delta view and blast-radius summary.
Exit criteria:
- [x] User can inject a failure and compare impact to baseline run.

### [x] Stage 7 - AI Grading and Feedback
Goal: deterministic scoring + explainable AI coaching.
- [x] Build rubric rule engine with evidence traces.
- [x] Implement grade queue flow (`POST /versions/:id/grade`).
- [x] Integrate LLM feedback generation constrained by rule evidence.
- [x] Build grading report UI with category scores and P0/P1/P2 actions.
Exit criteria:
- [x] Grade report is reproducible and evidence-linked.
- [x] Regrade after updates shows measurable deltas.

### [x] Stage 8 - Version Compare and Reporting
Goal: progression insights and final shareable outputs.
- [x] Build version compare API and UI side-by-side diff.
- [x] Add KPI and rubric delta visualizations.
- [x] Build final report screen and PDF export path.
- [x] Implement read-only share links for reports.
Exit criteria:
- [x] User can compare attempts and export a final report.

### [x] Stage 9 - Hardening, Security, Observability, Beta
Goal: production readiness for controlled beta launch.
- [x] Add audit logs and request/job telemetry.
- [x] Add rate limiting, secure headers, input hardening, and authZ reviews.
- [x] Load test critical endpoints and queue throughput.
- [x] Finalize runbooks and incident response basics.
- [x] Execute beta checklist and acceptance sign-off.
Exit criteria:
- [x] Reliability/security checklist completed.
- [x] Beta launch go/no-go decision documented.

### [x] Stage 10 - GA Productization and Team Workflows
Goal: move from beta-complete platform to reliable GA-ready product operations and multi-user workflows.
- [x] Add collaboration model v1 (project member roles, invite flow, shared edit permissions).
- [x] Add comment/annotation workflow on architecture nodes and report action items.
- [x] Add end-to-end test suite for critical journeys (auth, scenario start, workspace autosave, simulate, grade, compare, report export/share).
- [x] Add frontend performance budgets and monitoring (route-level Web Vitals, interaction timing, slow-query surfacing).
- [x] Add release automation (versioned deploy pipeline, smoke tests, rollback script, environment drift check).
- [x] Add data lifecycle controls (retention policy jobs, audit export for admin, backup/restore validation drill).
- [x] Add beta analytics loop (activation, completion, regrade cadence, failed-run diagnostics dashboard).
- [x] Add customer-facing reliability page (system status + incident communication template).
Exit criteria:
- [x] Team workflows support shared projects with role-scoped permissions and auditable access events.
- [x] E2E suite is green in CI with a stable reliability threshold and no flaky blockers.
- [x] GA release checklist is documented, rehearsed, and approved with rollback confidence.

## Active Risks and Blockers
| ID | Type | Description | Owner | Mitigation | Status |
|---|---|---|---|---|---|
| R-001 | Risk |  |  |  | Open |
| R-002 | Blocker |  |  |  | Open |

## Weekly Review Log
| Date | Summary | Decisions | Next Actions |
|---|---|---|---|
| 2026-02-27 | Completed Stage 5 simulation queue, worker computations, and results UI with live smoke validation. | Proceed to Stage 6 failure injection lab next. | Define failure profile schema and injection API/worker flow. |
| 2026-02-27 | Completed Stage 6 failure injection API, worker path, and comparison UI with live smoke validation. | Move forward to Stage 7 AI grading and feedback. | Define rubric execution pipeline and grading job contract. |
| 2026-02-27 | Completed Stage 7 deterministic grading + configurable AI feedback + report UI with live smoke validation. | Proceed to Stage 8 compare and reporting. | Implement side-by-side version/score diff and report export path. |
| 2026-02-27 | Completed Stage 8 compare/report APIs + UI + PDF/share workflows with live smoke validation (including revoke behavior). | Proceed to Stage 9 hardening/security/observability. | Implement telemetry, rate limiting, security headers, and beta readiness checklist. |
| 2026-02-27 | Completed Stage 9 hardening and beta-readiness work (telemetry, rate limiting, secure headers, load test, runbooks, authZ review, go/no-go). | Delivery stages 0-9 complete for current milestone. | Track beta operational metrics and tune rate limits from first traffic window. |
| 2026-02-28 | Planned Stage 10 roadmap for GA productization. | Stage 10 will start with E2E quality gates and collaboration model design. | Break Stage 10 into sprint tickets and begin FE/BE/API implementation slices. |
| 2026-02-28 | Completed Stage 10 GA productization implementation (collaboration, comments, telemetry budgets, release/data/analytics scripts, status page). | Stage 10 milestone marked complete with full lint/typecheck/test validation and script tooling in place. | Start post-GA optimization sprint for richer realtime collaboration and alert tuning. |
| 2026-02-28 | Completed follow-up security hardening pass (cookie-auth flow cleanup, CSRF origin checks, secure-cookie/CORS production tightening, auth rate-limit Redis requirement option, middleware JWT verification). | Keep cookie-based auth as default path and enforce stronger production safeguards. | Add integration tests for CSRF/origin rejection and middleware auth redirect behavior. |
