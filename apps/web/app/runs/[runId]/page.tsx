'use client';

import { SimulationRun, SimulationRunResponse } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

type LoadState = 'loading' | 'ready' | 'error';

function statusLabel(status: SimulationRun['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function statusClassName(status: SimulationRun['status']): string {
  return status === 'completed'
    ? 'pill pill-accent'
    : status === 'failed'
      ? 'pill'
      : 'pill';
}

export default function SimulationRunPage() {
  const router = useRouter();
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

  const [run, setRun] = useState<SimulationRun | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  const isTerminal = useMemo(() => {
    return run?.status === 'completed' || run?.status === 'failed';
  }, [run?.status]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    let isActive = true;

    async function fetchRun() {
      try {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }

          setLoadState('error');
          setError('Unable to load simulation run.');
          return;
        }

        const payload = (await response.json()) as SimulationRunResponse;
        if (!isActive) {
          return;
        }

        setRun(payload.run);
        setLoadState('ready');
        setError(null);
      } catch {
        if (!isActive) {
          return;
        }
        setLoadState('error');
        setError('Unable to reach server.');
      }
    }

    void fetchRun();
    const interval = setInterval(() => {
      if (!isTerminal) {
        void fetchRun();
      }
    }, 1500);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [isTerminal, router, runId]);

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            {run ? (
              <Link href={`/projects/${run.projectId}/versions/${run.versionId}`}>Back to Workspace</Link>
            ) : (
              <Link href="/dashboard">Back to Dashboard</Link>
            )}
          </p>
          <p className="kicker">Simulation Results</p>
          <h1>Run {runId}</h1>
          <p className="subtitle">Track execution progress and inspect bottlenecks as soon as results are ready.</p>
          {run ? <span className={statusClassName(run.status)}>{statusLabel(run.status)}</span> : null}
          {run?.status === 'completed' ? (
            <div className="button-row" style={{ marginTop: '0.75rem' }}>
              <Link className="button button-secondary" href={`/runs/${run.id}/failure-injection`}>
                Open Failure Lab
              </Link>
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          {run && !isTerminal ? (
            <p className="muted" style={{ marginTop: '0.55rem' }}>
              Run is still processing. This page auto-refreshes every 1.5 seconds.
            </p>
          ) : null}
        </section>

        {loadState === 'loading' ? (
          <section className="card">
            <p className="muted">Loading run state...</p>
          </section>
        ) : null}

        {run?.status === 'failed' ? (
          <section className="card">
            <h2>Run Failed</h2>
            <p className="error">{run.failureReason || 'Simulation run failed unexpectedly.'}</p>
          </section>
        ) : null}

        {run?.status === 'completed' && run.metrics ? (
          <>
            <section className="card">
              <h2>KPIs</h2>
              <div className="metric-grid">
                <article className="metric-card">
                  <p className="metric-value">{Math.round(run.metrics.throughputRps).toLocaleString()}</p>
                  <p className="muted">Throughput RPS</p>
                </article>
                <article className="metric-card">
                  <p className="metric-value">{Math.round(run.metrics.capacityRps).toLocaleString()}</p>
                  <p className="muted">Capacity RPS</p>
                </article>
                <article className="metric-card">
                  <p className="metric-value">{run.metrics.p50LatencyMs.toFixed(1)}ms</p>
                  <p className="muted">p50 Latency</p>
                </article>
                <article className="metric-card">
                  <p className="metric-value">{run.metrics.p95LatencyMs.toFixed(1)}ms</p>
                  <p className="muted">p95 Latency</p>
                </article>
                <article className="metric-card">
                  <p className="metric-value">{run.metrics.errorRatePercent.toFixed(2)}%</p>
                  <p className="muted">Error Rate</p>
                </article>
                <article className="metric-card">
                  <p className="metric-value">{run.metrics.saturated ? 'Yes' : 'No'}</p>
                  <p className="muted">Saturated</p>
                </article>
              </div>
            </section>

            <section className="card">
              <h2>Bottlenecks</h2>
              {run.bottlenecks.length === 0 ? <p className="muted">No bottlenecks were detected.</p> : null}
              <div className="list-grid">
                {run.bottlenecks.map((bottleneck) => (
                  <article className="list-item" key={`${bottleneck.componentId}-${bottleneck.reason}`}>
                    <div className="list-item-header">
                      <h3 style={{ marginBottom: 0 }}>{bottleneck.componentLabel}</h3>
                      <span className="pill">{bottleneck.severity}</span>
                    </div>
                    <p className="muted" style={{ marginTop: '0.25rem' }}>
                      {bottleneck.componentType} • Utilization {bottleneck.utilizationPercent.toFixed(1)}%
                    </p>
                    <p className="muted" style={{ marginTop: '0.2rem' }}>
                      Required {Math.round(bottleneck.requiredRps).toLocaleString()} RPS • Capacity{' '}
                      {Math.round(bottleneck.capacityRps).toLocaleString()} RPS
                    </p>
                    <p style={{ marginTop: '0.3rem' }}>{bottleneck.reason}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {run ? (
          <section className="card">
            <h2>Failure Timeline</h2>
            {run.events.length === 0 ? <p className="muted">No timeline events were recorded.</p> : null}
            <div className="list-grid">
              {run.events.map((event) => (
                <article className="list-item" key={`${event.sequence}-${event.title}`}>
                  <div className="list-item-header">
                    <h3 style={{ marginBottom: 0 }}>{event.title}</h3>
                    <span className="pill">t+{event.atSecond}s</span>
                  </div>
                  <p className="muted" style={{ marginTop: '0.25rem' }}>
                    Severity: {event.severity}
                  </p>
                  <p style={{ marginTop: '0.2rem' }}>{event.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
