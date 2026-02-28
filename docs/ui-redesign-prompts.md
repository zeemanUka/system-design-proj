# UI Redesign Prompts

Use these prompts to modernize and make each page more interactive. Paste them into a conversation along with the relevant file paths.

---

## 1. Landing Page

**Files:** `apps/web/app/page.tsx`, `apps/web/app/globals.css`

> Redesign the landing page at `apps/web/app/page.tsx` and its CSS in `globals.css` to feel premium, modern, and interactive. Keep the existing content structure (hero, metrics, features, how-it-works) but apply the following enhancements:
> 1. **Animated hero section** — Add a subtle animated gradient background or floating geometric shapes (SVG or CSS) behind the hero text to create visual depth and movement.
> 2. **Staggered entrance animations** — Each section and card should fade-in and slide-up with staggered delays as the user scrolls down (use CSS `@keyframes` + `animation-delay` or Intersection Observer).
> 3. **Glassmorphism cards** — Make the feature cards and metric cards use frosted-glass styling with `backdrop-filter: blur()`, semi-transparent backgrounds, and soft glowing borders on hover.
> 4. **Hover micro-interactions** — Feature cards should lift with a shadow increase and subtle border glow on hover. Buttons should have a slight scale-up and glow effect.
> 5. **Modern typography hierarchy** — Make the hero title use a large gradient text effect (e.g., green-to-teal gradient on the text itself via `background-clip: text`).
> 6. **Sticky navigation bar** — Add a minimal top nav bar with the logo, "Features", "How It Works" anchor links, and a "Get Started" CTA button. The nav should have a frosted-glass blur effect and become visible on scroll.
> 7. **Animated "How It Works" timeline** — Replace the static timeline with a vertical stepper that animates in progressively, with numbered circles, connecting lines, and icons.
> 8. **Social proof / trust section** — Add a section with animated counters (e.g., "500+ designs graded", "50+ scenarios") that count up when scrolled into view.
> 9. **Footer** — Add a clean, minimal footer with links, copyright, and subtle branding.
> 10. **Dark mode support** — Add a dark mode toggle and corresponding CSS custom properties for a dark theme.

---

## 2. Dashboard

**Files:** `apps/web/app/dashboard/page.tsx`, `apps/web/app/globals.css`

> Redesign the dashboard page at `apps/web/app/dashboard/page.tsx` to feel like a premium analytics dashboard. Apply these enhancements:
> 1. **Welcome header** — Show a personalized greeting with the user's name, a motivational subtitle, and a prominent "New Practice Session" CTA button.
> 2. **Score trend chart** — Add an animated line/area chart (using CSS or a lightweight library like Chart.js) showing the user's grading score progression across attempts.
> 3. **Stat cards with animations** — Show key stats (total attempts, average score, best score, current streak) in cards with animated number counters and subtle gradient backgrounds or glowing accent borders.
> 4. **Recent projects list** — Display recent projects as interactive cards with hover lift effects, showing scenario name, last score, version count, and a colored status pill (in-progress, graded, etc.).
> 5. **Activity heatmap or calendar** — Add a GitHub-style contribution heatmap or weekly activity summary to gamify consistency.
> 6. **Quick actions panel** — Add a sidebar or card with quick-action buttons: "Resume Last Session", "Try Random Scenario", "Review Best Attempt".
> 7. **Empty state** — If no projects exist, show an illustrated empty state with a compelling CTA to start their first practice session.
> 8. **Smooth page transitions** — Use staggered card entrance animations so the dashboard feels alive when loading.

---

## 3. Design Workspace

**Files:** `apps/web/app/projects/[projectId]/versions/[versionId]/page.tsx`, `apps/web/app/globals.css`

> Enhance the design workspace page at `apps/web/app/projects/[projectId]/versions/[versionId]/page.tsx` to feel like a professional design tool (inspired by Figma/Excalidraw aesthetics). Apply these:
> 1. **Polished canvas** — Add a subtle dot-grid or cross-hatch pattern to the canvas background. Use smooth zoom/pan indicators.
> 2. **Animated component palette** — Palette items should have icons, hover tooltips, and a subtle bounce animation when dragged onto the canvas.
> 3. **Node hover effects** — Architecture nodes should glow with a soft accent-colored shadow on hover and show a subtle pulse animation when first placed.
> 4. **Animated edge connections** — Data flow edges should use animated dashed lines (CSS `stroke-dashoffset` animation) to simulate data flowing between components.
> 5. **Scaling controls** — The horizontal/vertical scaling controls should use sleek sliders or +/- steppers with smooth CSS transitions showing the replica count change in real-time.
> 6. **Toolbar** — Add a floating toolbar at the top or bottom of the canvas with undo, redo, zoom controls, and a minimap toggle.
> 7. **Validation warnings** — Show warnings as animated toast-style notifications or inline badges on nodes with a pulsing attention indicator.

---

## 4. Simulation Results

**Files:** `apps/web/app/runs/[runId]/page.tsx`, `apps/web/app/globals.css`

> Redesign the simulation results page at `apps/web/app/runs/[runId]/page.tsx` to feel like a real-time monitoring dashboard. Apply these:
> 1. **Animated KPI cards** — Show throughput, latency (p50/p95), error rate, and saturation as large metric cards with animated number counters and colored status indicators (green/yellow/red).
> 2. **Bottleneck visualization** — Display bottlenecks as a ranked list with horizontal bar charts showing saturation percentage, with bars that animate to their final width.
> 3. **Failure timeline** — Build an animated vertical timeline showing events in chronological order, with icons indicating event type (warning, failure, recovery) and color-coded severity.
> 4. **Progress states** — Show a sleek loading animation (skeleton screens or a pulsing progress bar) while the simulation is running, with a live status indicator.
> 5. **Interactive architecture overlay** — Show a mini version of the architecture diagram with components color-coded by their saturation level (green → yellow → red).

---

## 5. AI Grading Report

**Files:** `apps/web/app/grades/[gradeId]/page.tsx`, `apps/web/app/globals.css`

> Redesign the AI grading report page at `apps/web/app/grades/[gradeId]/page.tsx` to feel like a premium coaching report. Apply these:
> 1. **Overall score hero** — Show the total score as a large animated circular progress ring (donut chart) with the percentage in the center, color-coded (green/yellow/red).
> 2. **Category breakdown** — Display each rubric category as a horizontal progress bar with animated fill, the category name, weight, and score.
> 3. **Strengths and risks** — Use green-bordered cards for strengths and red/orange-bordered cards for risks, each with an icon and concise explanation.
> 4. **P0/P1/P2 action items** — Display prioritized fixes as a styled checklist with severity badges (P0 = red, P1 = orange, P2 = yellow) and expandable detail sections.
> 5. **"Explain This" interaction** — Add expandable accordion sections within each feedback item where the AI explanation can be revealed with a smooth slide-down animation.
> 6. **Action CTA** — A prominent "Create Fix Version & Regrade" button at the bottom with a glowing hover effect.

---

## 6. Failure Injection Lab

**Files:** `apps/web/app/runs/[runId]/failure-injection/page.tsx`, `apps/web/app/globals.css`

> Redesign the failure injection lab at `apps/web/app/runs/[runId]/failure-injection/page.tsx` to feel like a war-room control panel. Apply these:
> 1. **Failure mode selector** — Show failure modes (node down, AZ down, network lag, traffic surge) as large, clickable cards with icons and descriptions, with a dramatic red/orange glow when selected.
> 2. **Before/after comparison** — Use a side-by-side or toggle-based comparison layout showing baseline vs. degraded metrics with animated delta indicators (arrows up/down with color).
> 3. **Blast radius visualization** — Show affected components highlighted in red on a mini architecture diagram, with a pulsing animation indicating impact severity.
> 4. **Dark/dramatic theme** — Use a slightly darker color palette for this page to reinforce the "danger zone" feeling, with red and orange accent colors.

---

## 7. Version Compare

**Files:** `apps/web/app/projects/[projectId]/compare/page.tsx`, `apps/web/app/globals.css`

> Redesign the version compare page at `apps/web/app/projects/[projectId]/compare/page.tsx` to clearly show improvement across attempts. Apply these:
> 1. **Side-by-side layout** — Show two versions side by side with their architecture diagrams, KPIs, and rubric scores.
> 2. **Delta indicators** — Show improvement/regression as colored arrows with percentage change (green ↑ for improvement, red ↓ for regression).
> 3. **Animated transitions** — When switching between version pairs, use smooth crossfade animations.
> 4. **Score progression chart** — Add a small sparkline or bar chart showing score evolution across all versions.

---

## 8. Auth Page

**Files:** `apps/web/app/auth/page.tsx`, `apps/web/app/globals.css`

> Redesign the auth page at `apps/web/app/auth/page.tsx` to feel welcoming and premium. Apply these:
> 1. **Split layout** — Left side shows a visually striking branded panel with the product tagline, a subtle animated background (gradient mesh or floating shapes), and social proof stats. Right side has the clean auth form.
> 2. **Smooth tab switch** — Sign In / Sign Up toggle should use a sliding pill indicator with smooth transitions between forms.
> 3. **Input focus effects** — Inputs should have animated floating labels plus a glowing accent border on focus.
> 4. **Button loading state** — Submit button shows an inline spinner and disables during submission.
> 5. **Error animations** — Validation errors should slide in with a shake animation on the affected field.

---

## 9. Scenario Picker

**Files:** `apps/web/app/scenarios/page.tsx`, `apps/web/app/globals.css`

> Redesign the scenario picker at `apps/web/app/scenarios/page.tsx` to feel like browsing a curated course catalog. Apply these:
> 1. **Scenario cards** — Each scenario is a large card with a colored difficulty badge (Easy = green, Medium = yellow, Hard = red), domain icon, title, description, and estimated time.
> 2. **Filter bar** — A sticky filter bar with pill-style toggles for difficulty and domain category, with smooth filter animations (cards fade/slide in/out).
> 3. **Hover preview** — On hover, cards expand slightly to reveal a brief "what you'll practice" bullet list.
> 4. **Search** — Add a search input with instant filtering and a subtle empty-state message.

---

## 10. Traffic Profile

**Files:** `apps/web/app/projects/[projectId]/versions/[versionId]/traffic/page.tsx`, `apps/web/app/globals.css`

> Redesign the traffic profile page at `apps/web/app/projects/[projectId]/versions/[versionId]/traffic/page.tsx` to feel intuitive and data-rich. Apply these:
> 1. **Preset cards** — Show traffic presets (social media, e-commerce, messaging, gaming) as visually distinct cards with icons and key stats, with a glowing border when selected.
> 2. **Live preview** — As the user adjusts RPS, peak multiplier, and read/write ratio, show an animated mini-chart that updates in real-time to visualize the traffic shape.
> 3. **Slider inputs** — Use styled range sliders with value tooltips for numeric inputs instead of plain text fields.
> 4. **Summary card** — A sticky summary panel showing the computed total requests, estimated data throughput, and peak load.
