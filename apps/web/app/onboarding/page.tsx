'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token';
import { parseCommaSeparated } from '@/lib/parse-list';

const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState('Software Engineer');
  const [targetCompanies, setTargetCompanies] = useState('Meta, Google');
  const [level, setLevel] = useState<(typeof LEVEL_OPTIONS)[number]>('intermediate');
  const [scenarioPreferences, setScenarioPreferences] = useState('feed, chat, storage');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAuthToken();

    if (!token) {
      router.replace('/auth');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role,
          targetCompanies: parseCommaSeparated(targetCompanies),
          level,
          scenarioPreferences: parseCommaSeparated(scenarioPreferences)
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Onboarding update failed.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Unable to reach server. Check API connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const parsedCompanies = useMemo(() => parseCommaSeparated(targetCompanies), [targetCompanies]);
  const parsedPreferences = useMemo(() => parseCommaSeparated(scenarioPreferences), [scenarioPreferences]);

  return (
    <main>
      <div className="page-grid-two">
        <section className="card">
          <p className="kicker">Onboarding</p>
          <h1>Set your interview targets</h1>
          <p className="subtitle">This profile tunes scenario recommendations and grading guidance to your goals.</p>

          <form onSubmit={onSubmit}>
            <label className="field">
              Current role
              <input value={role} onChange={(event) => setRole(event.target.value)} required />
            </label>

            <label className="field">
              Target companies (comma-separated)
              <input value={targetCompanies} onChange={(event) => setTargetCompanies(event.target.value)} required />
            </label>

            <div className="field">
              Experience level
              <div className="filter-row">
                {LEVEL_OPTIONS.map((value) => (
                  <button
                    className={`filter-chip ${level === value ? 'active' : ''}`}
                    key={value}
                    onClick={() => setLevel(value)}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              Preferred scenarios (comma-separated)
              <input value={scenarioPreferences} onChange={(event) => setScenarioPreferences(event.target.value)} required />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving...' : 'Continue to Dashboard'}
            </button>
          </form>
        </section>

        <section className="card">
          <p className="kicker">Profile Preview</p>
          <div className="list-grid">
            <div className="list-item">
              <p className="pill pill-accent">Role</p>
              <h3 style={{ marginTop: '0.35rem' }}>{role || 'Your role'}</h3>
            </div>

            <div className="list-item">
              <p className="pill pill-accent">Target Companies</p>
              {parsedCompanies.length === 0 ? <p className="muted">No companies set yet.</p> : null}
              {parsedCompanies.map((company) => (
                <p className="muted" key={company} style={{ marginBottom: '0.2rem' }}>
                  - {company}
                </p>
              ))}
            </div>

            <div className="list-item">
              <p className="pill pill-accent">Scenario Preferences</p>
              {parsedPreferences.length === 0 ? <p className="muted">No preferences set yet.</p> : null}
              {parsedPreferences.map((preference) => (
                <p className="muted" key={preference} style={{ marginBottom: '0.2rem' }}>
                  - {preference}
                </p>
              ))}
            </div>

            <div className="list-item">
              <p className="pill pill-accent">Level</p>
              <h3 style={{ marginTop: '0.35rem' }}>{level}</h3>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
