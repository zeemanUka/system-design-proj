'use client';

import { SharedReportResponse } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';

function deltaLabel(value: number | null, suffix = '') {
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

export default function SharedReportPage() {
  const params = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken;

  const [data, setData] = useState<SharedReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/shared/reports/${shareToken}`);
        if (!response.ok) {
          setError('Shared report was not found or has been revoked.');
          setIsLoading(false);
          return;
        }

        const payload = (await response.json()) as SharedReportResponse;
        if (!active) {
          return;
        }
        setData(payload);
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
  }, [shareToken]);

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p className="kicker">Shared Read-Only Report</p>
          <h1>System Design Progress Snapshot</h1>
          <p className="subtitle">This URL is view-only and intended for mentor or interviewer review.</p>
          <p style={{ marginBottom: 0 }}>
            <Link href="/">Open App Landing</Link>
          </p>
          {error ? <p className="error">{error}</p> : null}
        </section>

        {isLoading ? (
          <section className="card">
            <div className="button-row">
              <span className="loading-dot" />
              <strong>Loading shared report...</strong>
            </div>
          </section>
        ) : null}

        {data ? (
          <>
            <section className="card">
              <h2>{data.report.summary.headline}</h2>
              <p className="muted">
                Verdict: {data.report.summary.progressVerdict} • Generated {new Date(data.report.generatedAt).toLocaleString()}
              </p>
              <div className="button-row">
                <a className="button button-secondary" href={`${API_BASE_URL}${data.export.downloadPath}`}>
                  Download PDF
                </a>
              </div>
            </section>

            <section className="card">
              <h2>KPI Deltas</h2>
              <div className="metric-grid">
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(data.report.compare.kpiDeltas.throughputRps.absoluteDelta, true)}`}>
                    {deltaLabel(data.report.compare.kpiDeltas.throughputRps.absoluteDelta, ' RPS')}
                  </p>
                  <p className="muted">Throughput Delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(data.report.compare.kpiDeltas.p95LatencyMs.absoluteDelta, false)}`}>
                    {deltaLabel(data.report.compare.kpiDeltas.p95LatencyMs.absoluteDelta, ' ms')}
                  </p>
                  <p className="muted">p95 Latency Delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(data.report.compare.kpiDeltas.errorRatePercent.absoluteDelta, false)}`}>
                    {deltaLabel(data.report.compare.kpiDeltas.errorRatePercent.absoluteDelta, '%')}
                  </p>
                  <p className="muted">Error Rate Delta</p>
                </article>
                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(data.report.compare.kpiDeltas.overallScore.absoluteDelta, true)}`}>
                    {deltaLabel(data.report.compare.kpiDeltas.overallScore.absoluteDelta, ' pts')}
                  </p>
                  <p className="muted">Overall Score Delta</p>
                </article>
              </div>
            </section>

            <section className="card">
              <h2>Highlights</h2>
              {data.report.summary.highlights.length === 0 ? <p className="muted">No highlights listed.</p> : null}
              {data.report.summary.highlights.map((entry, index) => (
                <p key={`highlight-${index}`} className="muted" style={{ marginBottom: '0.2rem' }}>
                  + {entry}
                </p>
              ))}

              <h2 style={{ marginTop: '0.85rem' }}>Concerns</h2>
              {data.report.summary.concerns.length === 0 ? <p className="muted">No concerns listed.</p> : null}
              {data.report.summary.concerns.map((entry, index) => (
                <p key={`concern-${index}`} className="muted" style={{ marginBottom: '0.2rem' }}>
                  - {entry}
                </p>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
