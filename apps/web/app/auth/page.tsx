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

  const submitLabel = useMemo(() => {
    return mode === 'signup' ? 'Create account' : 'Sign in';
  }, [mode]);

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
      <div className="page-grid-two">
        <section className="card">
          <p className="kicker">Account Access</p>
          <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="subtitle">Use one flow for sign up and sign in so you can start practicing quickly.</p>

          <form onSubmit={onSubmit}>
            <label className="field">
              Email
              <input
                required
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="field">
              Password
              <input
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <div className="button-row">
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Submitting...' : submitLabel}
              </button>
            </div>
          </form>

          <p className="muted" style={{ marginTop: '1rem' }}>
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

        <section className="card">
          <p className="kicker">What Happens Next</p>
          <div className="timeline">
            <div className="timeline-item">
              <h3>Complete Onboarding</h3>
              <p className="muted">Set your level, role, and scenario preferences.</p>
            </div>
            <div className="timeline-item">
              <h3>Pick A Scenario</h3>
              <p className="muted">Start from a prompt that matches your interview target.</p>
            </div>
            <div className="timeline-item">
              <h3>Design Iteratively</h3>
              <p className="muted">Create versions, tune traffic assumptions, and improve with each attempt.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
