'use client';

import { AuthSuccessResponse } from '@sdc/shared-types';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';

type Mode = 'signup' | 'login';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = useMemo(() => (mode === 'signup' ? 'Create account' : 'Sign in'), [mode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const payload = (await response.json()) as Partial<AuthSuccessResponse> & { message?: string };
      if (!response.ok || !payload.token || !payload.user) {
        setError(payload.message || 'Authentication failed.');
        return;
      }

      setAuthToken(payload.token);

      if (payload.user.onboardingCompleted) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    } catch {
      setError('Unable to reach server. Check API connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <div className="auth-shell">
        <section className="card auth-brand">
          <div className="auth-brand-content">
            <div>
              <p className="kicker" style={{ color: '#9ae9d3' }}>
                System Design Coach
              </p>
              <h1>Train under realistic scale pressure.</h1>
              <p className="subtitle" style={{ color: '#c7d8de' }}>
                Build architecture, inject traffic and failures, and get AI-graded feedback before interviews.
              </p>
            </div>

            <div className="counter-grid">
              <article className="counter-card">
                <p className="counter-value">500+</p>
                <p className="muted" style={{ color: '#b7cad1' }}>
                  Practice runs scored
                </p>
              </article>
              <article className="counter-card">
                <p className="counter-value">50+</p>
                <p className="muted" style={{ color: '#b7cad1' }}>
                  Interview scenarios
                </p>
              </article>
              <article className="counter-card">
                <p className="counter-value">1-click</p>
                <p className="muted" style={{ color: '#b7cad1' }}>
                  Version branching
                </p>
              </article>
            </div>

            <div className="timeline-stepper">
              <article className="timeline-step">
                <span className="dot">1</span>
                <div className="copy" style={{ borderLeftColor: 'rgba(153, 220, 200, 0.35)' }}>
                  <h3 style={{ marginBottom: 0.15 }}>Pick challenge</h3>
                  <p className="muted" style={{ color: '#b7cad1', marginBottom: 0 }}>
                    Domain, difficulty, and time budget.
                  </p>
                </div>
              </article>
              <article className="timeline-step">
                <span className="dot">2</span>
                <div className="copy" style={{ borderLeftColor: 'rgba(153, 220, 200, 0.35)' }}>
                  <h3 style={{ marginBottom: 0.15 }}>Design and scale</h3>
                  <p className="muted" style={{ color: '#b7cad1', marginBottom: 0 }}>
                    Horizontal and vertical tuning in one canvas.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="card auth-form-card">
          <p className="kicker">Account Access</p>
          <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="subtitle">Switch between sign up and sign in without leaving this page.</p>

          <div className={`tab-toggle ${mode}`}>
            <span className="pill-bg" />
            <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => setMode('signup')}>
              Sign Up
            </button>
            <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
              Sign In
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ marginTop: '1rem' }}>
            <label className="floating-field field">
              <input
                required
                autoComplete="email"
                placeholder=" "
                type="email"
                value={email}
                className={error ? 'input-error' : ''}
                onChange={(event) => setEmail(event.target.value)}
              />
              <span>Email</span>
            </label>

            <label className="floating-field field">
              <input
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder=" "
                type="password"
                value={password}
                className={error ? 'input-error' : ''}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span>Password</span>
            </label>

            {error ? <p className="error error-shake">{error}</p> : null}

            <button className="button" disabled={isSubmitting} type="submit" style={{ marginTop: '0.35rem' }}>
              {isSubmitting ? (
                <>
                  <span className="loading-dot" />
                  Processing...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </form>

          <p className="muted" style={{ marginTop: '1rem', marginBottom: 0 }}>
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              className="button button-link"
              type="button"
              onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
            >
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
