import jwt from 'jsonwebtoken';

const METRICS_LIMIT = 300;

const vitalsStore = globalThis.__kbirdWebVitalsStore || {
  metrics: [],
};

if (!globalThis.__kbirdWebVitalsStore) {
  globalThis.__kbirdWebVitalsStore = vitalsStore;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim()) return String(secret).trim();
  throw new Error('JWT_SECRET_NOT_CONFIGURED');
}

function requireAdmin(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (!decoded?.id) throw new Error('UNAUTHORIZED');
  // role 仅用于读端；写入仍允许匿名 POST 但做体积限制
  return decoded;
}

export default function handler(req, res) {
  if (req.method === 'POST') {
    const metric = req.body || {};
    if (!metric?.name || typeof metric?.value !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Invalid web vitals payload',
        code: 'WEB_VITALS_INVALID_PAYLOAD',
      });
    }

    // 只保留白名单字段，避免任意对象灌入
    vitalsStore.metrics.push({
      name: String(metric.name).slice(0, 64),
      value: Number(metric.value),
      id: metric.id ? String(metric.id).slice(0, 128) : undefined,
      path: metric.path ? String(metric.path).slice(0, 256) : undefined,
      receivedAt: Date.now(),
    });

    if (vitalsStore.metrics.length > METRICS_LIMIT) {
      vitalsStore.metrics.splice(0, vitalsStore.metrics.length - METRICS_LIMIT);
    }

    return res.status(202).json({ success: true });
  }

  if (req.method === 'GET') {
    try {
      requireAdmin(req);
    } catch {
      return res.status(401).json({
        success: false,
        message: '未授权访问',
        code: 'UNAUTHORIZED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        count: vitalsStore.metrics.length,
        latest: vitalsStore.metrics.slice(-50),
      },
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED',
  });
}
