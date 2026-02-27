# System Design Coach

Interactive system design practice platform where users build architectures, run simulations, inject failures, and receive AI-assisted grading feedback.

## What This Includes
- Scenario-driven practice projects with versioned architecture attempts
- Interactive canvas with draggable components and topology validation
- Traffic profile modeling per version
- Simulation runs with bottleneck and timeline outputs
- Failure injection lab (node down, AZ down, lag, traffic surge)
- Deterministic grading plus configurable AI feedback provider
- Version compare, final report generation, PDF export, and share links
- Stage 9 hardening: rate limits, secure headers, telemetry, runbooks

## Architecture
- `apps/web`: Next.js frontend (`http://localhost:3000`)
- `apps/api`: NestJS API with Fastify adapter (`http://localhost:3001`)
- `apps/simulation-worker`: BullMQ worker for simulation jobs
- `apps/grading-worker`: BullMQ worker for grading jobs
- `packages/shared-types`: shared contracts and zod schemas
- `packages/simulation-core`: deterministic simulation engine
- `packages/grading-core`: deterministic grading rubric engine
- `infra/docker`: local PostgreSQL + Redis

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop (or Docker Engine + Compose)

## Quick Start (Local Dev)
1. Install dependencies:
```bash
npm install
```

2. Create env file:
```bash
cp .env.example .env
```

3. Start infrastructure:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

4. Sync Prisma client/schema and seed:
```bash
npm --workspace @sdc/api run prisma:generate
npx prisma db push --schema apps/api/prisma/schema.prisma
npm --workspace @sdc/api run prisma:seed
```

5. Start services in separate terminals:
```bash
npm run dev:api
npm run dev:simulation-worker
npm run dev:grading-worker
npm run dev:web
```

6. Open the app:
- Web: `http://localhost:3000`
- API health check (example): `http://localhost:3001/scenarios`

## Environment Variables
Source of truth: `.env.example`

Core:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `API_PORT`
- `NEXT_PUBLIC_API_BASE_URL`

Security/observability:
- `CORS_ALLOWED_ORIGINS`
- `API_BODY_LIMIT_BYTES`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX_REQUESTS`
- `REQUEST_TELEMETRY_SAMPLE_RATE`

AI feedback:
- `AI_PROVIDER`: `mock`, `openai-compatible`, or `anthropic`
- `AI_MODEL`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_TEMPERATURE`
- `AI_MAX_TOKENS`

Notes:
- `AI_PROVIDER=mock` works without an external API key.
- For `openai-compatible` or `anthropic`, set a valid `AI_API_KEY` before running the grading worker.

## Common Commands
```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run loadtest:stage9
```

## Production-Like Start (Built Artifacts)
Build:
```bash
npm run build
```

Start each app/worker:
```bash
npm --workspace @sdc/api run start
npm --workspace @sdc/simulation-worker run start
npm --workspace @sdc/grading-worker run start
npm --workspace @sdc/web run start
```

## Shutdown
1. Stop running dev/start processes (`Ctrl+C` in each terminal)
2. Stop infrastructure:
```bash
docker compose -f infra/docker/docker-compose.yml down
```

## Observability Dashboard (Grafana)
Grafana is included in Docker Compose and auto-provisions:
- Postgres datasource: `SDC Postgres`
- Dashboard: `System Design Coach - Observability`

### Use It
1. Start infra:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
2. Start app services (`api`, `simulation-worker`, `grading-worker`, `web`) and generate traffic in the app.
3. Open Grafana: `http://localhost:3002`
4. Login with:
- username: value of `GRAFANA_ADMIN_USER` in `.env`
- password: value of `GRAFANA_ADMIN_PASSWORD` in `.env`
5. Open folder `System Design Coach` and select `System Design Coach - Observability`.

### What You’ll See
- API requests/minute
- API p95 latency
- API 5xx error rate
- failed jobs/minute
- job state breakdown
- top slow endpoints
- recent audit events
- mutating requests/minute

## Troubleshooting
- Simulation/grade jobs stay pending:
  - Ensure both workers are running and Redis is reachable.
- Prisma/runtime schema mismatch:
  - Re-run `npm --workspace @sdc/api run prisma:generate`
  - Re-run `npx prisma db push --schema apps/api/prisma/schema.prisma`
- Grading fails with provider errors:
  - Check `AI_PROVIDER`, `AI_BASE_URL`, and `AI_API_KEY` values in `.env`.
- Grafana dashboard missing:
  - Restart Grafana container: `docker compose -f infra/docker/docker-compose.yml restart grafana`
  - Check provisioning files in `infra/grafana/provisioning`.

## Project Docs
- `Onboarding document.md`
- `status.md`
- `docs/stage9-runbook.md`
- `docs/observability-dashboard.md`
- `docs/incident-response.md`
- `docs/authz-review-matrix.md`
- `docs/beta-readiness.md`
