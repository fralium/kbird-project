const MAX_BUCKET_MINUTES = 360;

const overall = {
  total: 0,
  errors4xx: 0,
  errors5xx: 0,
};

const minuteBuckets = new Map();

const toMinuteKey = (timestampMs) => Math.floor(timestampMs / 60000) * 60000;

const isLikelyDynamicSegment = (segment = '') => {
  if (!segment) return false;
  if (/^[0-9a-f]{24}$/i.test(segment)) return true;
  if (/^[0-9]+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  return segment.length > 36;
};

const normalizePath = (urlPath = '') => {
  const pathOnly = String(urlPath || '').split('?')[0];
  const segments = pathOnly
    .split('/')
    .filter(Boolean)
    .map((segment) => (isLikelyDynamicSegment(segment) ? ':id' : segment));
  return `/${segments.join('/')}`;
};

const toApiGroup = (urlPath = '') => {
  const normalized = normalizePath(urlPath);
  if (!normalized.startsWith('/api/')) return normalized;

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) return '/api';
  if (parts.length === 2) return `/${parts[0]}/${parts[1]}`;

  if (parts[1] === 'users' && ['login', 'register'].includes(parts[2])) {
    return `/${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return `/${parts[0]}/${parts[1]}`;
};

const ensureBucket = (minuteKey) => {
  let bucket = minuteBuckets.get(minuteKey);
  if (!bucket) {
    bucket = {
      total: 0,
      errors4xx: 0,
      errors5xx: 0,
      groups: {},
    };
    minuteBuckets.set(minuteKey, bucket);
  }
  return bucket;
};

const cleanupOldBuckets = (nowMinuteKey) => {
  const minAllowed = nowMinuteKey - (MAX_BUCKET_MINUTES - 1) * 60000;
  for (const key of minuteBuckets.keys()) {
    if (key < minAllowed) {
      minuteBuckets.delete(key);
    }
  }
};

const updateCounters = (target, statusCode) => {
  target.total += 1;
  if (statusCode >= 400 && statusCode < 500) {
    target.errors4xx += 1;
  } else if (statusCode >= 500) {
    target.errors5xx += 1;
  }
};

const toErrorRate = (errors4xx, errors5xx, total) => {
  if (!total) return 0;
  return Number((((errors4xx + errors5xx) / total) * 100).toFixed(2));
};

const recordApiMetric = (req, statusCode) => {
  if (!req?.originalUrl || !String(req.originalUrl).startsWith('/api/')) {
    return;
  }

  const now = Date.now();
  const minuteKey = toMinuteKey(now);
  const groupKey = toApiGroup(req.originalUrl);

  updateCounters(overall, statusCode);

  cleanupOldBuckets(minuteKey);
  const bucket = ensureBucket(minuteKey);
  updateCounters(bucket, statusCode);

  if (!bucket.groups[groupKey]) {
    bucket.groups[groupKey] = { total: 0, errors4xx: 0, errors5xx: 0 };
  }
  updateCounters(bucket.groups[groupKey], statusCode);
};

const getApiErrorMetrics = (windowMinutes = 60) => {
  const minutes = Number.isFinite(Number(windowMinutes))
    ? Math.min(MAX_BUCKET_MINUTES, Math.max(5, Number(windowMinutes)))
    : 60;
  const nowMinute = toMinuteKey(Date.now());
  const startMinute = nowMinute - (minutes - 1) * 60000;

  const summary = { total: 0, errors4xx: 0, errors5xx: 0 };
  const groups = {};
  const timeline = [];

  for (let minute = startMinute; minute <= nowMinute; minute += 60000) {
    const bucket = minuteBuckets.get(minute) || {
      total: 0,
      errors4xx: 0,
      errors5xx: 0,
      groups: {},
    };
    summary.total += bucket.total;
    summary.errors4xx += bucket.errors4xx;
    summary.errors5xx += bucket.errors5xx;

    Object.entries(bucket.groups || {}).forEach(([group, data]) => {
      if (!groups[group]) groups[group] = { total: 0, errors4xx: 0, errors5xx: 0 };
      groups[group].total += data.total;
      groups[group].errors4xx += data.errors4xx;
      groups[group].errors5xx += data.errors5xx;
    });

    timeline.push({
      minute: new Date(minute).toISOString(),
      total: bucket.total,
      errors4xx: bucket.errors4xx,
      errors5xx: bucket.errors5xx,
      errorRate: toErrorRate(bucket.errors4xx, bucket.errors5xx, bucket.total),
    });
  }

  const groupRows = Object.entries(groups)
    .map(([group, data]) => ({
      group,
      total: data.total,
      errors4xx: data.errors4xx,
      errors5xx: data.errors5xx,
      errorRate: toErrorRate(data.errors4xx, data.errors5xx, data.total),
    }))
    .sort((a, b) => {
      if (b.errors5xx !== a.errors5xx) return b.errors5xx - a.errors5xx;
      if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
      return b.total - a.total;
    })
    .slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    windowMinutes: minutes,
    overall: {
      ...summary,
      errorRate: toErrorRate(summary.errors4xx, summary.errors5xx, summary.total),
    },
    groups: groupRows,
    timeline,
    lifetime: {
      ...overall,
      errorRate: toErrorRate(overall.errors4xx, overall.errors5xx, overall.total),
    },
  };
};

module.exports = {
  recordApiMetric,
  getApiErrorMetrics,
};
