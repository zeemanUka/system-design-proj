#!/usr/bin/env node

const API_BASE_URL = process.env.STAGE10_SMOKE_API_URL || 'http://localhost:3001';
const WEB_BASE_URL = process.env.STAGE10_SMOKE_WEB_URL || 'http://localhost:3000';

async function check(name, url, init = {}, expectedStatuses = [200]) {
  try {
    const response = await fetch(url, init);
    if (!expectedStatuses.includes(response.status)) {
      throw new Error(`status ${response.status}`);
    }
    console.log(`PASS ${name}: ${url} -> ${response.status}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${url} (${error.message})`);
    return false;
  }
}

async function run() {
  const results = await Promise.all([
    check('api-scenarios', `${API_BASE_URL}/scenarios`),
    check(
      'api-frontend-metrics',
      `${API_BASE_URL}/observability/frontend-metrics`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metric: {
            name: 'route-change',
            value: 1,
            path: '/smoke',
            rating: 'good',
            navigationType: 'smoke'
          }
        })
      },
      [200]
    ),
    check('web-landing', `${WEB_BASE_URL}/`),
    check('web-status-page', `${WEB_BASE_URL}/status`)
  ]);

  if (results.some((result) => !result)) {
    process.exitCode = 1;
    return;
  }

  console.log('Stage 10 smoke checks passed.');
}

run().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
