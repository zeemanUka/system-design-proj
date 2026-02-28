'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';

type StatusCheck = {
  id: string;
  label: string;
  status: 'operational' | 'degraded' | 'down';
  latencyMs: number | null;
  detail: string;
};

const INCIDENT_TEMPLATE = `Incident Update Template
1) What happened:
2) Impact scope:
3) Current mitigation:
4) Next update time:
5) Post-incident follow-up:
`;

export default function StatusPage() {
  const [checks, setChecks] = useState<StatusCheck[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;

    async function runCheck(
      id: string,
      label: string,
      task: () => Promise<Response>
    ): Promise<StatusCheck> {
      const startedAt = performance.now();
      try {
        const response = await task();
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
        if (!response.ok) {
          return {
            id,
            label,
            status: response.status >= 500 ? 'down' : 'degraded',
            latencyMs,
            detail: `HTTP ${response.status}`
          };
        }

        return {
          id,
          label,
          status: latencyMs > 1800 ? 'degraded' : 'operational',
          latencyMs,
          detail: latencyMs > 1800 ? 'High latency' : 'Healthy response'
        };
      } catch {
        return {
          id,
          label,
          status: 'down',
          latencyMs: null,
          detail: 'Request failed'
        };
      }
    }

    void (async () => {
      const results = await Promise.all([
        runCheck('api-read', 'API read path', () => fetch(`${API_BASE_URL}/scenarios`)),
        runCheck('api-telemetry', 'Frontend telemetry ingest', () =>
          fetch(`${API_BASE_URL}/observability/frontend-metrics`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              metric: {
                name: 'route-change',
                value: 1,
                path: '/status',
                rating: 'good',
                navigationType: 'status-check'
              }
            })
          }).then((response) =>
            response.status === 401 ? new Response(null, { status: 200 }) : response
          )
        )
      ]);

      if (isCancelled) {
        return;
      }

      setChecks(results);
      setLastUpdatedAt(new Date().toLocaleString());
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const overallStatus = useMemo(() => {
    if (checks.some((check) => check.status === 'down')) {
      return 'Major Outage';
    }
    if (checks.some((check) => check.status === 'degraded')) {
      return 'Partial Degradation';
    }
    if (checks.length > 0) {
      return 'All Systems Operational';
    }
    return 'Checking...';
  }, [checks]);

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p className="kicker">Reliability</p>
          <h1>Status Page</h1>
          <p className="subtitle">Customer-facing status and incident communication surface for GA operations.</p>
          <div className="button-row">
            <span className={`pill ${overallStatus === 'All Systems Operational' ? 'pill-accent' : 'pill-warning'}`}>
              {overallStatus}
            </span>
            {lastUpdatedAt ? <span className="pill">Updated: {lastUpdatedAt}</span> : null}
          </div>
        </section>

        <section className="card">
          <h2>Service Checks</h2>
          {checks.length === 0 ? <p className="muted">Running checks...</p> : null}
          <div className="list-grid">
            {checks.map((check) => (
              <article key={check.id} className="list-item">
                <div className="split-row">
                  <strong>{check.label}</strong>
                  <span
                    className={`pill ${
                      check.status === 'operational'
                        ? 'pill-accent'
                        : check.status === 'degraded'
                          ? 'pill-warning'
                          : ''
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {check.detail}
                  {check.latencyMs !== null ? ` • ${check.latencyMs} ms` : ''}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Incident Communication Template</h2>
          <p className="muted">Use this structure for customer updates during active incidents.</p>
          <pre style={{ marginBottom: 0 }}>{INCIDENT_TEMPLATE}</pre>
        </section>
      </div>
    </main>
  );
}
