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
