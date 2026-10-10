const { devError } = require('../utils/devLogger');
const { sendControllerError } = require('../middleware/controllerError');

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const ipBuckets = new Map();

const getClientIp = (req) => {
  // 仅在显式开启 trust proxy 时信任 X-Forwarded-For，避免伪造绕过限流
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' || Number(process.env.TRUST_PROXY) > 0;
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const isRateLimited = (ip) => {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    ipBuckets.set(ip, { start: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  ipBuckets.set(ip, bucket);
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
};

const geocode = async (req, res) => {
  try {
    const keyword = (req.query.keyword || req.query.keyWord || '').trim();
    if (!keyword) {
      const error = new Error('请提供 keyword 参数');
      error.statusCode = 400;
      error.code = 'MISSING_KEYWORD';
      return sendControllerError(res, error, {
        defaultMessage: '请提供 keyword 参数',
        defaultCode: 'MISSING_KEYWORD',
        fallbackStatus: 400,
      });
    }
    if (keyword.length > 120) {
      const error = new Error('keyword 过长');
      error.statusCode = 400;
      error.code = 'INVALID_KEYWORD_LENGTH';
      return sendControllerError(res, error, {
        defaultMessage: 'keyword 过长',
        defaultCode: 'INVALID_KEYWORD_LENGTH',
        fallbackStatus: 400,
      });
    }

    // 仅使用服务端 Key，避免把浏览器公开 Key 当 Web 服务调用
    const tk = String(process.env.TIANDITU_SERVER_TK || '').trim();
    if (!tk) {
      const error = new Error('未配置天地图服务端 Key');
      error.statusCode = 503;
      error.code = 'TIANDITU_KEY_NOT_CONFIGURED';
      return sendControllerError(res, error, {
        defaultMessage: '未配置天地图服务端 Key',
        defaultCode: 'TIANDITU_KEY_NOT_CONFIGURED',
        fallbackStatus: 503,
      });
    }

    if (isRateLimited(getClientIp(req))) {
      const error = new Error('请求过于频繁，请稍后再试');
      error.statusCode = 429;
      error.code = 'RATE_LIMITED';
      return sendControllerError(res, error, {
        defaultMessage: '请求过于频繁，请稍后再试',
        defaultCode: 'RATE_LIMITED',
        fallbackStatus: 429,
      });
    }

    const ds = JSON.stringify({ keyWord: keyword });
    const url = `https://api.tianditu.gov.cn/geocoder?ds=${encodeURIComponent(ds)}&tk=${tk}`;
    const response = await fetch(url);
    const text = await response.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      const error = new Error('天地图返回了非JSON响应');
      error.statusCode = 502;
      error.code = 'UPSTREAM_INVALID_RESPONSE';
      return sendControllerError(res, error, {
        defaultMessage: '天地图返回了非JSON响应',
        defaultCode: 'UPSTREAM_INVALID_RESPONSE',
        fallbackStatus: 502,
      });
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    devError('天地图地理编码请求失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '地理编码请求失败',
      defaultCode: 'TIANDITU_GEOCODE_FAILED',
      fallbackStatus: 500,
    });
  }
};

module.exports = {
  geocode,
};
