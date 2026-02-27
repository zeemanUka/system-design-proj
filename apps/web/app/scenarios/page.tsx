'use client';

import { CreateProjectResponse, Scenario } from '@sdc/shared-types';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

export default function ScenariosPage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState('');
  const [domain, setDomain] = useState('');
  const [maxMinutes, setMaxMinutes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null);

  const filterQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (difficulty) {
      query.set('difficulty', difficulty);
    }
    if (domain) {
      query.set('domain', domain);
    }
    if (maxMinutes) {
      query.set('maxMinutes', maxMinutes);
    }
    return query.toString();
  }, [difficulty, domain, maxMinutes]);

  async function loadScenarios() {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/scenarios${filterQuery ? `?${filterQuery}` : ''}`, {
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

        setError('Unable to load scenarios.');
        return;
      }

      const data = (await response.json()) as Scenario[];
      setScenarios(data);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadScenarios();
  }, []);

  async function onApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadScenarios();
  }

  async function startScenario(scenarioId: string) {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setStartingScenarioId(scenarioId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ scenarioId })
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthToken();
          router.replace('/auth');
          return;
        }

        const payload = (await response.json()) as { message?: string };
        setError(payload.message || 'Unable to start scenario.');
        return;
      }

      const created = (await response.json()) as CreateProjectResponse;
      router.push(`/projects/${created.project.id}/versions/${created.initialVersion.id}`);
    } catch {
      setError('Unable to reach server.');
    } finally {
      setStartingScenarioId(null);
    }
  }

  return (
    <main>
      <div className="page-stack">
        <section className="card">
          <p className="kicker">Scenario Picker</p>
          <h1>Choose your next system design challenge</h1>
          <p className="subtitle">Filter by scope and interview constraints, then start with one click.</p>

          <form onSubmit={onApplyFilters}>
            <div className="page-grid-three">
              <label className="field">
                Difficulty
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                  <option value="">All</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>

              <label className="field">
                Domain
                <input
                  placeholder="feed, chat, storage"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                />
              </label>

              <label className="field">
                Max Minutes
                <input
                  type="number"
                  min={1}
                  value={maxMinutes}
                  onChange={(event) => setMaxMinutes(event.target.value)}
                  placeholder="60"
                />
              </label>
            </div>

            <div className="button-row">
              <button className="button" type="submit">
                Apply Filters
              </button>
            </div>
          </form>

          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card">
          <h2>Available Scenarios</h2>
          {isLoading ? <p className="muted">Loading scenarios...</p> : null}

          {!isLoading && scenarios.length === 0 ? (
            <p className="muted">No scenarios match your current filters.</p>
          ) : null}

          <div className="list-grid">
            {scenarios.map((scenario) => (
              <article key={scenario.id} className="list-item">
                <h3>{scenario.title}</h3>
                <p className="muted">
                  {scenario.difficulty} • {scenario.domain} • ~{scenario.estimatedMinutes} min
                </p>
                <p>{scenario.description}</p>
                <button
                  className="button"
                  type="button"
                  disabled={startingScenarioId === scenario.id}
                  onClick={() => {
                    void startScenario(scenario.id);
                  }}
                >
                  {startingScenarioId === scenario.id ? 'Starting...' : 'Start Scenario'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
