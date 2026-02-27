'use client';

import { GradeReport, GradeReportResponse } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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

export default function GradeReportPage() {
  const router = useRouter();
  const params = useParams<{ gradeId: string }>();
  const gradeId = params.gradeId;

  const [report, setReport] = useState<GradeReport | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

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
          <p className="subtitle">Deterministic rubric scoring with evidence-grounded AI coaching output.</p>
          {report ? (
            <div className="button-row">
              <span className={`pill ${report.status === 'completed' ? 'pill-accent' : ''}`}>{statusLabel(report.status)}</span>
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
            <p className="muted">Loading report...</p>
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
            <section className="card">
              <h2>Summary</h2>
              <p>{report.summary || 'No AI summary available.'}</p>
              <p className="muted" style={{ marginTop: '0.4rem' }}>
                Provider: {report.aiProvider || 'unknown'} • Model: {report.aiModel || 'unknown'}
              </p>
            </section>

            <section className="card">
              <h2>Rubric Breakdown</h2>
              <div className="list-grid">
                {report.categoryScores.map((category) => (
                  <article className="list-item" key={category.category}>
                    <div className="list-item-header">
                      <h3 style={{ marginBottom: 0 }}>{category.category}</h3>
                      <span className="pill">
                        {category.score}/{category.maxScore} • weight {category.weight}%
                      </span>
                    </div>
                    <p className="muted" style={{ marginTop: '0.25rem' }}>
                      {category.rationale}
                    </p>
                    {category.evidence.length > 0 ? (
                      <div className="list-grid" style={{ marginTop: '0.45rem' }}>
                        {category.evidence.map((entry, index) => (
                          <p className="muted" key={`${category.category}-${index}`} style={{ margin: 0 }}>
                            • {entry}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Prioritized Actions</h2>
              {report.actionItems.length === 0 ? <p className="muted">No action items were generated.</p> : null}
              <div className="list-grid">
                {report.actionItems.map((item, index) => (
                  <article className="list-item" key={`${item.priority}-${index}`}>
                    <div className="list-item-header">
                      <h3 style={{ marginBottom: 0 }}>{item.title}</h3>
                      <span className="pill">{item.priority}</span>
                    </div>
                    <p style={{ marginTop: '0.25rem' }}>{item.description}</p>
                    {item.evidence.length > 0 ? (
                      <p className="muted" style={{ marginTop: '0.25rem' }}>
                        Evidence: {item.evidence.join(' | ')}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Strengths and Risks</h2>
              <div className="page-grid-two">
                <div className="list-item">
                  <h3>Strengths</h3>
                  {report.strengths.length === 0 ? <p className="muted">No strengths recorded.</p> : null}
                  {report.strengths.map((entry, index) => (
                    <p key={`strength-${index}`} className="muted" style={{ margin: 0 }}>
                      • {entry}
                    </p>
                  ))}
                </div>
                <div className="list-item">
                  <h3>Risks</h3>
                  {report.risks.length === 0 ? <p className="muted">No risks recorded.</p> : null}
                  {report.risks.map((entry, index) => (
                    <p key={`risk-${index}`} className="muted" style={{ margin: 0 }}>
                      • {entry}
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
