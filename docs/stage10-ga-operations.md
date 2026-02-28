# Stage 10 GA Operations Guide

This document captures the GA operational workflows added in Stage 10.

## 1) Collaboration and Team Workflows
- API endpoints:
  - `GET /projects/shared`
  - `GET /projects/:id/members`
  - `POST /projects/:id/invites`
  - `POST /projects/invites/:inviteToken/accept`
  - `PATCH /projects/:id/members/:memberId`
  - `DELETE /projects/:id/members/:memberId`
  - `GET/POST/PATCH/DELETE /projects/:id/versions/:versionId/comments...`
- UI surfaces:
  - Dashboard shared-project panel
  - Project history collaboration section (members + invite flow)
  - Workspace node comments + collaborator strip + conflict lock indicator

## 2) E2E Reliability Gate
Run the Stage 10 critical journey script against a running stack:

```bash
node infra/scripts/stage10-e2e.mjs
```

Optional env:
- `STAGE10_API_BASE_URL`
- `STAGE10_TEST_PASSWORD`

The script covers: signup, scenario start, workspace updates, comments, simulate, grade, compare, export/share.

## 3) Frontend Performance Monitoring
- Frontend metrics are captured by `apps/web/components/performance-monitor.tsx`.
- Metrics sent to API endpoint: `POST /observability/frontend-metrics`.
- Captured metrics: `TTFB`, `FCP`, `LCP`, `CLS`, `INP`, and route transition time.
- Route transition and Web Vital budget overruns print warnings in the browser console.

## 4) Release Automation + Rollback
- Release gate workflow: `.github/workflows/release.yml`
- Smoke checks script:

```bash
node infra/scripts/stage10-smoke.mjs
```

- Rollback helper:

```bash
ROLLBACK_IMAGE_TAG=<stable-tag> ./infra/scripts/stage10-rollback.sh
```

## 5) Data Lifecycle Controls
Retention and cleanup job:

```bash
node infra/scripts/stage10-retention.mjs
```

Optional env:
- `STAGE10_RETENTION_DAYS` (default `90`)
- `STAGE10_INVITE_RETENTION_DAYS` (default `30`)

The job:
- expires stale pending invites
- prunes old request/job/audit telemetry
- removes historical accepted/revoked/expired invites beyond retention
- removes stale resolved comments

## 6) Beta Analytics Loop
Generate weekly metrics summary:

```bash
node infra/scripts/stage10-analytics-summary.mjs
```

Optional env:
- `STAGE10_ANALYTICS_LOOKBACK_DAYS` (default `7`)

Outputs:
- activation rate
- completed/failed run and grade rates
- average regrade cadence per project
- recent failed-run diagnostics

## 7) Customer Reliability Page
- Public status surface: `http://localhost:3000/status`
- Includes live API checks and incident communication template.
