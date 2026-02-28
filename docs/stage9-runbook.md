# Stage 9 Runbook (Hardening + Observability)

## 1. Purpose
Operational guide for running the System Design Coach beta with:
- request telemetry
- audit logs
- queue job telemetry
- security baseline controls (rate limiting, secure headers, input hardening)

## 2. Environment
Required:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `API_PORT`

Recommended security/ops:
- `CORS_ALLOWED_ORIGINS` (default `http://localhost:3000`)
- `API_BODY_LIMIT_BYTES` (default `1048576`)
- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `RATE_LIMIT_MAX_REQUESTS` (default `120`)
- `AUTH_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `AUTH_RATE_LIMIT_MAX_REQUESTS` (default `12`)
- `REQUEST_TELEMETRY_SAMPLE_RATE` (default `1`)

## 3. Start/Stop
1. Start infrastructure:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
2. Ensure Prisma client + schema sync:
```bash
npm --workspace @sdc/api run prisma:generate
npm --workspace @sdc/api run prisma:db:push -- --accept-data-loss
```
3. Start services:
```bash
npm run dev:api
npm run dev:simulation-worker
npm run dev:grading-worker
npm run dev:web
```
4. Stop infrastructure:
```bash
docker compose -f infra/docker/docker-compose.yml down
```

## 4. Key Telemetry Tables
- `RequestTelemetry`: request duration/status/path/user for API traffic.
- `AuditLog`: mutating endpoint audit records (`POST/PATCH/PUT/DELETE`).
- `JobTelemetry`: queue lifecycle (`queued`, `running`, `completed`, `failed`).

## 5. Quick Health Queries
Recent API errors:
```sql
select method, path, statusCode, count(*) as count
from "RequestTelemetry"
where "createdAt" >= now() - interval '15 minutes'
  and "statusCode" >= 400
group by method, path, statusCode
order by count desc;
```

Top slow endpoints:
```sql
select path, round(avg("durationMs")::numeric, 2) as avg_ms, max("durationMs") as max_ms
from "RequestTelemetry"
where "createdAt" >= now() - interval '15 minutes'
group by path
order by avg_ms desc
limit 10;
```

Failed jobs:
```sql
select "queueName", "jobType", "jobId", "errorMessage", "createdAt"
from "JobTelemetry"
where "state" = 'failed'
order by "createdAt" desc
limit 50;
```

Recent privileged mutations:
```sql
select action, "resourceType", "resourceId", "userId", "statusCode", "createdAt"
from "AuditLog"
where "createdAt" >= now() - interval '24 hours'
order by "createdAt" desc
limit 100;
```

## 6. Operational Baselines
- Keep API `5xx` rate under `1%` over 15-minute windows.
- Keep queue failure state under `2%` of job events.
- Investigate p95 latency spikes over `750ms` on read endpoints.
- Rotate `JWT_SECRET` before production.
- Restrict `CORS_ALLOWED_ORIGINS` to known trusted frontend origins.

## 7. Recovery Basics
1. API unstable:
- inspect `RequestTelemetry` error/latency trends
- check DB/Redis reachability
- reduce traffic or raise rate-limit thresholds only if justified
2. Queue failures:
- inspect `JobTelemetry` failed rows
- restart affected worker (`simulation` or `grading`)
- retry jobs by re-triggering from UI/API if safe
3. Data integrity concern:
- stop write traffic
- snapshot DB
- validate latest rows in `SimulationRun`, `GradeReport`, `ReportExport`
