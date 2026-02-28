#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

const API_BASE_URL = process.env.STAGE10_API_BASE_URL || 'http://localhost:3001';
const TEST_PASSWORD = process.env.STAGE10_TEST_PASSWORD || 'Stage10Pass123';

function makeComponent(id, type, label, x, y, stateful = false) {
  return {
    id,
    type,
    label,
    position: { x, y },
    capacity: {
      opsPerSecond: 1200,
      cpuCores: 2,
      memoryGb: 4
    },
    scaling: {
      replicas: type === 'service' ? 2 : 1,
      verticalTier: 'medium'
    },
    behavior: {
      stateful
    }
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { response, payload };
}

async function assertOk(step, path, options = {}) {
  const { response, payload } = await request(path, options);
  if (!response.ok) {
    const message = payload?.message || response.statusText;
    throw new Error(`[${step}] ${path} failed (${response.status}): ${message}`);
  }
  console.log(`PASS ${step}`);
  return payload;
}

async function run() {
  const email = `stage10-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

  const authPayload = await assertOk('signup', '/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD
    })
  });

  const token = authPayload?.token;
  if (!token) {
    throw new Error('Missing auth token from signup.');
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const scenarios = await assertOk('list-scenarios', '/scenarios');
  const scenarioId = scenarios?.[0]?.id;
  if (!scenarioId) {
    throw new Error('No active scenario found for Stage 10 E2E run.');
  }

  const createdProject = await assertOk('create-project', '/projects', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      scenarioId,
      title: 'Stage 10 E2E Project'
    })
  });

  const projectId = createdProject?.project?.id;
  const baselineVersionId = createdProject?.initialVersion?.id;
  if (!projectId || !baselineVersionId) {
    throw new Error('Project creation response missing IDs.');
  }

  const clientId = randomUUID();
  const serviceId = randomUUID();
  const dbId = randomUUID();
  const cacheId = randomUUID();

  await assertOk('update-baseline-version', `/projects/${projectId}/versions/${baselineVersionId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      components: [
        makeComponent(clientId, 'client', 'Client', 60, 100, false),
        makeComponent(serviceId, 'service', 'Service', 320, 100, false),
        makeComponent(dbId, 'database', 'Primary DB', 620, 100, true)
      ],
      edges: [
        {
          id: randomUUID(),
          sourceId: clientId,
          targetId: serviceId
        },
        {
          id: randomUUID(),
          sourceId: serviceId,
          targetId: dbId
        }
      ],
      notes: 'Baseline iteration for Stage 10 E2E.'
    })
  });

  const createdCandidate = await assertOk('create-candidate-version', `/projects/${projectId}/versions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      parentVersionId: baselineVersionId,
      notes: 'Candidate iteration'
    })
  });

  const candidateVersionId = createdCandidate?.id;
  if (!candidateVersionId) {
    throw new Error('Candidate version ID missing.');
  }

  await assertOk('update-candidate-version', `/projects/${projectId}/versions/${candidateVersionId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      components: [
        makeComponent(clientId, 'client', 'Client', 60, 100, false),
        makeComponent(serviceId, 'service', 'Service', 320, 100, false),
        makeComponent(cacheId, 'cache', 'Cache', 500, 220, true),
        makeComponent(dbId, 'database', 'Primary DB', 700, 100, true)
      ],
      edges: [
        {
          id: randomUUID(),
          sourceId: clientId,
          targetId: serviceId
        },
        {
          id: randomUUID(),
          sourceId: serviceId,
          targetId: cacheId
        },
        {
          id: randomUUID(),
          sourceId: serviceId,
          targetId: dbId
        }
      ],
      notes: 'Candidate with cache layer.'
    })
  });

  await assertOk('workspace-comment', `/projects/${projectId}/versions/${candidateVersionId}/comments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      nodeId: serviceId,
      body: 'Validate autoscaling policy during interview walkthrough.'
    })
  });

  await assertOk('queue-simulation', `/versions/${candidateVersionId}/simulate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  await assertOk('queue-grade', `/versions/${candidateVersionId}/grade`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  await assertOk(
    'compare-versions',
    `/projects/${projectId}/compare?baselineVersionId=${baselineVersionId}&candidateVersionId=${candidateVersionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const exportPayload = await assertOk('create-report-export', `/projects/${projectId}/report/exports`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      baselineVersionId,
      candidateVersionId
    })
  });

  const exportId = exportPayload?.export?.id;
  if (!exportId) {
    throw new Error('Report export ID missing.');
  }

  const sharePayload = await assertOk('create-share-link', `/projects/${projectId}/report/shares`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      exportId
    })
  });

  const shareToken = sharePayload?.export?.shareToken;
  if (!shareToken) {
    throw new Error('Share token missing.');
  }

  await assertOk('load-shared-report', `/shared/reports/${shareToken}`);

  console.log('\\nStage 10 E2E journey completed successfully.');
}

run().catch((error) => {
  console.error(`Stage 10 E2E failed: ${error.message}`);
  process.exitCode = 1;
});
