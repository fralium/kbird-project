/**
 * 天地图地理编码代理（地名 → 坐标）
 * 需登录；仅使用 TIANDITU_SERVER_TK。
 */
import jwt from 'jsonwebtoken';
import { devError } from '../../../utils/devLogger';
import { parseProxyJsonResponse, sendMethodNotAllowed } from '../../../utils/proxyApi';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const ipBuckets = new Map();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim()) {
    return String(secret).trim();
  }
  throw new Error('JWT_SECRET_NOT_CONFIGURED');
}

function authenticateRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('MISSING_BEARER_TOKEN');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('MISSING_BEARER_TOKEN');
  }
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (!decoded?.id) {
    throw new Error('INVALID_TOKEN_PAYLOAD');
  }
}

function getClientIp(req) {
  const trustProxy =
    process.env.TRUST_PROXY === 'true' ||
    process.env.TRUST_PROXY === '1' ||
    Number(process.env.TRUST_PROXY) > 0;
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    ipBuckets.set(ip, { start: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  ipBuckets.set(ip, bucket);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  try {
    authenticateRequest(req);
  } catch {
    return res.status(401).json({
      success: false,
      message: '未授权访问，请先登录',
      code: 'UNAUTHORIZED',
    });
  }

  const keyword = (req.query.keyword || req.query.keyWord || '').trim();
  if (!keyword) {
    return res.status(400).json({
      success: false,
      message: '请提供 keyword 参数',
      code: 'MISSING_KEYWORD',
    });
  }
  if (keyword.length > 120) {
    return res.status(400).json({
      success: false,
      message: 'keyword 过长',
      code: 'INVALID_KEYWORD_LENGTH',
    });
  }

  const tk = String(process.env.TIANDITU_SERVER_TK || '').trim();
  if (!tk) {
    return res.status(503).json({
      success: false,
      message: '未配置天地图服务端 Key',
      code: 'TIANDITU_KEY_NOT_CONFIGURED',
    });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      code: 'RATE_LIMITED',
    });
  }

  try {
    const ds = JSON.stringify({ keyWord: keyword });
    const url = `https://api.tianditu.gov.cn/geocoder?ds=${encodeURIComponent(ds)}&tk=${tk}`;
    const response = await fetch(url);
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '天地图返回了非JSON响应',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    res.status(response.status).json(data);
  } catch (e) {
    devError('天地图地理编码代理错误:', e);
    res.status(500).json({
      success: false,
      message: '地理编码请求失败',
      code: 'TIANDITU_GEOCODE_FAILED',
    });
  }
}
