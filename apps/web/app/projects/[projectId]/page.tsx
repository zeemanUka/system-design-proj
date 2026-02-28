'use client';

import { ProjectHistoryResponse } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

export default function ProjectHistoryPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [history, setHistory] = useState<ProjectHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/history`, {
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

          setError('Unable to load project history.');
          return;
        }

        const data = (await response.json()) as ProjectHistoryResponse;
        setHistory(data);
      } catch {
        setError('Unable to reach server.');
      }
    })();
  }, [projectId, router]);

  async function createNewVersion() {
    if (!history) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsCreatingVersion(true);
    setError(null);

    try {
      const latestVersion = history.versions[0] ?? null;
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          parentVersionId: latestVersion?.id,
          notes: 'New iteration from history screen'
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        setError('Unable to create a new version.');
        return;
      }

      const created = (await response.json()) as { id: string };
      router.push(`/projects/${projectId}/versions/${created.id}`);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsCreatingVersion(false);
    }
  }

  const latestVersion = useMemo(() => history?.versions[0] ?? null, [history]);

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href="/dashboard">Back to dashboard</Link>
          </p>
          {error ? <p className="error">{error}</p> : null}

          {!history ? (
            <div className="button-row">
              <span className="loading-dot" />
              <p className="muted" style={{ marginBottom: 0 }}>
                Loading project history...
              </p>
            </div>
          ) : (
            <>
              <p className="kicker">Project History</p>
              <h1>{history.project.title}</h1>
              <p className="subtitle">
                {history.project.scenarioTitle} • {history.project.scenarioDifficulty} • {history.project.scenarioDomain}
              </p>

              <div className="button-row" style={{ marginTop: '0.25rem' }}>
                <span className="pill">Versions: {history.project.versionCount}</span>
                {latestVersion ? <span className="pill">Latest: v{latestVersion.versionNumber}</span> : null}
                <button className="button" type="button" disabled={isCreatingVersion} onClick={() => void createNewVersion()}>
                  {isCreatingVersion ? 'Creating...' : 'Create New Version'}
                </button>
                <Link className="button button-secondary" href={`/projects/${projectId}/compare`}>
                  Compare Attempts
                </Link>
                <Link className="button button-secondary" href={`/projects/${projectId}/report`}>
                  Final Report
                </Link>
              </div>
            </>
          )}
        </section>

        {history ? (
          <section className="card">
            <h2>Version Timeline</h2>
            <div className="timeline-stepper">
              {history.versions.map((version, index) => (
                <article className="timeline-step" key={version.id}>
                  <span className="dot">{version.versionNumber}</span>
                  <div className="copy">
                    <div className="list-item-header">
                      <div>
                        <h3 style={{ marginBottom: 0 }}>Version {version.versionNumber}</h3>
                        <p className="muted" style={{ marginTop: '0.2rem', marginBottom: '0.25rem' }}>
                          Parent: {version.parentVersionId ?? 'none'}
                        </p>
                      </div>
                      <span className={`pill ${index === 0 ? 'pill-accent' : ''}`}>{index === 0 ? 'latest' : 'history'}</span>
                    </div>
                    <p className="muted" style={{ marginBottom: '0.3rem' }}>
                      Notes: {version.notes ?? 'No notes'}
                    </p>
                    <div className="button-row">
                      <Link className="button button-secondary" href={`/projects/${projectId}/versions/${version.id}`}>
                        Open Workspace
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
