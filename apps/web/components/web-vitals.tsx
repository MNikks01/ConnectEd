'use client';

/**
 * Core Web Vitals and uncaught errors, reported to `/api/rum` (S5-13).
 *
 * Batched and sent once, on the way out. Each vital arrives at a different moment — TTFB early,
 * LCP after the largest paint, CLS and INP only when the page is hidden — and a request per
 * metric would be five beacons per page load, which is itself a performance problem.
 *
 * `sendBeacon` rather than `fetch`, because the send has to survive the navigation that triggers
 * it. A `fetch` issued during `visibilitychange` is cancelled when the document goes away; a
 * beacon is handed to the browser to deliver afterwards.
 *
 * **The measurement must never cost more than it measures.** Everything here is wrapped so a
 * failure to report is silent, and nothing is retried.
 */
import { useEffect } from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

interface Vital {
  name: string;
  value: number;
  path: string;
}

export function WebVitals() {
  useEffect(() => {
    const vitals: Vital[] = [];
    const errors: { path: string; message: string }[] = [];

    function record(metric: Metric): void {
      vitals.push({
        name: metric.name,
        value: metric.value,
        // Read at the moment of measurement: by the time the beacon is sent the user may have
        // navigated, and a measurement attributed to the wrong page is worse than none.
        path: window.location.pathname,
      });
    }

    onCLS(record);
    onFCP(record);
    onINP(record);
    onLCP(record);
    onTTFB(record);

    function onError(event: ErrorEvent): void {
      // Capped so one broken page cannot fill a beacon with the same message a thousand times.
      if (errors.length >= 5) return;
      errors.push({
        path: window.location.pathname,
        message: String(event.message).slice(0, 500),
      });
    }

    window.addEventListener('error', onError);

    function flush(): void {
      if (vitals.length === 0 && errors.length === 0) return;

      const body = JSON.stringify({
        vitals: vitals.splice(0, 10),
        errors: errors.splice(0, 5),
      });

      try {
        navigator.sendBeacon('/api/rum', new Blob([body], { type: 'application/json' }));
      } catch {
        // A browser without sendBeacon, or one refusing the payload. Nothing to do about it, and
        // certainly nothing worth telling the user.
      }
    }

    // `visibilitychange` rather than `beforeunload`: the latter is unreliable on mobile, where a
    // page is often frozen and discarded without it ever firing.
    function onHidden(): void {
      if (document.visibilityState === 'hidden') flush();
    }

    document.addEventListener('visibilitychange', onHidden);

    return () => {
      window.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, []);

  return null;
}
