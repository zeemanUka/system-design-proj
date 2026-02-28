# System Design Coach - Engineering Onboarding Document

## 1. Document Purpose
This document is the source of truth for engineers joining the project. It covers:
- Product vision and MVP scope
- Screen-by-screen UX behavior
- Backend architecture and APIs
- Data model and simulation/grading logic
- Proposed monorepo structure
- Engineering backlog with acceptance criteria
- Team workflow rules aligned with `Agents.md`

## 2. Product Vision
Build an interactive system design training app where users can:
1. Design distributed systems on a canvas.
2. Scale components horizontally and vertically.
3. Simulate load and failures.
4. See what breaks, why it breaks, and how to fix it.
5. Get AI grading with actionable feedback.
6. Iterate through design -> stress -> break -> fix -> regrade.

## 3. MVP Goals and Non-Goals
### Goals
1. Teach interview-quality system design through simulation and iteration.
2. Make scaling tradeoffs explicit and measurable.
3. Provide rubric-based grading plus explainable AI feedback.
4. Track improvement across attempts.

### Non-Goals
1. Full cloud-vendor-accurate infra simulation.
2. One-click deployment to real cloud infrastructure.
3. Real-time collaborative editing by multiple users.
4. Mobile-first editor optimization in v1.

## 4. Tech Stack and Primary Language
### Language
- Primary language: TypeScript (frontend, backend API, workers).

### Why TypeScript
1. Shared types across UI/API/worker boundaries.
2. Faster MVP shipping with fewer integration bugs.
3. Better refactor safety as simulation and rubric rules evolve.
4. Consistent hiring and onboarding profile across teams.

### Frameworks and Infra
1. Frontend: Next.js + React + TypeScript.
2. API service: NestJS + Fastify adapter + TypeScript.
3. Simulation worker: Node.js TypeScript worker.
4. Grading worker: TypeScript + LLM SDK.
5. DB: PostgreSQL.
6. Queue and cache: Redis + BullMQ.
7. Realtime updates: WebSocket or SSE.
8. Optional later: Python service for advanced simulation models.

### Backend Framework Decision
1. Use NestJS for application architecture: modules, DI, guards, pipes, DTO validation, and testing structure.
2. Use Fastify as Nest's HTTP runtime via `@nestjs/platform-fastify`.
3. Reason this is preferred over Express in this project:
- better throughput and lower latency under load
- lower memory overhead for concurrent run/grade requests
- keep Nest conventions for team consistency and onboarding speed
4. Constraint:
- avoid Express-only middleware and packages in the API app

## 5. End-to-End User Flow
1. User picks a scenario.
2. User builds architecture on canvas.
3. User configures traffic profile.
4. User scales components horizontally or vertically.
5. User runs simulation and inspects bottlenecks and failure timeline.
6. User gets AI grading and prioritized improvements.
7. User applies fixes in a new version.
8. User reruns simulation and regrades.
9. User compares versions and exports report.

## 6. Screen-by-Screen UX Spec
| Route | Screen | Core Purpose | Key Actions | Key Output |
|---|---|---|---|---|
| `/` | Landing | Explain product and drive entry | Start Practice, View Demo Scenario, Sign In | Route to auth or scenario picker |
| `/auth` | Sign In / Sign Up | Account access | Email login, OAuth, reset password | Session established |
| `/onboarding` | Onboarding | Capture profile and goals | Continue, Skip | User preferences saved |
| `/dashboard` | Dashboard | Project home and progress | New Attempt, Resume, Compare | Recent attempts + score trend |
| `/scenarios` | Scenario Picker | Prompt selection | Filter, Start Scenario | New project + initial version |
| `/projects/:projectId/versions/:versionId` | Design Workspace | Build and configure architecture | Drag/drop nodes, connect edges, scale H/V, save | Versioned design state |
| `/projects/:id/versions/:id/traffic` | Traffic Profile | Define load assumptions | Apply preset/custom profile | Traffic model saved |
| `/runs/:runId` | Simulation Results | Show performance and breakpoints | Re-run, create fix version, inject failure | KPIs, bottlenecks, failure timeline |
| `/runs/:runId/failure-injection` | Failure Lab | Evaluate resilience | Inject failure mode, compare baseline | Blast radius + degraded metrics |
| `/grades/:gradeId` | AI Grading Report | Interview-style feedback | Explain feedback, generate improved version, regrade | Score breakdown + prioritized fixes |
| `/projects/:id/compare` | Attempt Compare | Diff versions and outcomes | Select versions, compare | Diagram + KPI + rubric delta |
| `/projects/:id/report` | Review and Export | Summarize progress and share | Export PDF, share read-only link | Final report artifact |
| `/status` | Reliability Status | Customer-facing service health page | View checks, use incident update template | Live service status communication |

## 7. Backend Architecture Proposal
### Services
1. API Service
- Owns auth, projects, versions, scenarios, history, compare, report metadata.
- Enforces authN/authZ and schema validation.
- Publishes simulation/grading jobs to queue.

2. Simulation Worker
- Consumes simulation jobs.
- Executes capacity, latency, throughput, and bottleneck analysis.
- Emits timeline events and run artifacts.

3. Grading Worker
- Runs deterministic rubric checks.
- Uses LLM to explain findings and prioritize fixes.
- Stores scorecard plus evidence-linked feedback.

### Execution Flow
1. `POST /versions/:id/simulate` creates pending run and queue job.
2. Worker processes job and writes results.
3. Client receives progress via SSE/WebSocket.
4. `POST /versions/:id/grade` creates grade job.
5. Rule engine scores design, then LLM adds explanations.
6. Client fetches final report from `GET /grades/:id`.

## 8. Simulation and Failure Model (MVP)
1. Every component has capacity inputs: CPU ops/s, memory, network, storage IOPS.
2. Request path computes throughput ceiling and latency approximation.
3. Horizontal scaling increases capacity by replicas times efficiency factor.
4. Vertical scaling increases per-node capacity with diminishing returns.
5. Failure profiles degrade or remove component capacity.
6. Result includes:
- throughput
- p50 and p95 latency
- error rate
- saturation by component
- ordered failure timeline

## 9. AI Grading Model and Rubric
### Rubric Weights
| Category | Weight |
|---|---|
| Requirements Clarification | 10% |
| High-Level Architecture | 20% |
| Data Model and Access Patterns | 15% |
| Scalability Decisions | 20% |
| Reliability and Fault Tolerance | 15% |
| Bottleneck Identification | 10% |
| Tradeoff Reasoning | 10% |

### Grading Pipeline
1. Extract structured design JSON from version graph.
2. Run deterministic checks:
- SPOF detection
- failover and replication coverage
- queue and cache risk checks
- partition hotspot and write bottleneck checks
3. Score rubric categories with evidence.
4. Generate LLM explanation constrained to evidence.
5. Return strengths, risks, and P0/P1/P2 action list.

## 10. API Surface (MVP)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/projects` | Create a project from scenario |
| `POST` | `/projects/:id/versions` | Create new architecture version |
| `GET` | `/projects/:id/history` | Get version and attempt history |
| `POST` | `/versions/:id/simulate` | Queue a simulation run |
| `GET` | `/runs/:id` | Get simulation status and results |
| `POST` | `/runs/:id/failure-injection` | Run failure scenario and compare |
| `POST` | `/versions/:id/grade` | Queue grading workflow |
| `GET` | `/grades/:id` | Get grading report |
| `GET` | `/scenarios` | List available scenarios |
| `POST` | `/auth/signup` | Register user |
| `POST` | `/auth/login` | Authenticate user |
| `GET` | `/projects/:id/compare` | Compare two versions |
| `GET` | `/projects/shared` | List projects shared with current user |
| `GET` | `/projects/:id/members` | Get owner, members, and pending invites |
| `POST` | `/projects/:id/invites` | Create/refresh member invite |
| `POST` | `/projects/invites/:inviteToken/accept` | Accept invite for current user |
| `PATCH` | `/projects/:id/members/:memberId` | Update member role |
| `DELETE` | `/projects/:id/members/:memberId` | Remove project member |
| `GET` | `/projects/:id/versions/:versionId/comments` | List workspace node comments |
| `POST` | `/projects/:id/versions/:versionId/comments` | Add node comment |
| `PATCH` | `/projects/:id/versions/:versionId/comments/:commentId` | Edit comment body/status |
| `DELETE` | `/projects/:id/versions/:versionId/comments/:commentId` | Delete comment |
| `POST` | `/observability/frontend-metrics` | Ingest frontend performance metrics |

## 11. Data Model (Core Entities)
1. `users`
2. `scenarios`
3. `projects`
4. `architecture_versions`
5. `components`
6. `edges`
7. `traffic_profiles`
8. `simulation_runs`
9. `run_events`
10. `grade_reports`
11. `feedback_items`
12. `report_exports`
13. `project_members`
14. `project_invites`
15. `version_comments`
16. `request_telemetry` (includes frontend metric events)

## 12. Proposed Monorepo Structure
```text
system-design-app/
  apps/
    web/                      # Next.js frontend
    api/                      # NestJS API running on Fastify adapter
    simulation-worker/        # BullMQ worker for simulation
    grading-worker/           # BullMQ worker for rubric + AI feedback
  packages/
    shared-types/             # zod/typescript contracts shared across apps
    domain-models/            # core domain rules and entities
    simulation-core/          # reusable simulation computation logic
    grading-core/             # deterministic rubric rules
    ui-kit/                   # reusable frontend components
    config/                   # eslint, tsconfig, prettier presets
  infra/
    docker/                   # local docker compose and images
    migrations/               # DB migrations
    scripts/                  # setup, seed, ci helpers
  tasks/
    todo .md                  # planning and checklists (as defined by Agents.md)
    lessons .md               # correction patterns and prevention rules
  docs/
    architecture.md
    api-contracts.md
  Agents.md
  Onboarding document.md
```

## 13. Coding and Project Conventions
1. Keep changes minimal and targeted.
2. Favor simple solutions before advanced abstractions.
3. No temporary fixes without root-cause path.
4. Use shared contracts for FE/BE payloads.
5. Require tests for all non-trivial behavior changes.
6. Use feature flags for risky or incomplete features.

## 14. Workflow Rules (Aligned with Agents.md)
1. For non-trivial tasks, write a plan first in `tasks/todo .md`.
2. Verify plan before implementation.
3. Track progress by checking off items.
4. Add a review section in `tasks/todo .md` when complete.
5. After user corrections, update `tasks/lessons .md` with prevention rules.
6. Stop and re-plan if execution diverges or fails unexpectedly.
7. Validate behavior before declaring done:
- run tests
- check logs
- confirm acceptance criteria

## 15. Engineering Backlog
### Epics
| Epic ID | Epic | Outcome |
|---|---|---|
| E0 | Platform Foundation | Monorepo, CI, lint/test, auth and data foundations |
| E1 | Identity and Onboarding | Signup/login and profile setup flow |
| E2 | Scenario and Project Lifecycle | Start scenario and versioned project creation |
| E3 | Interactive Design Workspace | Canvas editing, scaling controls, autosave |
| E4 | Simulation Engine and Results | Run jobs and render KPIs, bottlenecks, timeline |
| E5 | Failure Injection Lab | Apply failures and compare blast radius |
| E6 | AI Grading and Coaching | Rubric scoring and evidence-based feedback |
| E7 | Compare and Reporting | Version diff and exportable summary |
| E8 | Reliability and Security | Observability, hardening, and auditability |
| E9 | GA Productization and Team Workflows | Collaboration, quality gates, release automation, and reliability page |

### Ticket Breakdown (Screen and API)
| Ticket | Scope | Acceptance Criteria |
|---|---|---|
| FE-001 | Landing page | CTA routing works and demo opens read-only sample |
| FE-002 | Auth screen | Email/OAuth auth works with clear error states |
| FE-003 | Onboarding | Profile fields persist and completion state routes correctly |
| FE-004 | Dashboard | Shows recent projects, scores, and empty-state CTA |
| FE-005 | Scenario picker | Filters work and start action creates project/version |
| FE-006 | Design workspace | Node editing, scaling H/V, validation warnings, autosave |
| FE-007 | Traffic profile | Presets and custom profile persist to version |
| FE-008 | Simulation results | KPIs, sorted bottlenecks, timeline, job states |
| FE-009 | Failure lab | Failure profiles produce before/after deltas |
| FE-010 | Grading report | Weighted score + evidence-linked deductions + P0/P1/P2 |
| FE-011 | Compare screen | Side-by-side version and KPI/rubric deltas |
| FE-012 | Report export | PDF export and revocable read-only share link |
| FE-013 | Shared projects panel | Shows role-scoped shared projects and owner metadata |
| FE-014 | Workspace comments | Node-level comment CRUD with open/resolved states |
| FE-015 | Collaboration management | Invite members and manage editor/viewer roles |
| FE-016 | Reliability page | Public status checks + incident communication template |
| BE-001 | `POST /projects` | Creates user-owned project from scenario |
| BE-002 | `POST /projects/:id/versions` | Snapshots version with lineage |
| BE-003 | `GET /projects/:id/history` | Paginated history with run/grade summaries |
| BE-004 | `POST /versions/:id/simulate` | Schema validate and queue run job |
| BE-005 | `GET /runs/:id` | Return run status and final metrics payload |
| BE-006 | `POST /runs/:id/failure-injection` | Apply approved failure profiles and persist diff |
| BE-007 | `POST /versions/:id/grade` | Queue grade job with precondition checks |
| BE-008 | `GET /grades/:id` | Return final report with evidence mapping |
| BE-009 | `POST /auth/signup` | Register with secure password hashing |
| BE-010 | `POST /auth/login` | Login with rate limiting |
| BE-011 | `GET /scenarios` | Filtered scenario list optimized for UI |
| BE-012 | `GET /projects/:id/compare` | Version diff contract for compare page |
| BE-013 | Collaboration model | Membership + invite lifecycle with role checks |
| BE-014 | Comment APIs | Version comment CRUD with access control |
| BE-015 | Frontend telemetry ingest | Capture Web Vitals/route metrics from browser |
| SIM-001 | Simulation core | Deterministic throughput/latency/bottleneck outputs |
| SIM-002 | Failure evaluator | Degraded-state modeling and blast-radius output |
| GRADE-001 | Rubric rules | Deterministic scoring with traceable evidence |
| GRADE-002 | AI feedback | Evidence-grounded explanation and action plan |
| OPS-001 | Stage 10 E2E gate | Critical user journey script for auth->report share path |
| OPS-002 | Release + rollback automation | Smoke check + rollback helper + release workflow |
| OPS-003 | Data lifecycle + analytics | Retention cleanup and weekly GA metrics summary |

## 16. Milestones and Delivery Plan
1. Week 1-2: E0, E1, E2.
2. Week 3-4: E3.
3. Week 5: E4.
4. Week 6: E5.
5. Week 7: E6.
6. Week 8: E7, E8, beta hardening.
7. Week 9: E9 GA productization and operational readiness.

## 17. Definition of Done
1. Acceptance criteria met and manually verified.
2. Unit and integration tests pass in CI.
3. API contract updated and consumed by typed clients.
4. Auth, validation, and authorization checks are covered.
5. Logs and metrics added for new critical paths.
6. Documentation updated when behavior or contracts change.

## 18. New Engineer Quick Start
1. Read `Agents.md` and this onboarding doc.
2. Set up local dependencies: Node.js LTS, PostgreSQL, Redis.
3. Install project dependencies and run lint/test suites.
4. Review `tasks/todo .md` for current sprint priorities.
5. Pick ticket with clear acceptance criteria and add implementation plan.
6. Build, test, and document outcomes before handoff.
