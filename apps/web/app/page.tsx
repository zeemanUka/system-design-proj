import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <div className="page-stack">
        <section className="card hero-card">
          <div className="landing-hero-grid">
            <div>
              <p className="kicker">System Design Coach</p>
              <h1 className="hero-title">Practice architecture decisions before interview day.</h1>
              <p className="hero-copy">
                Build systems, scale them horizontally and vertically, run stress assumptions, and get actionable
                feedback on what breaks first and how to fix it.
              </p>
              <div className="button-row">
                <Link className="button" href="/auth">
                  Start Practicing
                </Link>
                <Link className="button button-secondary" href="/auth">
                  View Product Walkthrough
                </Link>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <p className="kicker">Why Teams Use It</p>
              <div className="metric-grid">
                <div className="metric-card">
                  <p className="metric-value">10+</p>
                  <p className="muted">Architecture components in palette</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">4</p>
                  <p className="muted">Traffic presets to model different demand profiles</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">1 click</p>
                  <p className="muted">Versioning to branch and iterate safely</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">Live</p>
                  <p className="muted">Validation warnings for risky topology choices</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <p className="kicker">What You Can Do</p>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>Interactive Workspace</h3>
              <p className="muted">
                Model architecture nodes, create edges, and tune component capacity with autosave per version.
              </p>
            </article>
            <article className="feature-card">
              <h3>Traffic Modeling</h3>
              <p className="muted">
                Configure baseline RPS, peak multipliers, read/write mix, and regional traffic distribution.
              </p>
            </article>
            <article className="feature-card">
              <h3>Structured Feedback</h3>
              <p className="muted">
                Identify SPOFs and disconnected paths now, then layer simulation and AI grading in later stages.
              </p>
            </article>
          </div>
        </section>

        <section className="card">
          <p className="kicker">How It Works</p>
          <div className="timeline">
            <div className="timeline-item">
              <h3>1. Pick A Scenario</h3>
              <p className="muted">Choose by domain, difficulty, and interview time budget.</p>
            </div>
            <div className="timeline-item">
              <h3>2. Design + Scale</h3>
              <p className="muted">Add components, connect data flow, and tune replicas or machine tiers.</p>
            </div>
            <div className="timeline-item">
              <h3>3. Evaluate + Iterate</h3>
              <p className="muted">Use validation and traffic assumptions to improve each version quickly.</p>
            </div>
          </div>
          <div className="button-row" style={{ marginTop: '1rem' }}>
            <Link className="button" href="/auth">
              Create Account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
