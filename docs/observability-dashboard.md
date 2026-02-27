# Observability Dashboard Setup (Grafana)

This project now includes an online observability view powered by Grafana.

## What Was Added
1. Grafana service in Docker Compose (`infra/docker/docker-compose.yml`)
2. Provisioned Postgres datasource (`infra/grafana/provisioning/datasources/postgres.yml`)
3. Provisioned dashboard provider (`infra/grafana/provisioning/dashboards/dashboards.yml`)
4. Prebuilt dashboard JSON (`infra/grafana/dashboards/system-design-coach-observability.json`)
5. Grafana credentials in `.env` and `.env.example`:
   - `GRAFANA_ADMIN_USER`
   - `GRAFANA_ADMIN_PASSWORD`

## Run and View
1. Start infra:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
2. Start app services:
```bash
npm run dev:api
npm run dev:simulation-worker
npm run dev:grading-worker
npm run dev:web
```
3. Open Grafana:
- `http://localhost:3002`
4. Login with `.env` credentials:
- user: `GRAFANA_ADMIN_USER`
- password: `GRAFANA_ADMIN_PASSWORD`
5. Open:
- Folder: `System Design Coach`
- Dashboard: `System Design Coach - Observability`

## Dashboard Panels
- API Requests / Minute
- API p95 Latency (ms)
- API 5xx Error Rate %
- Failed Jobs / Minute
- Job State Breakdown
- Top Slow Endpoints
- Recent Audit Events
- Mutating Requests / Minute

## Notes
- Dashboard data comes from Stage 9 telemetry tables:
  - `RequestTelemetry`
  - `AuditLog`
  - `JobTelemetry`
- If the dashboard is empty, generate traffic in the app first (login, create project, run simulation, run grade).
