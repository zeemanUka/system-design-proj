'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token';
import { parseCommaSeparated } from '@/lib/parse-list';

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState('Software Engineer');
  const [targetCompanies, setTargetCompanies] = useState('Meta, Google');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
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

  return (
    <main>
      <div className="page-grid-two">
        <section className="card">
          <p className="kicker">Onboarding</p>
          <h1>Set your interview targets</h1>
          <p className="subtitle">This profile personalizes your scenario feed and evaluation path.</p>

          <form onSubmit={onSubmit}>
            <label className="field">
              Current role
              <input value={role} onChange={(event) => setRole(event.target.value)} required />
            </label>

            <label className="field">
              Target companies (comma-separated)
              <input
                value={targetCompanies}
                onChange={(event) => setTargetCompanies(event.target.value)}
                required
              />
            </label>

            <label className="field">
              Experience level
              <select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="field">
              Preferred scenarios (comma-separated)
              <input
                value={scenarioPreferences}
                onChange={(event) => setScenarioPreferences(event.target.value)}
                required
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving...' : 'Continue to dashboard'}
            </button>
          </form>
        </section>

        <section className="card">
          <p className="kicker">Profile Preview</p>
          <div className="list-grid">
            <div className="list-item">
              <p className="pill pill-accent">Role</p>
              <h3 style={{ marginTop: '0.4rem' }}>{role || 'Your role'}</h3>
            </div>
            <div className="list-item">
              <p className="pill pill-accent">Target Companies</p>
              <p className="muted" style={{ marginTop: '0.45rem' }}>
                {targetCompanies || 'Set your targets'}
              </p>
            </div>
            <div className="list-item">
              <p className="pill pill-accent">Scenario Preferences</p>
              <p className="muted" style={{ marginTop: '0.45rem' }}>
                {scenarioPreferences || 'Add preferred domains'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
