'use client';

import { GradeReport, GradeReportResponse } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

type LoadState = 'loading' | 'ready' | 'error';

function statusLabel(status: GradeReport['status']): string {
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

function scoreColor(score: number): string {
  if (score >= 80) {
    return '#1ea77f';
  }
  if (score >= 60) {
    return '#d18d39';
  }
  return '#cf5353';
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

export default function GradeReportPage() {
  const router = useRouter();
  const params = useParams<{ gradeId: string }>();
  const gradeId = params.gradeId;

  const [report, setReport] = useState<GradeReport | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});
  const [isCreatingFixVersion, setIsCreatingFixVersion] = useState(false);

  const isTerminal = useMemo(() => {
    return report?.status === 'completed' || report?.status === 'failed';
  }, [report?.status]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    let active = true;

    async function fetchReport() {
      try {
        const response = await fetch(`${API_BASE_URL}/grades/${gradeId}`, {
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
          setError('Unable to load grade report.');
          return;
        }

        const payload = (await response.json()) as GradeReportResponse;
        if (!active) {
          return;
        }

        setReport(payload.report);
        setLoadState('ready');
        setError(null);
      } catch {
        if (!active) {
          return;
        }
        setLoadState('error');
        setError('Unable to reach server.');
      }
    }

    void fetchReport();
    const timer = setInterval(() => {
      if (!isTerminal) {
        void fetchReport();
      }
    }, 1500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [gradeId, isTerminal, router]);

  async function createFixVersionAndRegrade() {
    if (!report) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsCreatingFixVersion(true);
    setError(null);

    try {
      const versionResponse = await fetch(`${API_BASE_URL}/projects/${report.projectId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          parentVersionId: report.versionId,
          notes: `Fix version created from grade ${gradeId}`
        })
      });

      if (!versionResponse.ok) {
        const payload = (await versionResponse.json()) as { message?: string };
        setError(payload.message || 'Unable to create fix version.');
        return;
      }

      const newVersion = (await versionResponse.json()) as { id: string };
      router.push(`/projects/${report.projectId}/versions/${newVersion.id}`);
    } catch {
      setError('Unable to create fix version.');
    } finally {
      setIsCreatingFixVersion(false);
    }
  }

  const overallScore = report?.overallScore ?? 0;
  const ringFill = `${Math.max(0, Math.min(100, overallScore))}%`;
  const ringColor = scoreColor(overallScore);
  const ringStyle = {
    '--ring-fill': ringFill,
    '--ring-color': ringColor
  } as CSSProperties;

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            {report ? (
              <Link href={`/projects/${report.projectId}/versions/${report.versionId}`}>Back to Workspace</Link>
            ) : (
              <Link href="/dashboard">Back to Dashboard</Link>
            )}
          </p>
          <p className="kicker">AI Grading Report</p>
          <h1>Grade {gradeId}</h1>
          <p className="subtitle">Deterministic rubric scoring with evidence-grounded coaching recommendations.</p>
          {report ? (
            <div className="button-row">
              <span className={`pill ${report.status === 'completed' ? 'pill-accent' : 'pill-warning'}`}>
                {statusLabel(report.status)}
              </span>
              {report.overallScore !== null ? <span className="pill">Score: {report.overallScore}/100</span> : null}
              <Link className="button button-secondary" href={`/projects/${report.projectId}/compare`}>
                Compare Attempts
              </Link>
              <Link className="button button-secondary" href={`/projects/${report.projectId}/report`}>
                Final Report
              </Link>
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          {report && !isTerminal ? (
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Grading is running. This page auto-refreshes.
            </p>
          ) : null}
        </section>

        {loadState === 'loading' ? (
          <section className="card">
            <div className="button-row">
              <span className="loading-dot" />
              <strong>Loading report...</strong>
            </div>
          </section>
        ) : null}

        {report?.status === 'failed' ? (
          <section className="card">
            <h2>Grading Failed</h2>
            <p className="error">{report.failureReason || 'Grade worker failed unexpectedly.'}</p>
          </section>
        ) : null}

        {report?.status === 'completed' ? (
          <>
            <section className="card grade-hero">
              <div className="score-ring" style={ringStyle}>
                <div className="score-ring-inner">
                  <p className="metric-value" style={{ marginBottom: '0.1rem' }}>
                    {overallScore}%
                  </p>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Overall
                  </p>
                </div>
              </div>

              <div>
                <h2>{report.summary || 'Report summary unavailable.'}</h2>
                <p className="muted" style={{ marginBottom: '0.55rem' }}>
                  Provider: {report.aiProvider || 'unknown'} • Model: {report.aiModel || 'unknown'}
                </p>
                <button className="button" disabled={isCreatingFixVersion} type="button" onClick={() => void createFixVersionAndRegrade()}>
                  {isCreatingFixVersion ? 'Preparing Fix Version...' : 'Create Fix Version & Regrade'}
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Category Breakdown</h2>
              <div className="category-list">
                {report.categoryScores.map((category) => {
                  const ratio = category.maxScore > 0 ? (category.score / category.maxScore) * 100 : 0;
                  const key = category.category;

                  return (
                    <article className="category-row" key={key}>
                      <div className="list-item-header">
                        <div>
                          <h3 style={{ marginBottom: 0 }}>{category.category}</h3>
                          <p className="muted" style={{ marginBottom: 0, marginTop: '0.2rem' }}>
                            Weight {category.weight}% • {category.score}/{category.maxScore}
                          </p>
                        </div>
                        <button
                          className="action-expand"
                          type="button"
                          onClick={() => setExpandedCategories((current) => ({ ...current, [key]: !current[key] }))}
                        >
                          Explain This
                        </button>
                      </div>
                      <div className="category-track">
                        <div className="category-fill" style={{ width: `${Math.max(4, Math.min(100, ratio))}%` }} />
                      </div>
                      {expandedCategories[key] ? (
                        <div className="action-detail">
                          <p style={{ marginBottom: '0.25rem' }}>{category.rationale}</p>
                          {category.evidence.length > 0 ? (
                            <>
                              {category.evidence.map((entry, index) => (
                                <p className="muted" key={`${key}-${index}`} style={{ marginBottom: '0.15rem' }}>
                                  - {entry}
                                </p>
                              ))}
                            </>
                          ) : (
                            <p className="muted" style={{ marginBottom: 0 }}>
                              No explicit evidence listed.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2>Prioritized Actions</h2>
              {report.actionItems.length === 0 ? <p className="muted">No action items were generated.</p> : null}
              <div className="list-grid">
                {report.actionItems.map((item, index) => {
                  const key = `${item.priority}-${index}`;

                  return (
                    <article className="action-item" key={key}>
                      <div className="list-item-header">
                        <h3 style={{ marginBottom: 0 }}>{item.title}</h3>
                        <span className={priorityClass(item.priority)}>{item.priority}</span>
                      </div>
                      <p style={{ marginBottom: '0.3rem', marginTop: '0.25rem' }}>{item.description}</p>
                      <button
                        className="action-expand"
                        type="button"
                        onClick={() => setExpandedActions((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        Explain This
                      </button>
                      {expandedActions[key] ? (
                        <div className="action-detail">
                          {item.evidence.length > 0 ? (
                            item.evidence.map((evidence, evidenceIndex) => (
                              <p className="muted" key={`${key}-${evidenceIndex}`} style={{ marginBottom: '0.15rem' }}>
                                - {evidence}
                              </p>
                            ))
                          ) : (
                            <p className="muted" style={{ marginBottom: 0 }}>
                              No evidence linked for this action item.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2>Strengths and Risks</h2>
              <div className="page-grid-two">
                <div className="list-item strength-card">
                  <h3>Strengths</h3>
                  {report.strengths.length === 0 ? <p className="muted">No strengths recorded.</p> : null}
                  {report.strengths.map((entry, index) => (
                    <p key={`strength-${index}`} className="muted" style={{ marginBottom: '0.2rem' }}>
                      + {entry}
                    </p>
                  ))}
                </div>
                <div className="list-item risk-card">
                  <h3>Risks</h3>
                  {report.risks.length === 0 ? <p className="muted">No risks recorded.</p> : null}
                  {report.risks.map((entry, index) => (
                    <p key={`risk-${index}`} className="muted" style={{ marginBottom: '0.2rem' }}>
                      - {entry}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
