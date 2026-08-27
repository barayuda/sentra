import { onCLS, onINP, onLCP } from 'web-vitals'
import type { AnalyticsClient } from './events.ts'

/** The subset of a web-vitals Metric this package reports. */
export interface VitalMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

/**
 * The reporter functions, injectable so tests supply fakes instead of
 * module mocks. Defaults to the real web-vitals callbacks.
 */
export interface VitalsReporters {
  onLCP: (callback: (metric: VitalMetric) => void) => void
  onINP: (callback: (metric: VitalMetric) => void) => void
  onCLS: (callback: (metric: VitalMetric) => void) => void
}

/**
 * Reports Core Web Vitals (LCP, INP, CLS) as `web_vital` analytics events —
 * one pipeline for behaviour and performance (spec §5.3). Requires a
 * `web_vital: ['metric', 'value', 'rating']` schema entry.
 */
export function captureWebVitals(
  client: AnalyticsClient,
  reporters: VitalsReporters = { onLCP, onINP, onCLS },
): void {
  const report = (metric: VitalMetric): void => {
    client.track('web_vital', { metric: metric.name, value: metric.value, rating: metric.rating })
  }
  reporters.onLCP(report)
  reporters.onINP(report)
  reporters.onCLS(report)
}
