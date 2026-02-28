'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CounterTarget = {
  label: string;
  suffix: string;
  value: number;
};

const COUNTERS: CounterTarget[] = [
  { label: 'Designs graded', suffix: '+', value: 500 },
  { label: 'Scenario prompts', suffix: '+', value: 50 },
  { label: 'Teams iterating weekly', suffix: '+', value: 120 }
];

function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    let frame = 0;
    const frames = 40;
    const timer = window.setInterval(() => {
      frame += 1;
      const next = Math.round((target * frame) / frames);
      setValue(next >= target ? target : next);
      if (frame >= frames) {
        window.clearInterval(timer);
      }
    }, 22);

    return () => window.clearInterval(timer);
  }, [active, target]);

  return value;
}

export default function HomePage() {
  const [showNav, setShowNav] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [trustVisible, setTrustVisible] = useState(false);

  const counterA = useCountUp(COUNTERS[0].value, trustVisible);
  const counterB = useCountUp(COUNTERS[1].value, trustVisible);
  const counterC = useCountUp(COUNTERS[2].value, trustVisible);

  const counters = useMemo(
    () => [
      { ...COUNTERS[0], current: counterA },
      { ...COUNTERS[1], current: counterB },
      { ...COUNTERS[2], current: counterC }
    ],
    [counterA, counterB, counterC]
  );

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('sdc-theme');
    if (storedTheme === 'dark') {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const onScroll = () => {
      setShowNav(window.scrollY > 26);
    };

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll<HTMLElement>('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        }
      },
      { threshold: 0.15 }
    );

    reveals.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const trust = document.getElementById('trust-section');
    if (!trust) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setTrustVisible(true);
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(trust);
    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    window.localStorage.setItem('sdc-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  return (
    <main>
      <nav className={`landing-nav ${showNav ? 'visible' : ''}`}>
        <span className="nav-brand">System Design Coach</span>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#trust-section">Trust</a>
          <Link href="/status">Status</Link>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <Link className="button" href="/auth">
            Get Started
          </Link>
        </div>
      </nav>

      <div className="page-stack">
        <section className="card hero-card reveal visible">
          <div className="landing-hero-grid">
            <div className="hero-animated-bg">
              <span className="hero-blob a" />
              <span className="hero-blob b" />
            </div>

            <div className="hero-content">
              <p className="kicker">System Design Coach</p>
              <h1 className="hero-title hero-title-gradient">Practice architecture decisions before interview day.</h1>
              <p className="hero-copy">
                Build systems, scale them horizontally and vertically, stress assumptions, and get fast guidance on
                what breaks first and how to fix it.
              </p>
              <div className="button-row">
                <Link className="button" href="/auth">
                  Start Practicing
                </Link>
                <a className="button button-secondary" href="#how-it-works">
                  View Walkthrough
                </a>
              </div>
            </div>

            <aside className="card" style={{ margin: 0 }}>
              <p className="kicker">Practice Snapshot</p>
              <div className="metric-grid">
                <div className="metric-card">
                  <p className="metric-value">10+</p>
                  <p className="muted">Architecture component types</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">4</p>
                  <p className="muted">Traffic presets for load modeling</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">1-click</p>
                  <p className="muted">Version branching and compare</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">Live</p>
                  <p className="muted">Topology warnings while you design</p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="card reveal delay-1" id="features">
          <p className="kicker">What You Can Do</p>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>Interactive Workspace</h3>
              <p className="muted">Drag components, connect edges, and autosave every architecture version.</p>
            </article>
            <article className="feature-card">
              <h3>Traffic Modeling</h3>
              <p className="muted">Tune baseline RPS, peak multipliers, read/write ratio, and region traffic split.</p>
            </article>
            <article className="feature-card">
              <h3>AI Feedback Loop</h3>
              <p className="muted">Run simulations, identify bottlenecks, then get prioritized grading actions.</p>
            </article>
          </div>
        </section>

        <section className="card reveal delay-2" id="how-it-works">
          <p className="kicker">How It Works</p>
          <div className="timeline-stepper">
            <article className="timeline-step">
              <span className="dot">1</span>
              <div className="copy">
                <h3>Pick A Scenario</h3>
                <p className="muted">Choose by domain, difficulty, and time budget.</p>
              </div>
            </article>
            <article className="timeline-step">
              <span className="dot">2</span>
              <div className="copy">
                <h3>Design + Scale</h3>
                <p className="muted">Model nodes and tune horizontal replicas and vertical tiers.</p>
              </div>
            </article>
            <article className="timeline-step">
              <span className="dot">3</span>
              <div className="copy">
                <h3>Simulate + Improve</h3>
                <p className="muted">Inspect bottlenecks and iterate quickly with AI coaching.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="card reveal delay-3" id="trust-section">
          <p className="kicker">Trusted Practice Loop</p>
          <div className="counter-grid">
            {counters.map((counter) => (
              <article className="counter-card" key={counter.label}>
                <p className="counter-value">
                  {counter.current}
                  {counter.suffix}
                </p>
                <p className="muted">{counter.label}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer-shell reveal">
          <p className="muted" style={{ margin: 0 }}>
            {new Date().getFullYear()} System Design Coach
          </p>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <Link href="/status">Status</Link>
            <Link href="/auth">Get Started</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
