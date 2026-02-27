'use client';

import { ProjectHistoryResponse } from '@sdc/shared-types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p style={{ marginTop: 0 }}>
            <Link href="/dashboard">Back to dashboard</Link>
          </p>
          {error ? <p className="error">{error}</p> : null}

          {!history ? (
            <p className="muted">Loading project history...</p>
          ) : (
            <>
              <p className="kicker">Project History</p>
              <h1>{history.project.title}</h1>
              <p className="subtitle">
                {history.project.scenarioTitle} • {history.project.scenarioDifficulty} • {history.project.scenarioDomain}
              </p>

              <div className="button-row" style={{ marginTop: '0.2rem' }}>
                <span className="pill">Versions: {history.project.versionCount}</span>
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
            <div className="list-grid">
              {history.versions.map((version) => (
                <article key={version.id} className="list-item">
                  <div className="list-item-header">
                    <div>
                      <h3 style={{ marginBottom: 0 }}>Version {version.versionNumber}</h3>
                      <p className="muted" style={{ marginTop: '0.3rem' }}>
                        Parent: {version.parentVersionId ?? 'none'}
                      </p>
                    </div>
                    <Link href={`/projects/${projectId}/versions/${version.id}`}>Open Workspace</Link>
                  </div>
                  <p className="muted" style={{ marginTop: '0.45rem' }}>
                    Notes: {version.notes ?? 'No notes'}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
