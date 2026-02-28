'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token';

type MetricName = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP' | 'route-change';
type MetricRating = 'good' | 'needs-improvement' | 'poor';

const BUDGETS: Record<MetricName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  FCP: { good: 1800, poor: 3000 },
  'route-change': { good: 700, poor: 1200 }
};

function classifyMetric(name: MetricName, value: number): MetricRating {
  const budget = BUDGETS[name];
  if (value <= budget.good) {
    return 'good';
  }
  if (value <= budget.poor) {
    return 'needs-improvement';
  }
  return 'poor';
}

async function sendFrontendMetric(name: MetricName, value: number, path: string, navigationType?: string) {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  const rating = classifyMetric(name, value);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  try {
    await apiFetch(`${API_BASE_URL}/observability/frontend-metrics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        metric: {
          name,
          value,
          path,
          rating,
          navigationType
        }
      }),
      keepalive: true
    });
  } catch {
    // Frontend telemetry should never block user flows.
  }

  if (rating !== 'good') {
    // Surface budget drift during development and QA runs.
    console.warn(`[perf] ${name} on ${path}: ${value.toFixed(2)} (${rating})`);
  }
}

export function PerformanceMonitor() {
  const pathname = usePathname();
  const routeStartRef = useRef<number>(typeof performance === 'undefined' ? 0 : performance.now());
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      return;
    }

    const elapsedMs = performance.now() - routeStartRef.current;
    void sendFrontendMetric('route-change', elapsedMs, pathname, 'route-transition');

    previousPathRef.current = pathname;
    routeStartRef.current = performance.now();
  }, [pathname]);

  useEffect(() => {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigationEntry?.responseStart) {
      void sendFrontendMetric('TTFB', navigationEntry.responseStart, pathname, navigationEntry.type);
    }

    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    if (firstContentfulPaint) {
      void sendFrontendMetric('FCP', firstContentfulPaint.startTime, pathname, 'paint');
    }

    let clsTotal = 0;
    let lcpValue = 0;
    let inpValue = 0;

    let clsObserver: PerformanceObserver | null = null;
    let lcpObserver: PerformanceObserver | null = null;
    let inpObserver: PerformanceObserver | null = null;

    try {
      clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (layoutShift.hadRecentInput) {
            continue;
          }
          clsTotal += layoutShift.value ?? 0;
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      clsObserver = null;
    }

    try {
      lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          lcpValue = last.startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      lcpObserver = null;
    }

    try {
      inpObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const eventEntry = entry as PerformanceEntry & {
            duration?: number;
            interactionId?: number;
          };
          if (!eventEntry.interactionId) {
            continue;
          }
          inpValue = Math.max(inpValue, eventEntry.duration ?? 0);
        }
      });
      inpObserver.observe({ type: 'event', buffered: true });
    } catch {
      inpObserver = null;
    }

    const flushMetrics = () => {
      if (lcpValue > 0) {
        void sendFrontendMetric('LCP', lcpValue, pathname, 'web-vital');
      }
      if (clsTotal > 0) {
        void sendFrontendMetric('CLS', clsTotal, pathname, 'web-vital');
      }
      if (inpValue > 0) {
        void sendFrontendMetric('INP', inpValue, pathname, 'web-vital');
      }
    };

    window.addEventListener('pagehide', flushMetrics);

    return () => {
      flushMetrics();
      window.removeEventListener('pagehide', flushMetrics);
      clsObserver?.disconnect();
      lcpObserver?.disconnect();
      inpObserver?.disconnect();
    };
  }, [pathname]);

  return null;
}
