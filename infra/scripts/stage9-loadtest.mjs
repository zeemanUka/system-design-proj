import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.LOADTEST_BASE_URL || 'http://localhost:3001';
const TOTAL_REQUESTS = clampInt(process.env.LOADTEST_TOTAL_REQUESTS, 16, 1, 200);
const CONCURRENCY = clampInt(process.env.LOADTEST_CONCURRENCY, 4, 1, 40);

function clampInt(raw, fallback, min, max) {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function benchmark({ name, totalRequests, concurrency, runRequest }) {
  const latencies = [];
  const statusCounts = new Map();
  let nextIndex = 0;

  const startedAt = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      while (true) {
        const current = nextIndex;
        nextIndex += 1;
        if (current >= totalRequests) {
          break;
        }

        const requestStartedAt = performance.now();
        let statusKey = 'ERR';

        try {
          const response = await runRequest();
          statusKey = String(response.status);
          await response.arrayBuffer();
        } catch {
          statusKey = 'ERR';
        }

        const latencyMs = performance.now() - requestStartedAt;
        latencies.push(latencyMs);
        statusCounts.set(statusKey, (statusCounts.get(statusKey) || 0) + 1);
      }
    })
  );
  const completedAt = performance.now();

  const successCount = Array.from(statusCounts.entries()).reduce((acc, [status, count]) => {
    if (status.startsWith('2')) {
      return acc + count;
    }
    return acc;
  }, 0);
  const failureCount = totalRequests - successCount;
  const durationMs = completedAt - startedAt;

  return {
    name,
    totalRequests,
    concurrency,
    successCount,
    failureCount,
    durationMs: Number(durationMs.toFixed(2)),
    throughputRps: Number((totalRequests / (durationMs / 1000)).toFixed(2)),
    latencyMs: {
      min: Number(Math.min(...latencies, 0).toFixed(2)),
      p50: Number(percentile(latencies, 50).toFixed(2)),
      p95: Number(percentile(latencies, 95).toFixed(2)),
      max: Number(Math.max(...latencies, 0).toFixed(2))
    },
    statusCounts: Object.fromEntries(Array.from(statusCounts.entries()).sort())
  };
}

async function main() {
  const email = `stage9-loadtest-${Date.now()}@example.com`;
  const password = 'password123';

  const signupResponse = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!signupResponse.ok) {
    throw new Error(`Signup failed (${signupResponse.status}).`);
  }

  const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!loginResponse.ok) {
    throw new Error(`Login failed (${loginResponse.status}).`);
  }
  const loginPayload = await loginResponse.json();
  const token = loginPayload.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Login response did not include token.');
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const scenarioResponse = await fetch(`${BASE_URL}/scenarios`, { headers: authHeaders });
  const scenarios = await scenarioResponse.json();
  if (!scenarioResponse.ok || !Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error('Scenario bootstrap failed.');
  }
  const scenarioId = scenarios[0].id;

  const projectResponse = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      scenarioId,
      title: 'Stage 9 Load Test Project'
    })
  });
  const projectPayload = await projectResponse.json();
  if (!projectResponse.ok) {
    throw new Error(`Project bootstrap failed (${projectResponse.status}).`);
  }
  const projectId = projectPayload.project.id;
  const baselineVersionId = projectPayload.initialVersion.id;

  const versionResponse = await fetch(`${BASE_URL}/projects/${projectId}/versions`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      parentVersionId: baselineVersionId,
      notes: 'candidate'
    })
  });
  const versionPayload = await versionResponse.json();
  if (!versionResponse.ok) {
    throw new Error(`Version bootstrap failed (${versionResponse.status}).`);
  }
  const candidateVersionId = versionPayload.id;

  const suites = [
    await benchmark({
      name: 'GET /scenarios',
      totalRequests: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      runRequest: () => fetch(`${BASE_URL}/scenarios`, { headers: authHeaders })
    }),
    await benchmark({
      name: 'GET /projects/:id/history',
      totalRequests: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      runRequest: () => fetch(`${BASE_URL}/projects/${projectId}/history`, { headers: authHeaders })
    }),
    await benchmark({
      name: 'GET /projects/:id/compare',
      totalRequests: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      runRequest: () =>
        fetch(
          `${BASE_URL}/projects/${projectId}/compare?baselineVersionId=${baselineVersionId}&candidateVersionId=${candidateVersionId}`,
          { headers: authHeaders }
        )
    }),
    await benchmark({
      name: 'POST /versions/:id/simulate (enqueue throughput)',
      totalRequests: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      runRequest: () =>
        fetch(`${BASE_URL}/versions/${candidateVersionId}/simulate`, {
          method: 'POST',
          headers: authHeaders
        })
    }),
    await benchmark({
      name: 'POST /versions/:id/grade (enqueue throughput)',
      totalRequests: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      runRequest: () =>
        fetch(`${BASE_URL}/versions/${candidateVersionId}/grade`, {
          method: 'POST',
          headers: authHeaders
        })
    })
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRequests: TOTAL_REQUESTS,
    concurrency: CONCURRENCY,
    setup: {
      projectId,
      baselineVersionId,
      candidateVersionId
    },
    suites
  };

  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/load-test-results.json', JSON.stringify(result, null, 2));

  console.log(`Stage 9 load test complete. Results written to docs/load-test-results.json`);
  for (const suite of suites) {
    console.log(
      `- ${suite.name}: success=${suite.successCount}/${suite.totalRequests}, p95=${suite.latencyMs.p95}ms, rps=${suite.throughputRps}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
