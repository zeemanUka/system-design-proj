'use client';

import {
  ProjectHistoryResponse,
  ProjectReport,
  ProjectReportResponse,
  ReportExport,
  ReportExportResponse,
  ReportShareResponse
} from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

function metricValue(value: number | null, suffix = ''): string {
  if (value === null) {
    return 'N/A';
  }
  return `${value.toFixed(2)}${suffix}`;
}

function deltaValue(value: number | null, suffix = ''): string {
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

function priorityClass(priority: string): string {
  const normalized = priority.toLowerCase();
  if (normalized === 'p0') {
    return 'priority-badge priority-p0';
  }
  if (normalized === 'p1') {
    return 'priority-badge priority-p1';
  }
  return 'priority-badge priority-p2';
}

export default function ProjectReportPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [history, setHistory] = useState<ProjectHistoryResponse | null>(null);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [exportRecord, setExportRecord] = useState<ReportExport | null>(null);
  const [baselineVersionId, setBaselineVersionId] = useState('');
  const [candidateVersionId, setCandidateVersionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingReport, setIsRefreshingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin;

  async function fetchProjectReport(nextBaselineId?: string, nextCandidateId?: string) {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    if (nextBaselineId && nextCandidateId && nextBaselineId === nextCandidateId) {
      setError('Baseline and candidate versions must be different.');
      return;
    }

    setIsRefreshingReport(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (nextBaselineId) {
        query.set('baselineVersionId', nextBaselineId);
      }
      if (nextCandidateId) {
        query.set('candidateVersionId', nextCandidateId);
      }

      const response = await apiFetch(
        `${API_BASE_URL}/projects/${projectId}/report${query.toString() ? `?${query.toString()}` : ''}`,
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
        setError(payload.message || 'Unable to load report.');
        return;
      }

      const payload = (await response.json()) as ProjectReportResponse;
      setReport(payload.report);
      setBaselineVersionId(payload.report.baselineVersionId);
      setCandidateVersionId(payload.report.candidateVersionId);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsRefreshingReport(false);
    }
  }

  async function downloadAuthenticatedPdf(path: string, fileName: string) {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    const response = await apiFetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Unable to download report PDF.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    if (!baselineVersionId || !candidateVersionId) {
      setError('Select baseline and candidate versions before export.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/report/exports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          baselineVersionId,
          candidateVersionId
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to export report.');
        return;
      }

      const payload = (await response.json()) as ReportExportResponse;
      setReport(payload.report);
      setExportRecord(payload.export);
      await downloadAuthenticatedPdf(payload.export.downloadPath, payload.export.fileName);
    } catch {
      setError('Unable to export report PDF.');
    } finally {
      setIsExporting(false);
    }
  }

  async function createShareLink() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    if (!exportRecord) {
      setError('Export a report before creating a share link.');
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/report/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          exportId: exportRecord.id
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to create share link.');
        return;
      }

      const payload = (await response.json()) as ReportShareResponse;
      setExportRecord(payload.export);
    } catch {
      setError('Unable to create share link.');
    } finally {
      setIsSharing(false);
    }
  }

  async function revokeShareLink() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    if (!exportRecord?.shareToken) {
      return;
    }

    setIsRevoking(true);
    setError(null);

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/projects/${projectId}/report/shares/${encodeURIComponent(exportRecord.shareToken)}/revoke`,
        {
          method: 'PATCH',
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
        setError(payload.message || 'Unable to revoke share link.');
        return;
      }

      const payload = (await response.json()) as ReportShareResponse;
      setExportRecord(payload.export);
    } catch {
      setError('Unable to revoke share link.');
    } finally {
      setIsRevoking(false);
    }
  }

  async function copyShareLink() {
    if (!exportRecord?.shareUrl) {
      return;
    }

    const absoluteUrl = `${window.location.origin}${exportRecord.shareUrl}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
    } catch {
      setError('Unable to copy share link.');
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
        const historyResponse = await apiFetch(`${API_BASE_URL}/projects/${projectId}/history`, {
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
          setError('Unable to load project history.');
          setIsLoading(false);
          return;
        }

        const historyPayload = (await historyResponse.json()) as ProjectHistoryResponse;
        if (!active) {
          return;
        }
        setHistory(historyPayload);

        if (historyPayload.versions.length < 2) {
          setError('At least two versions are required to generate a report.');
          setIsLoading(false);
          return;
        }

        await fetchProjectReport();
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

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href={`/projects/${projectId}`}>Back to Project History</Link>
          </p>
          <p className="kicker">Final Report</p>
          <h1>Progress Review and Export</h1>
          <p className="subtitle">Generate progression summary, export PDF, and manage read-only share links.</p>

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
                  disabled={isRefreshingReport}
                  onClick={() => void fetchProjectReport(baselineVersionId, candidateVersionId)}
                >
                  {isRefreshingReport ? 'Refreshing...' : 'Refresh Report'}
                </button>
                <Link className="button button-secondary" href={`/projects/${projectId}/compare`}>
                  Open Compare
                </Link>
              </div>
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </section>

        {isLoading ? (
          <section className="card">
            <p className="muted">Loading report context...</p>
          </section>
        ) : null}

        {report ? (
          <>
            <section className="card">
              <div className="split-row">
                <div>
                  <h2>{report.summary.headline}</h2>
                  <p className="muted">Verdict: {report.summary.progressVerdict}</p>
                </div>
                <div className="button-row">
                  <button className="button" type="button" disabled={isExporting} onClick={() => void exportPdf()}>
                    {isExporting ? 'Exporting...' : 'Export PDF'}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={isSharing || !exportRecord}
                    onClick={() => void createShareLink()}
                  >
                    {isSharing ? 'Creating...' : 'Create Share Link'}
                  </button>
                </div>
              </div>

              <div className="metric-grid" style={{ marginTop: '0.7rem' }}>
                <article className="metric-card">
                  <p
                    className={`metric-value ${deltaClass(report.compare.kpiDeltas.throughputRps.absoluteDelta, true)}`}
                  >
                    {deltaValue(report.compare.kpiDeltas.throughputRps.absoluteDelta, ' RPS')}
                  </p>
                  <p className="muted">
                    Throughput ({metricValue(report.compare.kpiDeltas.throughputRps.baseline)} to{' '}
                    {metricValue(report.compare.kpiDeltas.throughputRps.candidate)})
                  </p>
                </article>

                <article className="metric-card">
                  <p
                    className={`metric-value ${deltaClass(report.compare.kpiDeltas.p95LatencyMs.absoluteDelta, false)}`}
                  >
                    {deltaValue(report.compare.kpiDeltas.p95LatencyMs.absoluteDelta, ' ms')}
                  </p>
                  <p className="muted">
                    p95 Latency ({metricValue(report.compare.kpiDeltas.p95LatencyMs.baseline)} to{' '}
                    {metricValue(report.compare.kpiDeltas.p95LatencyMs.candidate)})
                  </p>
                </article>

                <article className="metric-card">
                  <p
                    className={`metric-value ${deltaClass(report.compare.kpiDeltas.errorRatePercent.absoluteDelta, false)}`}
                  >
                    {deltaValue(report.compare.kpiDeltas.errorRatePercent.absoluteDelta, '%')}
                  </p>
                  <p className="muted">
                    Error Rate ({metricValue(report.compare.kpiDeltas.errorRatePercent.baseline)}% to{' '}
                    {metricValue(report.compare.kpiDeltas.errorRatePercent.candidate)}%)
                  </p>
                </article>

                <article className="metric-card">
                  <p className={`metric-value ${deltaClass(report.compare.kpiDeltas.overallScore.absoluteDelta, true)}`}>
                    {deltaValue(report.compare.kpiDeltas.overallScore.absoluteDelta, ' pts')}
                  </p>
                  <p className="muted">
                    Overall Grade ({metricValue(report.compare.kpiDeltas.overallScore.baseline)} to{' '}
                    {metricValue(report.compare.kpiDeltas.overallScore.candidate)})
                  </p>
                </article>
              </div>
            </section>

            <section className="card">
              <h2>Highlights</h2>
              {report.summary.highlights.length === 0 ? <p className="muted">No highlights captured.</p> : null}
              {report.summary.highlights.map((entry, index) => (
                <p key={`highlight-${index}`} className="muted" style={{ margin: 0 }}>
                  + {entry}
                </p>
              ))}

              <h2 style={{ marginTop: '0.85rem' }}>Concerns</h2>
              {report.summary.concerns.length === 0 ? <p className="muted">No concerns captured.</p> : null}
              {report.summary.concerns.map((entry, index) => (
                <p key={`concern-${index}`} className="muted" style={{ margin: 0 }}>
                  - {entry}
                </p>
              ))}
            </section>

            <section className="card">
              <h2>Recommended Actions</h2>
              {report.summary.recommendedActions.length === 0 ? (
                <p className="muted">No actions generated.</p>
              ) : (
                <div className="list-grid">
                  {report.summary.recommendedActions.map((item, index) => (
                    <article className="action-item" key={`${item.priority}-${index}`}>
                      <div className="list-item-header">
                        <h3 style={{ marginBottom: 0 }}>{item.title}</h3>
                        <span className={priorityClass(item.priority)}>{item.priority}</span>
                      </div>
                      <p style={{ marginTop: '0.25rem' }}>{item.description}</p>
                      {item.evidence.length > 0 ? (
                        <p className="muted" style={{ marginTop: '0.2rem' }}>
                          Evidence: {item.evidence.join(' | ')}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <h2>Share Link</h2>
              {!exportRecord ? (
                <p className="muted">Export the report first to create a share link.</p>
              ) : (
                <>
                  <p className="muted">Export: {exportRecord.fileName}</p>
                  <p className="muted">Created: {new Date(exportRecord.createdAt).toLocaleString()}</p>
                  <div className="button-row">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void downloadAuthenticatedPdf(exportRecord.downloadPath, exportRecord.fileName)}
                    >
                      Download PDF
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={!exportRecord.shareUrl}
                      onClick={() => void copyShareLink()}
                    >
                      Copy Share URL
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={!exportRecord.shareToken || isRevoking}
                      onClick={() => void revokeShareLink()}
                    >
                      {isRevoking ? 'Revoking...' : 'Revoke Share Link'}
                    </button>
                  </div>
                  {exportRecord.shareUrl ? (
                    <p className="muted" style={{ marginTop: '0.45rem' }}>
                      Read-only URL: {siteOrigin}
                      {exportRecord.shareUrl}
                    </p>
                  ) : null}
                  {exportRecord.shareRevokedAt ? (
                    <p className="error">Share link revoked at {new Date(exportRecord.shareRevokedAt).toLocaleString()}.</p>
                  ) : null}
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
