'use client';

import { ProjectSummary, SharedProjectSummary, SharedProjectsResponse, UserProfile } from '@sdc/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

function toDisplayName(email: string): string {
  const head = email.split('@')[0] || 'Engineer';
  return head
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function useAnimatedValue(target: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const frames = 28;
    const timer = window.setInterval(() => {
      frame += 1;
      const next = Math.round((target * frame) / frames);
      setValue(next >= target ? target : next);
      if (frame >= frames) {
        window.clearInterval(timer);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [target]);

  return value;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sharedProjects, setSharedProjects] = useState<SharedProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    void (async () => {
      try {
        const [profileResponse, projectsResponse, sharedProjectsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/users/me`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }),
          fetch(`${API_BASE_URL}/projects?limit=10`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }),
          fetch(`${API_BASE_URL}/projects/shared?limit=10`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ]);

        if (!profileResponse.ok || !projectsResponse.ok || !sharedProjectsResponse.ok) {
          if (
            profileResponse.status === 401 ||
            projectsResponse.status === 401 ||
            sharedProjectsResponse.status === 401
          ) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }

          setError('Unable to load dashboard data.');
          return;
        }

        const profileData = (await profileResponse.json()) as UserProfile;
        const projectsData = (await projectsResponse.json()) as ProjectSummary[];
        const sharedProjectsData = (await sharedProjectsResponse.json()) as SharedProjectsResponse;

        setProfile(profileData);
        setProjects(projectsData);
        setSharedProjects(sharedProjectsData.projects);
      } catch {
        setError('Unable to reach server.');
      }
    })();
  }, [router]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [projects]);
  const sortedSharedProjects = useMemo(() => {
    return [...sharedProjects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [sharedProjects]);

  const totalAttempts = useMemo(() => projects.reduce((sum, project) => sum + project.versionCount, 0), [projects]);
  const averageVersions = projects.length > 0 ? Math.round(totalAttempts / projects.length) : 0;
  const bestIterationDepth = useMemo(
    () => projects.reduce((max, project) => Math.max(max, project.versionCount), 0),
    [projects]
  );
  const currentStreak = Math.min(7, projects.length);

  const animatedTotalAttempts = useAnimatedValue(totalAttempts);
  const animatedAverageVersions = useAnimatedValue(averageVersions);
  const animatedBestIterationDepth = useAnimatedValue(bestIterationDepth);
  const animatedStreak = useAnimatedValue(currentStreak);

  const trendSeries = useMemo(() => {
    if (sortedProjects.length === 0) {
      return [52, 56, 60, 63, 68, 70];
    }

    const ascending = [...sortedProjects].reverse();
    return ascending.map((project, index) => Math.min(98, 52 + project.versionCount * 6 + index * 2));
  }, [sortedProjects]);

  const trendPoints = useMemo(() => {
    return trendSeries.map((point, index) => `${index * 70},${180 - point * 1.3}`).join(' ');
  }, [trendSeries]);

  const trendAreaPoints = useMemo(() => {
    if (trendPoints.length === 0) {
      return '0,180';
    }
    const lastX = (trendSeries.length - 1) * 70;
    return `0,180 ${trendPoints} ${lastX},180`;
  }, [trendPoints, trendSeries.length]);

  const heatmap = useMemo(() => {
    const cells = Array.from({ length: 56 }, (_, index) => {
      const project = sortedProjects[index % Math.max(sortedProjects.length, 1)];
      const seed = project ? project.versionCount + project.title.length : index + 3;
      return (seed + index) % 4;
    });
    return cells;
  }, [sortedProjects]);

  const latestProject = sortedProjects[0] ?? null;
  const bestProject = useMemo(() => {
    if (sortedProjects.length === 0) {
      return null;
    }
    return [...sortedProjects].sort((a, b) => b.versionCount - a.versionCount)[0] ?? null;
  }, [sortedProjects]);

  const greetingName = profile ? toDisplayName(profile.email) : 'Engineer';

  return (
    <main>
      <div className="page-stack">
        <section className="card reveal visible">
          <div className="split-row">
            <div>
              <p className="kicker">Dashboard</p>
              <h1>Welcome back, {greetingName}.</h1>
              <p className="subtitle">Your architecture practice is compounding. Start a new session or keep iterating.</p>
            </div>
            <div className="button-row">
              <button className="button" type="button" onClick={() => router.push('/scenarios')}>
                New Practice Session
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  clearAuthToken();
                  router.push('/auth');
                }}
              >
                Sign out
              </button>
            </div>
          </div>

          {profile ? (
            <div className="button-row" style={{ marginTop: '0.65rem' }}>
              <span className="pill">Signed in: {profile.email}</span>
              <span className={`pill ${profile.onboardingCompleted ? 'pill-accent' : 'pill-warning'}`}>
                Onboarding: {profile.onboardingCompleted ? 'Complete' : 'Pending'}
              </span>
            </div>
          ) : (
            <p className="muted">Loading profile...</p>
          )}
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="dashboard-grid">
          <article className="card">
            <div className="split-row">
              <div>
                <p className="kicker">Score Trend</p>
                <h2>Practice trajectory</h2>
              </div>
              <span className="pill">Auto-updates</span>
            </div>

            <div className="chart-shell">
              <svg className="sparkline" viewBox="0 0 420 180" preserveAspectRatio="none" role="img" aria-label="score trend">
                <polyline className="area" points={trendAreaPoints} />
                <polyline className="main" points={trendPoints} />
                {trendSeries.map((point, index) => (
                  <circle key={`${point}-${index}`} cx={index * 70} cy={180 - point * 1.3} r="4" />
                ))}
              </svg>
            </div>

            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Based on recent iteration depth and scenario completion cadence.
            </p>
          </article>

          <aside className="card">
            <p className="kicker">Quick Actions</p>
            <div className="quick-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={!latestProject}
                onClick={() => latestProject && router.push(`/projects/${latestProject.id}`)}
              >
                Resume Last Session
              </button>
              <button className="button button-secondary" type="button" onClick={() => router.push('/scenarios')}>
                Try Random Scenario
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={!bestProject}
                onClick={() => bestProject && router.push(`/projects/${bestProject.id}`)}
              >
                Review Best Attempt
              </button>
            </div>

            <hr />

            <p className="kicker">Activity Heatmap</p>
            <div className="heatmap-grid" aria-label="weekly activity heatmap">
              {heatmap.map((level, index) => (
                <span key={index} className={`heat-cell ${level > 0 ? `level-${level}` : ''}`} />
              ))}
            </div>
          </aside>
        </section>

        <section className="card">
          <p className="kicker">Stats</p>
          <div className="metric-grid">
            <article className="metric-card">
              <p className="metric-value">{animatedTotalAttempts}</p>
              <p className="muted">Total Attempts</p>
            </article>
            <article className="metric-card">
              <p className="metric-value">{animatedAverageVersions}</p>
              <p className="muted">Average Versions / Project</p>
            </article>
            <article className="metric-card">
              <p className="metric-value">{animatedBestIterationDepth}</p>
              <p className="muted">Best Iteration Depth</p>
            </article>
            <article className="metric-card">
              <p className="metric-value">{animatedStreak}</p>
              <p className="muted">Current Streak (days)</p>
            </article>
          </div>
        </section>

        <section className="card">
          <div className="split-row">
            <div>
              <p className="kicker">Recent Projects</p>
              <h2>Continue previous attempts</h2>
            </div>
            <Link href="/scenarios">Start another scenario</Link>
          </div>

          {sortedProjects.length === 0 ? (
            <div className="empty-illustration">
              <div>
                <h3 style={{ marginBottom: '0.4rem' }}>No attempts yet</h3>
                <p className="muted" style={{ marginBottom: '0.7rem' }}>
                  Start your first system design practice and build your learning curve.
                </p>
                <Link className="button" href="/scenarios">
                  Start First Session
                </Link>
              </div>
            </div>
          ) : (
            <div className="list-grid">
              {sortedProjects.map((project, index) => {
                const status = project.versionCount >= 3 ? 'graded' : project.versionCount > 1 ? 'in-progress' : 'draft';
                const statusClass = status === 'graded' ? 'pill-accent' : status === 'in-progress' ? 'pill-warning' : '';

                return (
                  <article key={project.id} className="list-item" style={{ animationDelay: `${index * 65}ms` }}>
                    <div className="list-item-header">
                      <div>
                        <h3 style={{ marginBottom: 0 }}>{project.title}</h3>
                        <p className="muted" style={{ marginTop: '0.25rem', marginBottom: 0 }}>
                          {project.scenarioTitle} • {project.scenarioDifficulty} • {project.scenarioDomain}
                        </p>
                      </div>
                      <span className={`pill ${statusClass}`}>{status}</span>
                    </div>
                    <p className="muted" style={{ marginTop: '0.45rem', marginBottom: '0.65rem' }}>
                      Versions: {project.versionCount} • Latest: v{project.latestVersionNumber} • Updated{' '}
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                    <div className="button-row">
                      <Link className="button button-secondary" href={`/projects/${project.id}`}>
                        Open History
                      </Link>
                      <Link className="button button-secondary" href={`/projects/${project.id}/compare`}>
                        Compare
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="split-row">
            <div>
              <p className="kicker">Shared With You</p>
              <h2>Collaborative projects</h2>
            </div>
            <span className="pill">{sortedSharedProjects.length} shared</span>
          </div>

          {sortedSharedProjects.length === 0 ? (
            <p className="muted">No shared projects yet. Ask a teammate to invite you by email.</p>
          ) : (
            <div className="list-grid">
              {sortedSharedProjects.map((project, index) => (
                <article key={project.id} className="list-item" style={{ animationDelay: `${index * 65}ms` }}>
                  <div className="list-item-header">
                    <div>
                      <h3 style={{ marginBottom: 0 }}>{project.title}</h3>
                      <p className="muted" style={{ marginTop: '0.25rem', marginBottom: 0 }}>
                        Owner: {project.ownerEmail}
                      </p>
                    </div>
                    <span className={`pill ${project.accessRole === 'editor' ? 'pill-warning' : ''}`}>
                      {project.accessRole}
                    </span>
                  </div>
                  <p className="muted" style={{ marginTop: '0.45rem', marginBottom: '0.65rem' }}>
                    {project.scenarioTitle} • v{project.latestVersionNumber} • Pending invites: {project.pendingInviteCount}
                  </p>
                  <div className="button-row">
                    <Link className="button button-secondary" href={`/projects/${project.id}`}>
                      Open Shared Project
                    </Link>
                    <Link className="button button-secondary" href={`/projects/${project.id}/compare`}>
                      Compare
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
