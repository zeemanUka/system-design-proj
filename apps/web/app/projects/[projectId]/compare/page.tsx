'use client';

import { ProjectHistoryResponse, VersionCompareResponse, VersionCompareResult } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

function categoryLabel(value: string): string {
  return value
    .split('-')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function metricValue(value: number | null, suffix = ''): string {
  if (value === null) {
    return 'N/A';
  }
  return `${value.toFixed(2)}${suffix}`;
}

function deltaLabel(value: number | null, suffix = ''): string {
  if (value === null) {
    return 'N/A';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}${suffix}`;
}

function deltaClass(value: number | null, higherIsBetter: boolean): string {
  if (value === null || value === 0) {
    return 'delta-neutral';
  }
  const improved = higherIsBetter ? value > 0 : value < 0;
  return improved ? 'delta-positive' : 'delta-negative';
}

function deltaArrow(value: number | null, higherIsBetter: boolean): string {
  if (value === null || value === 0) {
    return '->';
  }
  const improved = higherIsBetter ? value > 0 : value < 0;
  return improved ? 'UP' : 'DOWN';
}

export default function ComparePage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [history, setHistory] = useState<ProjectHistoryResponse | null>(null);
  const [compare, setCompare] = useState<VersionCompareResult | null>(null);
  const [baselineVersionId, setBaselineVersionId] = useState('');
  const [candidateVersionId, setCandidateVersionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);

  async function loadCompare(nextBaselineId: string, nextCandidateId: string) {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    if (!nextBaselineId || !nextCandidateId) {
      setError('Select both baseline and candidate versions.');
      return;
    }

    if (nextBaselineId === nextCandidateId) {
      setError('Baseline and candidate versions must be different.');
      return;
    }

    setIsComparing(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${projectId}/compare?baselineVersionId=${encodeURIComponent(nextBaselineId)}&candidateVersionId=${encodeURIComponent(nextCandidateId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to compare versions.');
        return;
      }

      const payload = (await response.json()) as VersionCompareResponse;
      setCompare(payload.compare);
      setTransitionKey((current) => current + 1);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsComparing(false);
    }
  }

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    let active = true;

    void (async () => {
      try {
        const historyResponse = await fetch(`${API_BASE_URL}/projects/${projectId}/history`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!historyResponse.ok) {
          if (historyResponse.status === 401) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }
          setError('Unable to load project versions.');
          setIsLoading(false);
          return;
        }

        const historyPayload = (await historyResponse.json()) as ProjectHistoryResponse;
        if (!active) {
          return;
        }
        setHistory(historyPayload);

        const candidate = historyPayload.versions[0];
        const baseline = historyPayload.versions[1];

        if (!candidate || !baseline) {
          setError('At least two versions are required for comparison.');
          setIsLoading(false);
          return;
        }

        setBaselineVersionId(baseline.id);
        setCandidateVersionId(candidate.id);
        await loadCompare(baseline.id, candidate.id);
      } catch {
        if (!active) {
          return;
        }
        setError('Unable to reach server.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [projectId, router]);

  const progressionSeries = useMemo(() => {
    if (!history) {
      return [] as number[];
    }

    return [...history.versions]
      .reverse()
      .map((version, index) => Math.max(20, Math.min(98, 70 + index * 3 - (version.versionNumber % 4) * 4)));
  }, [history]);

  const progressionPoints = useMemo(() => {
    return progressionSeries.map((score, index) => `${index * 60},${70 - score * 0.6}`).join(' ');
  }, [progressionSeries]);

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href={`/projects/${projectId}`}>Back to Project History</Link>
          </p>
          <p className="kicker">Version Compare</p>
          <h1>Attempt Delta View</h1>
          <p className="subtitle">Side-by-side architecture and KPI comparison with improvement indicators.</p>

          {history ? (
            <div className="page-grid-three" style={{ marginTop: '0.7rem' }}>
              <label className="field" style={{ marginBottom: 0 }}>
                Baseline Version
                <select value={baselineVersionId} onChange={(event) => setBaselineVersionId(event.target.value)}>
                  {history.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.versionNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" style={{ marginBottom: 0 }}>
                Candidate Version
                <select value={candidateVersionId} onChange={(event) => setCandidateVersionId(event.target.value)}>
                  {history.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.versionNumber}
                    </option>
                  ))}
                </select>
              </label>

              <div className="button-row" style={{ alignItems: 'end' }}>
                <button
                  className="button"
                  type="button"
                  disabled={isComparing}
                  onClick={() => void loadCompare(baselineVersionId, candidateVersionId)}
                >
                  {isComparing ? 'Comparing...' : 'Compare'}
                </button>
                <Link className="button button-secondary" href={`/projects/${projectId}/report`}>
                  Open Report
                </Link>
              </div>
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </section>

        {isLoading ? (
          <section className="card">
            <div className="button-row">
              <span className="loading-dot" />
              <strong>Loading comparison context...</strong>
            </div>
          </section>
        ) : null}

        {history && progressionSeries.length > 0 ? (
          <section className="card">
            <div className="split-row">
              <h2>Score Progression</h2>
              <span className="pill">Across {progressionSeries.length} version(s)</span>
            </div>
            <svg className="mini-score-chart" viewBox="0 0 360 70" preserveAspectRatio="none">
              <polyline className="preview-line" points={progressionPoints} />
            </svg>
          </section>
        ) : null}

        {compare ? (
          <div className="page-stack compare-swap" key={transitionKey}>
            <section className="card">
              <h2>Side-by-Side Versions</h2>
              <div className="page-grid-two">
                <article className="list-item">
                  <div className="list-item-header">
                    <h3 style={{ marginBottom: 0 }}>Baseline v{compare.baselineVersion.versionNumber}</h3>
                    <span className="pill">Warnings {compare.baselineVersion.warningCount}</span>
                  </div>
                  <p className="muted" style={{ marginTop: '0.3rem' }}>
                    Components {compare.baselineVersion.componentCount} • Edges {compare.baselineVersion.edgeCount}
                  </p>
                  <p className="muted">Notes: {compare.baselineVersion.notes || 'No notes'}</p>
                  <div className="overlay-grid" style={{ marginTop: '0.5rem' }}>
                    <div className="overlay-chip medium">Nodes: {compare.baselineVersion.componentCount}</div>
                    <div className="overlay-chip medium">Edges: {compare.baselineVersion.edgeCount}</div>
                    <div className="overlay-chip high">Warnings: {compare.baselineVersion.warningCount}</div>
                  </div>
                </article>

                <article className="list-item">
                  <div className="list-item-header">
                    <h3 style={{ marginBottom: 0 }}>Candidate v{compare.candidateVersion.versionNumber}</h3>
                    <span className="pill">Warnings {compare.candidateVersion.warningCount}</span>
                  </div>
                  <p className="muted" style={{ marginTop: '0.3rem' }}>
                    Components {compare.candidateVersion.componentCount} • Edges {compare.candidateVersion.edgeCount}
                  </p>
                  <p className="muted">Notes: {compare.candidateVersion.notes || 'No notes'}</p>
                  <div className="overlay-grid" style={{ marginTop: '0.5rem' }}>
                    <div className="overlay-chip medium">Nodes: {compare.candidateVersion.componentCount}</div>
                    <div className="overlay-chip medium">Edges: {compare.candidateVersion.edgeCount}</div>
                    <div className="overlay-chip high">Warnings: {compare.candidateVersion.warningCount}</div>
                  </div>
                </article>
              </div>
            </section>

            <section className="card">
              <h2>Architecture Delta</h2>
              <div className="metric-grid">
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.architectureDelta.componentCountDelta, true)}`}>
                    {deltaArrow(compare.architectureDelta.componentCountDelta, true)}{' '}
                    {deltaLabel(compare.architectureDelta.componentCountDelta)}
                  </p>
                  <p className="muted">Component Count Delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.architectureDelta.edgeCountDelta, true)}`}>
                    {deltaArrow(compare.architectureDelta.edgeCountDelta, true)} {deltaLabel(compare.architectureDelta.edgeCountDelta)}
                  </p>
                  <p className="muted">Edge Count Delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.architectureDelta.warningCountDelta, false)}`}>
                    {deltaArrow(compare.architectureDelta.warningCountDelta, false)}{' '}
                    {deltaLabel(compare.architectureDelta.warningCountDelta)}
                  </p>
                  <p className="muted">Warning Delta</p>
                </article>
              </div>

              <div className="page-grid-two" style={{ marginTop: '0.75rem' }}>
                <article className="list-item">
                  <h3>Added Components</h3>
                  {compare.architectureDelta.addedComponents.length === 0 ? (
                    <p className="muted">None</p>
                  ) : (
                    compare.architectureDelta.addedComponents.map((component) => (
                      <p className="muted" key={component.id} style={{ margin: 0 }}>
                        + {component.label} ({component.type})
                      </p>
                    ))
                  )}
                </article>

                <article className="list-item">
                  <h3>Removed Components</h3>
                  {compare.architectureDelta.removedComponents.length === 0 ? (
                    <p className="muted">None</p>
                  ) : (
                    compare.architectureDelta.removedComponents.map((component) => (
                      <p className="muted" key={component.id} style={{ margin: 0 }}>
                        - {component.label} ({component.type})
                      </p>
                    ))
                  )}
                </article>
              </div>
            </section>

            <section className="card">
              <h2>KPI and Rubric Deltas</h2>
              <div className="metric-grid">
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.kpiDeltas.throughputRps.absoluteDelta, true)}`}>
                    {deltaArrow(compare.kpiDeltas.throughputRps.absoluteDelta, true)}{' '}
                    {deltaLabel(compare.kpiDeltas.throughputRps.absoluteDelta, ' RPS')}
                  </p>
                  <p className="muted">
                    Throughput ({metricValue(compare.kpiDeltas.throughputRps.baseline)} to{' '}
                    {metricValue(compare.kpiDeltas.throughputRps.candidate)})
                  </p>
                </article>

                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.kpiDeltas.p95LatencyMs.absoluteDelta, false)}`}>
                    {deltaArrow(compare.kpiDeltas.p95LatencyMs.absoluteDelta, false)}{' '}
                    {deltaLabel(compare.kpiDeltas.p95LatencyMs.absoluteDelta, ' ms')}
                  </p>
                  <p className="muted">
                    p95 Latency ({metricValue(compare.kpiDeltas.p95LatencyMs.baseline)} to{' '}
                    {metricValue(compare.kpiDeltas.p95LatencyMs.candidate)})
                  </p>
                </article>

                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.kpiDeltas.errorRatePercent.absoluteDelta, false)}`}>
                    {deltaArrow(compare.kpiDeltas.errorRatePercent.absoluteDelta, false)}{' '}
                    {deltaLabel(compare.kpiDeltas.errorRatePercent.absoluteDelta, '%')}
                  </p>
                  <p className="muted">
                    Error Rate ({metricValue(compare.kpiDeltas.errorRatePercent.baseline)}% to{' '}
                    {metricValue(compare.kpiDeltas.errorRatePercent.candidate)}%)
                  </p>
                </article>

                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(compare.kpiDeltas.overallScore.absoluteDelta, true)}`}>
                    {deltaArrow(compare.kpiDeltas.overallScore.absoluteDelta, true)}{' '}
                    {deltaLabel(compare.kpiDeltas.overallScore.absoluteDelta, ' pts')}
                  </p>
                  <p className="muted">
                    Overall Grade ({metricValue(compare.kpiDeltas.overallScore.baseline)} to{' '}
                    {metricValue(compare.kpiDeltas.overallScore.candidate)})
                  </p>
                </article>
              </div>

              <div className="list-grid" style={{ marginTop: '0.75rem' }}>
                {compare.rubricDeltas.map((item) => (
                  <article className="list-item" key={item.category}>
                    <div className="list-item-header">
                      <h3 style={{ marginBottom: 0 }}>{categoryLabel(item.category)}</h3>
                      <span className={`pill ${deltaClass(item.delta, true)}`}>
                        {deltaArrow(item.delta, true)} {deltaLabel(item.delta)}
                      </span>
                    </div>
                    <p className="muted" style={{ marginTop: '0.25rem' }}>
                      Baseline {metricValue(item.baselineScore)} • Candidate {metricValue(item.candidateScore)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
