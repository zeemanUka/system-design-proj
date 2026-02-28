'use client';

import { CreateProjectResponse, Scenario } from '@sdc/shared-types';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

const DIFFICULTY_FILTERS = ['all', 'beginner', 'intermediate', 'advanced'] as const;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function difficultyClass(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes('beginner') || normalized.includes('easy')) {
    return 'beginner';
  }
  if (normalized.includes('intermediate') || normalized.includes('medium')) {
    return 'intermediate';
  }
  return 'advanced';
}

function domainIcon(domain: string): string {
  const normalized = normalize(domain);
  if (normalized.includes('chat') || normalized.includes('messaging')) {
    return 'MSG';
  }
  if (normalized.includes('video') || normalized.includes('stream')) {
    return 'VID';
  }
  if (normalized.includes('storage') || normalized.includes('blob')) {
    return 'STO';
  }
  if (normalized.includes('feed') || normalized.includes('social')) {
    return 'FEE';
  }
  if (normalized.includes('search')) {
    return 'SRH';
  }
  return 'SYS';
}

function practicePoints(scenario: Scenario): string[] {
  const normalized = normalize(`${scenario.domain} ${scenario.description}`);
  if (normalized.includes('chat') || normalized.includes('messaging')) {
    return ['Connection fan-out strategy', 'Message ordering and retries', 'Presence + read receipts'];
  }
  if (normalized.includes('feed') || normalized.includes('social')) {
    return ['Fan-out model choices', 'Cache invalidation paths', 'Hot-key mitigation'];
  }
  if (normalized.includes('storage')) {
    return ['Sharding strategy', 'Durability and replication', 'Metadata indexing'];
  }
  if (normalized.includes('search')) {
    return ['Index pipeline design', 'Query latency tradeoffs', 'Ranking and freshness'];
  }
  return ['Capacity planning', 'Failure isolation', 'Scalability tradeoffs'];
}

export default function ScenariosPage() {
  const router = useRouter();
  const [selectedDifficulty, setSelectedDifficulty] = useState<(typeof DIFFICULTY_FILTERS)[number]>('all');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxMinutes, setMaxMinutes] = useState(120);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/auth');
      return;
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/scenarios`, {
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
    })();
  }, [router]);

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

  const domains = useMemo(() => {
    const options = Array.from(new Set(scenarios.map((scenario) => scenario.domain))).sort();
    return ['all', ...options];
  }, [scenarios]);

  const filteredScenarios = useMemo(() => {
    const normalizedQuery = normalize(searchQuery);

    return scenarios.filter((scenario) => {
      const difficulty = normalize(scenario.difficulty);
      const domain = normalize(scenario.domain);
      const matchesDifficulty = selectedDifficulty === 'all' ? true : difficulty.includes(selectedDifficulty);
      const matchesDomain = selectedDomain === 'all' ? true : domain === normalize(selectedDomain);
      const matchesMinutes = scenario.estimatedMinutes <= maxMinutes;
      const matchesSearch =
        !normalizedQuery ||
        normalize(scenario.title).includes(normalizedQuery) ||
        normalize(scenario.description).includes(normalizedQuery) ||
        domain.includes(normalizedQuery);

      return matchesDifficulty && matchesDomain && matchesMinutes && matchesSearch;
    });
  }, [maxMinutes, scenarios, searchQuery, selectedDifficulty, selectedDomain]);

  return (
    <main>
      <div className="page-stack">
        <section className="card scenario-filter-shell">
          <p className="kicker">Scenario Picker</p>
          <h1>Choose your next system design challenge</h1>
          <p className="subtitle">Browse by domain, filter by difficulty, and launch a guided practice session.</p>

          <div className="filter-row" style={{ marginTop: '0.7rem' }}>
            {DIFFICULTY_FILTERS.map((difficulty) => (
              <button
                key={difficulty}
                className={`filter-chip ${selectedDifficulty === difficulty ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty(difficulty)}
                type="button"
              >
                {difficulty === 'all' ? 'All levels' : difficulty}
              </button>
            ))}
          </div>

          <div className="filter-row" style={{ marginTop: '0.5rem' }}>
            {domains.map((domain) => (
              <button
                key={domain}
                className={`filter-chip ${selectedDomain === domain ? 'active' : ''}`}
                onClick={() => setSelectedDomain(domain)}
                type="button"
              >
                {domain === 'all' ? 'All domains' : domain}
              </button>
            ))}
          </div>

          <div className="page-grid-two" style={{ marginTop: '0.8rem' }}>
            <label className="field" style={{ marginBottom: 0 }}>
              Search scenarios
              <input
                placeholder="Search title, domain, or keyword"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="slider-row" style={{ marginBottom: 0 }}>
              <label className="field" style={{ marginBottom: 0 }}>
                Max interview minutes
                <input
                  type="range"
                  min={20}
                  max={180}
                  step={5}
                  value={maxMinutes}
                  onChange={(event) => setMaxMinutes(Number(event.target.value))}
                />
              </label>
              <div className="slider-meta">
                <span>20 min</span>
                <strong>{maxMinutes} min</strong>
                <span>180 min</span>
              </div>
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card">
          <div className="split-row">
            <h2>Available Scenarios</h2>
            <span className="pill">{filteredScenarios.length} match(es)</span>
          </div>

          {isLoading ? <p className="muted">Loading scenarios...</p> : null}

          {!isLoading && filteredScenarios.length === 0 ? (
            <div className="empty-illustration">
              <div>
                <h3 style={{ marginBottom: '0.35rem' }}>No results for these filters</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Try a broader difficulty/domain mix or increase max interview minutes.
                </p>
              </div>
            </div>
          ) : null}

          <div className="list-grid">
            {filteredScenarios.map((scenario) => {
              const difficulty = difficultyClass(scenario.difficulty);
              const points = practicePoints(scenario);

              return (
                <article key={scenario.id} className="list-item scenario-card">
                  <div className="list-item-header">
                    <div>
                      <div className="button-row" style={{ marginBottom: '0.35rem' }}>
                        <span className={`badge-difficulty ${difficulty}`}>{scenario.difficulty}</span>
                        <span className="pill">{domainIcon(scenario.domain)}</span>
                        <span className="pill">~{scenario.estimatedMinutes} min</span>
                      </div>
                      <h3 style={{ marginBottom: '0.2rem' }}>{scenario.title}</h3>
                      <p className="muted" style={{ marginBottom: '0.2rem' }}>
                        Domain: {scenario.domain}
                      </p>
                    </div>
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
                  </div>

                  <p style={{ marginBottom: '0.35rem' }}>{scenario.description}</p>

                  <div className="preview">
                    <p className="kicker" style={{ marginBottom: '0.35rem' }}>
                      What you&apos;ll practice
                    </p>
                    {points.map((point) => (
                      <p key={point} className="muted" style={{ marginBottom: '0.15rem' }}>
                        - {point}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
