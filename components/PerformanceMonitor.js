import { useCallback, useEffect, useRef } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

const WEB_VITALS_ENDPOINT = '/api/observability/web-vitals';
const ENABLE_WEB_VITALS =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

function sendMetric(metricPayload) {
  const body = JSON.stringify(metricPayload);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(WEB_VITALS_ENDPOINT, blob);
    return;
  }

  fetch(WEB_VITALS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // 忽略上报失败，避免影响用户交互
  });
}

function isBenignWebVitalsNoise(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes("reading 'startTime'") ||
    message.includes('reading "startTime"') ||
    (message.includes('startTime') && message.includes('undefined'))
  );
}

/** 仅生产环境挂载，避免开发态 web-vitals 在布局抖动时抛 startTime */
function WebVitalsReporter() {
  const sentMetricsRef = useRef(new Set());

  const reportMetric = useCallback((metric) => {
    try {
      if (!metric?.name || typeof window === 'undefined') return;

      const key = `${metric.name}:${metric.id}:${metric.value}`;
      if (sentMetricsRef.current.has(key)) return;
      sentMetricsRef.current.add(key);

      sendMetric({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
        path: window.location.pathname,
        ts: Date.now(),
      });
    } catch {
      // 指标上报绝不能打断主流程
    }
  }, []);

  useReportWebVitals(reportMetric);
  return null;
}

const PerformanceMonitor = ({ children }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onError = (event) => {
      if (isBenignWebVitalsNoise(event?.error || event?.message)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    };
    const onRejection = (event) => {
      if (isBenignWebVitalsNoise(event?.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return (
    <>
      {ENABLE_WEB_VITALS ? <WebVitalsReporter /> : null}
      {children}
    </>
  );
};

export default PerformanceMonitor;
