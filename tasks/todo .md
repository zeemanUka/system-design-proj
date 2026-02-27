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
