'use client';

import { ProjectHistoryResponse, ProjectMembersResponse } from '@sdc/shared-types';
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
  const [collaboration, setCollaboration] = useState<ProjectMembersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    void (async () => {
      try {
        const [historyResponse, membersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/projects/${projectId}/history`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }),
          fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ]);

        if (!historyResponse.ok) {
          if (historyResponse.status === 401) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }

          setError('Unable to load project history.');
          return;
        }

        if (membersResponse.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const data = (await historyResponse.json()) as ProjectHistoryResponse;
        setHistory(data);
        if (membersResponse.ok) {
          const membersPayload = (await membersResponse.json()) as ProjectMembersResponse;
          setCollaboration(membersPayload);
        }
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

  async function refreshCollaborators() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ProjectMembersResponse;
    setCollaboration(payload);
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setError('Invite email is required.');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsInviting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          role: inviteRole
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to create invite.');
        return;
      }

      setInviteEmail('');
      await refreshCollaborators();
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsInviting(false);
    }
  }

  async function updateMemberRole(memberId: string, role: 'editor' | 'viewer') {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to update member role.');
        return;
      }

      await refreshCollaborators();
    } catch {
      setError('Unable to reach server.');
    }
  }

  async function removeMember(memberId: string) {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to remove member.');
        return;
      }

      await refreshCollaborators();
    } catch {
      setError('Unable to reach server.');
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

        {history ? (
          <section className="card">
            <div className="split-row">
              <div>
                <p className="kicker">Collaboration</p>
                <h2>Members and invites</h2>
              </div>
              <span className="pill">{collaboration ? collaboration.members.length + 1 : 1} collaborators</span>
            </div>

            {collaboration ? (
              <>
                <div className="list-grid">
                  <article className="list-item">
                    <div className="split-row">
                      <strong>{collaboration.owner.email}</strong>
                      <span className="pill pill-accent">owner</span>
                    </div>
                  </article>

                  {collaboration.members.map((member) => (
                    <article key={member.id} className="list-item">
                      <div className="split-row">
                        <strong>{member.email}</strong>
                        <span className={`pill ${member.role === 'editor' ? 'pill-warning' : ''}`}>{member.role}</span>
                      </div>
                      <div className="button-row" style={{ marginTop: '0.5rem' }}>
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => void updateMemberRole(member.id, member.role === 'editor' ? 'viewer' : 'editor')}
                        >
                          Make {member.role === 'editor' ? 'Viewer' : 'Editor'}
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => void removeMember(member.id)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <hr />

                <h3>Invite collaborator</h3>
                <div className="page-grid-two">
                  <label className="field">
                    Email
                    <input
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    Role
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value === 'viewer' ? 'viewer' : 'editor')}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                </div>
                <button className="button" type="button" disabled={isInviting} onClick={() => void sendInvite()}>
                  {isInviting ? 'Sending...' : 'Send Invite'}
                </button>

                <h3 style={{ marginTop: '1rem' }}>Pending invites</h3>
                {collaboration.invites.length === 0 ? <p className="muted">No pending invites.</p> : null}
                <div className="list-grid">
                  {collaboration.invites.map((invite) => (
                    <article key={invite.id} className="list-item">
                      <div className="split-row">
                        <strong>{invite.email}</strong>
                        <span className="pill">{invite.role}</span>
                      </div>
                      <p className="muted" style={{ marginBottom: 0 }}>
                        Invite token: {invite.token}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">Loading collaborator list...</p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
