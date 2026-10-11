import { devError } from './devLogger';
import { resolveBackendApiBase } from './backendApiBase';

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'UND_ERR_CONNECT_TIMEOUT',
]);

export const buildJsonHeaders = (req, { includeAuth = true } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (includeAuth && req?.headers?.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  return headers;
};

export const parseProxyJsonResponse = async (
  response,
  {
    invalidMessage = '服务器返回了非JSON响应',
    invalidCode = 'UPSTREAM_INVALID_RESPONSE',
  } = {}
) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      message: invalidMessage,
      code: invalidCode,
    };
  }
};

export const sendProxyError = (
  res,
  error,
  {
    message = '服务器错误',
    code = 'PROXY_FAILED',
    hint,
  } = {}
) => {
  const errorCode = error?.code || error?.cause?.code;
  const isAbort = error?.name === 'AbortError';
  const isNetworkFailure =
    isAbort ||
    NETWORK_ERROR_CODES.has(errorCode) ||
    String(error?.message || '').toLowerCase().includes('fetch failed');

  if (isNetworkFailure) {
    return res.status(503).json({
      success: false,
      message: '无法连接后端 API，请确认后端服务已启动且地址配置正确',
      code: 'BACKEND_UNREACHABLE',
      ...(hint ? { hint } : {}),
    });
  }

  devError('API代理错误:', error);
  return res.status(500).json({
    success: false,
    message,
    code,
  });
};

export const sendMethodNotAllowed = (res, allowedMethods = [], message = '方法不允许') => {
  if (Array.isArray(allowedMethods) && allowedMethods.length > 0) {
    res.setHeader('Allow', allowedMethods);
  }

  return res.status(405).json({
    success: false,
    message,
    code: 'METHOD_NOT_ALLOWED',
  });
};

/**
 * Factory for Next.js pages/api proxies to Express backend.
 * @param {{ backendPath: string|((req)=>string), methods?: string[], includeAuth?: boolean, mapQuery?: (query)=>object }} options
 */
export const createBackendProxy = ({
  backendPath,
  methods = ['GET'],
  includeAuth = true,
  mapQuery,
  errorMessage = '请求失败',
  errorCode = 'PROXY_FAILED',
} = {}) => {
  const allowed = new Set((methods || []).map((m) => String(m).toUpperCase()));

  return async function backendProxyHandler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (!allowed.has(method)) {
      return sendMethodNotAllowed(res, [...allowed]);
    }

    try {
      const API_BASE_URL = resolveBackendApiBase();
      const path =
        typeof backendPath === 'function' ? backendPath(req) : String(backendPath || '');
      const query = mapQuery ? mapQuery(req.query || {}) : { ...req.query };
      delete query.path;
      const qs = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        if (Array.isArray(value)) value.forEach((item) => qs.append(key, String(item)));
        else qs.append(key, String(value));
      });
      const url = `${API_BASE_URL}${path}${qs.toString() ? `?${qs}` : ''}`;

      const init = {
        method,
        headers: buildJsonHeaders(req, { includeAuth }),
      };
      if (method !== 'GET' && method !== 'HEAD' && req.body != null) {
        init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const response = await fetch(url, init);
      const data = await parseProxyJsonResponse(response);
      return res.status(response.status).json(data);
    } catch (error) {
      return sendProxyError(res, error, { message: errorMessage, code: errorCode });
    }
  };
};
