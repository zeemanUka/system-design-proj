'use client';

import {
  FailureInjectionMode,
  FailureInjectionRequest,
  SimulationRun,
  SimulationRunResponse,
  VersionDetail
} from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

type LoadState = 'loading' | 'ready' | 'error';

type ModeCard = {
  mode: FailureInjectionMode;
  title: string;
  description: string;
  icon: string;
};

const MODE_CARDS: ModeCard[] = [
  {
    mode: 'node-down',
    title: 'Node Down',
    description: 'Force a component outage to test redundancy and failover paths.',
    icon: 'ND'
  },
  {
    mode: 'az-down',
    title: 'AZ Down',
    description: 'Drop an entire availability zone and inspect regional resilience.',
    icon: 'AZ'
  },
  {
    mode: 'dependency-lag',
    title: 'Network Lag',
    description: 'Inject dependency latency and monitor queueing and timeout behavior.',
    icon: 'NL'
  },
  {
    mode: 'traffic-surge',
    title: 'Traffic Surge',
    description: 'Spike incoming load to reveal bottlenecks and saturation limits.',
    icon: 'TS'
  }
];

function deltaLabel(before: number, after: number, unit = ''): string {
  const delta = after - before;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}${unit}`;
}

function percentageChange(before: number, after: number): string {
  if (before === 0) {
    return after === 0 ? '0.00%' : 'N/A';
  }
  const value = ((after - before) / before) * 100;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function deltaClass(before: number, after: number, higherIsBetter: boolean): string {
  if (before === after) {
    return 'delta-neutral';
  }
  const improved = higherIsBetter ? after > before : after < before;
  return improved ? 'delta-positive' : 'delta-negative';
}

function deltaArrow(before: number, after: number): string {
  if (before === after) {
    return '->';
  }
  return after > before ? 'UP' : 'DOWN';
}

export default function FailureInjectionPage() {
  const router = useRouter();
  const params = useParams<{ runId: string }>();
  const baselineRunId = params.runId;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [baselineRun, setBaselineRun] = useState<SimulationRun | null>(null);
  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [injectedRun, setInjectedRun] = useState<SimulationRun | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mode, setMode] = useState<FailureInjectionMode>('node-down');
  const [targetComponentId, setTargetComponentId] = useState('');
  const [azName, setAzName] = useState<'az-a' | 'az-b'>('az-a');
  const [lagMs, setLagMs] = useState(250);
  const [surgeMultiplier, setSurgeMultiplier] = useState(2.2);

  const componentOptions = useMemo(() => {
    return version?.components ?? [];
  }, [version?.components]);

  const injectedTerminal = useMemo(() => {
    return injectedRun?.status === 'completed' || injectedRun?.status === 'failed';
  }, [injectedRun?.status]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    let active = true;

    async function loadBaselineContext() {
      try {
        const baselineResponse = await apiFetch(`${API_BASE_URL}/runs/${baselineRunId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!baselineResponse.ok) {
          if (baselineResponse.status === 401) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }

          setLoadState('error');
          setError('Unable to load baseline run.');
          return;
        }

        const baselinePayload = (await baselineResponse.json()) as SimulationRunResponse;
        if (!active) {
          return;
        }

        setBaselineRun(baselinePayload.run);

        const versionResponse = await apiFetch(
          `${API_BASE_URL}/projects/${baselinePayload.run.projectId}/versions/${baselinePayload.run.versionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!versionResponse.ok) {
          setLoadState('error');
          setError('Unable to load baseline architecture.');
          return;
        }

        const versionPayload = (await versionResponse.json()) as VersionDetail;
        if (!active) {
          return;
        }

        setVersion(versionPayload);
        setTargetComponentId(versionPayload.components[0]?.id ?? '');
        setLoadState('ready');
      } catch {
        if (!active) {
          return;
        }
        setLoadState('error');
        setError('Unable to reach server.');
      }
    }

    void loadBaselineContext();

    return () => {
      active = false;
    };
  }, [baselineRunId, router]);

  useEffect(() => {
    if (!injectedRun || injectedTerminal) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    let active = true;
    const injectedRunId = injectedRun.id;

    async function pollInjectedRun() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/runs/${injectedRunId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as SimulationRunResponse;
        if (!active) {
          return;
        }
        setInjectedRun(payload.run);
      } catch {
        // no-op during polling
      }
    }

    const timer = setInterval(() => {
      void pollInjectedRun();
    }, 1500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [injectedRun, injectedTerminal, router]);

  async function submitFailureInjection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    if (!baselineRun) {
      setError('Baseline run not loaded.');
      return;
    }

    const profile: FailureInjectionRequest['profile'] = {
      mode
    };

    if (mode === 'node-down' || mode === 'dependency-lag') {
      profile.targetComponentId = targetComponentId;
    }
    if (mode === 'dependency-lag') {
      profile.lagMs = Math.max(50, Math.floor(lagMs));
    }
    if (mode === 'az-down') {
      profile.azName = azName;
    }
    if (mode === 'traffic-surge') {
      profile.surgeMultiplier = Math.max(1.1, Number(surgeMultiplier));
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/runs/${baselineRun.id}/failure-injection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ profile })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to start failure injection run.');
        return;
      }

      const payload = (await response.json()) as SimulationRunResponse;
      setInjectedRun(payload.run);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const baselineMetrics = baselineRun?.metrics ?? null;
  const injectedMetrics = injectedRun?.metrics ?? null;

  return (
    <main>
      <div className="failure-shell">
        <div className="page-stack">
          <section className="card">
            <p style={{ marginTop: 0 }}>
              <Link href={`/runs/${baselineRunId}`}>Back to Baseline Run</Link>
            </p>
            <p className="kicker">Failure Injection Lab</p>
            <h1>War-Room Failure Testing</h1>
            <p className="subtitle">Inject controlled faults and compare baseline resilience against degraded behavior.</p>
            {error ? <p className="error">{error}</p> : null}
          </section>

          {loadState === 'loading' ? (
            <section className="card">
              <div className="button-row">
                <span className="loading-dot" />
                <strong>Loading baseline run context...</strong>
              </div>
            </section>
          ) : null}

          {baselineRun && baselineRun.status !== 'completed' ? (
            <section className="card">
              <h2>Baseline Not Ready</h2>
              <p className="muted">Baseline run must be completed before failure injection can start.</p>
            </section>
          ) : null}

          {baselineRun?.status === 'completed' ? (
            <section className="card">
              <h2>Failure Mode Selector</h2>
              <div className="mode-grid" style={{ marginBottom: '0.8rem' }}>
                {MODE_CARDS.map((card) => (
                  <button
                    key={card.mode}
                    type="button"
                    className={`mode-card ${mode === card.mode ? 'active' : ''}`}
                    onClick={() => setMode(card.mode)}
                  >
                    <div className="list-item-header">
                      <strong>{card.title}</strong>
                      <span className="pill">{card.icon}</span>
                    </div>
                    <p className="muted" style={{ marginBottom: 0, marginTop: '0.35rem' }}>
                      {card.description}
                    </p>
                  </button>
                ))}
              </div>

              <form onSubmit={submitFailureInjection}>
                {(mode === 'node-down' || mode === 'dependency-lag') && (
                  <label className="field">
                    Target Component
                    <select value={targetComponentId} onChange={(event) => setTargetComponentId(event.target.value)}>
                      {componentOptions.map((component) => (
                        <option key={component.id} value={component.id}>
                          {component.label} ({component.type})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {mode === 'az-down' && (
                  <label className="field">
                    AZ
                    <select value={azName} onChange={(event) => setAzName(event.target.value as 'az-a' | 'az-b')}>
                      <option value="az-a">AZ-A</option>
                      <option value="az-b">AZ-B</option>
                    </select>
                  </label>
                )}

                {mode === 'dependency-lag' && (
                  <label className="field">
                    Added Lag (ms)
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      step={10}
                      value={lagMs}
                      onChange={(event) => setLagMs(Number(event.target.value) || 250)}
                    />
                  </label>
                )}

                {mode === 'traffic-surge' && (
                  <label className="field">
                    Surge Multiplier
                    <input
                      type="number"
                      min={1.1}
                      max={10}
                      step={0.1}
                      value={surgeMultiplier}
                      onChange={(event) => setSurgeMultiplier(Number(event.target.value) || 2.2)}
                    />
                  </label>
                )}

                <button className="button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Injecting...' : 'Run Failure Injection'}
                </button>
              </form>
            </section>
          ) : null}

          {injectedRun ? (
            <section className="card">
              <h2>Injected Run Status</h2>
              <div className="button-row">
                <span className={`pill ${injectedRun.status === 'completed' ? 'pill-accent' : 'pill-warning'}`}>
                  {injectedRun.status}
                </span>
                <Link className="button button-secondary" href={`/runs/${injectedRun.id}`}>
                  Open Injected Run
                </Link>
              </div>
              {injectedRun.status === 'failed' ? (
                <p className="error" style={{ marginTop: '0.6rem' }}>
                  {injectedRun.failureReason || 'Failure injection run failed.'}
                </p>
              ) : null}
              {injectedRun.status !== 'completed' && injectedRun.status !== 'failed' ? (
                <p className="muted" style={{ marginTop: '0.6rem' }}>
                  Run is processing. This section auto-refreshes.
                </p>
              ) : null}
            </section>
          ) : null}

          {baselineMetrics && injectedMetrics ? (
            <section className="card">
              <h2>Before / After Comparison</h2>
              <div className="page-grid-two">
                <article className="list-item">
                  <h3>Baseline</h3>
                  <p className="muted">Throughput: {Math.round(baselineMetrics.throughputRps).toLocaleString()} RPS</p>
                  <p className="muted">p95: {baselineMetrics.p95LatencyMs.toFixed(1)} ms</p>
                  <p className="muted">Error: {baselineMetrics.errorRatePercent.toFixed(2)}%</p>
                </article>

                <article className="list-item">
                  <h3>Injected</h3>
                  <p className="muted">Throughput: {Math.round(injectedMetrics.throughputRps).toLocaleString()} RPS</p>
                  <p className="muted">p95: {injectedMetrics.p95LatencyMs.toFixed(1)} ms</p>
                  <p className="muted">Error: {injectedMetrics.errorRatePercent.toFixed(2)}%</p>
                </article>
              </div>

              <div className="metric-grid" style={{ marginTop: '0.75rem' }}>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(baselineMetrics.throughputRps, injectedMetrics.throughputRps, true)}`}>
                    {deltaArrow(baselineMetrics.throughputRps, injectedMetrics.throughputRps)}{' '}
                    {percentageChange(baselineMetrics.throughputRps, injectedMetrics.throughputRps)}
                  </p>
                  <p className="muted">Throughput delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(baselineMetrics.p95LatencyMs, injectedMetrics.p95LatencyMs, false)}`}>
                    {deltaArrow(baselineMetrics.p95LatencyMs, injectedMetrics.p95LatencyMs)}{' '}
                    {deltaLabel(baselineMetrics.p95LatencyMs, injectedMetrics.p95LatencyMs, 'ms')}
                  </p>
                  <p className="muted">Latency delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(baselineMetrics.errorRatePercent, injectedMetrics.errorRatePercent, false)}`}>
                    {deltaArrow(baselineMetrics.errorRatePercent, injectedMetrics.errorRatePercent)}{' '}
                    {deltaLabel(baselineMetrics.errorRatePercent, injectedMetrics.errorRatePercent, '%')}
                  </p>
                  <p className="muted">Error-rate delta</p>
                </article>
                <article className="metric-card">
                  <p className="metric-value">
                    {baselineMetrics.saturated ? 'Sat' : 'Healthy'} {'->'}{' '}
                    {injectedMetrics.saturated ? 'Sat' : 'Healthy'}
                  </p>
                  <p className="muted">Saturation state</p>
                </article>
              </div>
            </section>
          ) : null}

          {injectedRun?.blastRadius ? (
            <section className="card">
              <h2>Blast Radius Visualization</h2>
              <p className="muted">
                Impacted: {injectedRun.blastRadius.impactedCount} components • Critical:{' '}
                {injectedRun.blastRadius.criticalCount} • Estimated user impact:{' '}
                {injectedRun.blastRadius.estimatedUserImpactPercent.toFixed(2)}%
              </p>
              <p>{injectedRun.blastRadius.summary}</p>

              <div className="overlay-grid">
                {injectedRun.blastRadius.impactedComponents.map((component) => (
                  <article key={`${component.componentId}-${component.reason}`} className={`overlay-chip ${component.severity}`}>
                    <strong>{component.componentLabel}</strong>
                    <p className="muted" style={{ marginTop: '0.2rem', marginBottom: '0.15rem' }}>
                      {component.componentType}
                    </p>
                    <p style={{ marginBottom: 0 }}>{component.reason}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
