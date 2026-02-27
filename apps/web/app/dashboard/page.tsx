'use client';

import { ProjectSummary, UserProfile } from '@sdc/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    void (async () => {
      try {
        const [profileResponse, projectsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/users/me`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }),
          fetch(`${API_BASE_URL}/projects?limit=10`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ]);

        if (!profileResponse.ok || !projectsResponse.ok) {
          if (profileResponse.status === 401 || projectsResponse.status === 401) {
            clearAuthToken();
            router.replace('/auth');
            return;
          }

          setError('Unable to load dashboard data.');
          return;
        }

        const profileData = (await profileResponse.json()) as UserProfile;
        const projectsData = (await projectsResponse.json()) as ProjectSummary[];

        setProfile(profileData);
        setProjects(projectsData);
      } catch {
        setError('Unable to reach server.');
      }
    })();
  }, [router]);

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p className="kicker">Dashboard</p>
          <div className="split-row">
            <div>
              <h1>Welcome to your design workspace</h1>
              <p className="subtitle">Track attempts, branch versions, and keep iterating quickly.</p>
            </div>
            <div className="button-row">
              <button className="button" type="button" onClick={() => router.push('/scenarios')}>
                New Attempt
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

          {error ? <p className="error">{error}</p> : null}

          {profile ? (
            <div className="button-row" style={{ marginTop: '0.45rem' }}>
              <span className="pill">Signed in: {profile.email}</span>
              <span className={`pill ${profile.onboardingCompleted ? 'pill-accent' : ''}`}>
                Onboarding: {profile.onboardingCompleted ? 'Complete' : 'Pending'}
              </span>
            </div>
          ) : (
            <p className="muted">Loading profile...</p>
          )}
        </section>

        <section className="card">
          <div className="split-row">
            <div>
              <p className="kicker">Recent Projects</p>
              <h2>Continue previous attempts</h2>
            </div>
            <Link href="/scenarios">Start another scenario</Link>
          </div>

          {projects.length === 0 ? (
            <p className="muted">
              No projects yet. <Link href="/scenarios">Start your first scenario</Link>.
            </p>
          ) : (
            <div className="list-grid">
              {projects.map((project) => (
                <article key={project.id} className="list-item">
                  <div className="list-item-header">
                    <div>
                      <h3 style={{ marginBottom: 0 }}>{project.title}</h3>
                      <p className="muted" style={{ marginTop: '0.3rem' }}>
                        {project.scenarioTitle} • {project.scenarioDifficulty} • {project.scenarioDomain}
                      </p>
                    </div>
                    <Link href={`/projects/${project.id}`}>View History</Link>
                  </div>
                  <p className="muted" style={{ marginTop: '0.45rem' }}>
                    Versions: {project.versionCount} • Latest: v{project.latestVersionNumber}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
