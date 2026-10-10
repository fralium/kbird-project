// API config: call backend directly.
const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13082';
const DEBUG_LOGS_ENABLED = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
const API_BASE_URL = RAW_API_BASE_URL.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
export const AUTH_EXPIRED_EVENT = 'kbird:auth-expired';
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [300, 800];
const ERROR_LOG_TTL_MS = 10_000;

// Deduplicate in-flight GET requests.
const pendingRequests = new Map();
const recentErrorLogTimes = new Map();
/** Session cache for optional location name lookups (hit + miss). */
const locationByNameCache = new Map();
const locationByNameInflight = new Map();
/** After backend drop, skip by-name probes briefly to avoid console spam. */
let locationByNameCircuitOpenUntil = 0;
const LOCATION_BY_NAME_CIRCUIT_MS = 15_000;
const LOCATION_BY_NAME_EMPTY = Object.freeze({
  success: true,
  data: null,
  message: '后端暂不可用，已跳过地点词典查询',
  code: 'LOCATION_LOOKUP_SKIPPED',
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isBackendDownError = (error) =>
  error?.code === 'BACKEND_UNREACHABLE' ||
  Number(error?.status) === 0 ||
  Number(error?.status) === 502 ||
  Number(error?.status) === 503 ||
  Number(error?.status) === 504;

const createBackendUnreachableError = (cause) => {
  const error = new Error('无法连接后端 API，请确认后端服务已启动且地址配置正确');
  error.status = 0;
  error.code = 'BACKEND_UNREACHABLE';
  error.cause = cause;
  return error;
};

const shouldLogErrorNow = (key, ttlMs = ERROR_LOG_TTL_MS) => {
  const now = Date.now();
  const lastAt = recentErrorLogTimes.get(key) || 0;
  if (now - lastAt < ttlMs) return false;
  recentErrorLogTimes.set(key, now);
  if (recentErrorLogTimes.size > 200) {
    // Keep map bounded in long dev sessions.
    recentErrorLogTimes.clear();
    recentErrorLogTimes.set(key, now);
  }
  return true;
};

export const apiRequest = async (endpoint, options = {}) => {
  const shouldUseRelativeApi =
    typeof window !== 'undefined' &&
    endpoint.startsWith('/api/') &&
    process.env.NEXT_PUBLIC_FORCE_DIRECT_BACKEND !== 'true';
  const url = shouldUseRelativeApi ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const { skipAuthHandling = false, skipRetry = false, ...requestOptions } = options;
  const isFormDataBody =
    typeof FormData !== 'undefined' && requestOptions?.body instanceof FormData;

  const defaultOptions = {
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  const config = {
    ...defaultOptions,
    ...requestOptions,
    headers: {
      ...defaultOptions.headers,
      ...requestOptions.headers,
    },
  };

  const isGet = !requestOptions.method || requestOptions.method === 'GET';
  const requestKey = `${url}-${JSON.stringify(config)}`;
  const shouldTryRelativeFallback =
    !shouldUseRelativeApi &&
    typeof window !== 'undefined' &&
    endpoint.startsWith('/api/') &&
    !url.startsWith(window.location.origin);

  if (isGet && pendingRequests.has(requestKey)) {
    return await pendingRequests.get(requestKey);
  }

  try {
    if (DEBUG_LOGS_ENABLED) {
      const redactedHeaders = { ...(config.headers || {}) };
      if (redactedHeaders.Authorization) {
        redactedHeaders.Authorization = 'Bearer [REDACTED]';
      }
      console.log('API request:', {
        url,
        method: config.method || 'GET',
        headers: redactedHeaders,
      });
    }

    const requestPromise = (async () => {
      const fetchWithFallback = async () => {
        try {
          return await fetch(url, config);
        } catch (networkError) {
          if (!shouldTryRelativeFallback) {
            throw createBackendUnreachableError(networkError);
          }
          try {
            return await fetch(endpoint, config);
          } catch (fallbackNetworkError) {
            throw createBackendUnreachableError(fallbackNetworkError);
          }
        }
      };

      const executeRequestOnce = async () => {
        let response = await fetchWithFallback();

        // pages/api 代理偶发连不上 Express 时返回 502/503；浏览器再直连后端一次
        if (
          shouldUseRelativeApi &&
          (response.status === 502 || response.status === 503 || response.status === 504)
        ) {
          try {
            const directResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
            response = directResponse;
          } catch {
            // 保留代理侧响应，由下方统一抛错 / 重试
          }
        }

        if (!response.ok) {
          let message = '';
          let errorData = null;
          try {
            const text = await response.text();
            errorData = text ? JSON.parse(text) : null;
            message = errorData?.message || '';
          } catch {
            message = '';
          }

          if (response.status === 401) {
            const unauthorizedByBackend = message.includes('未授权') || message.includes('token');
            const finalMessage = !token || unauthorizedByBackend ? '请先登录后查看该页面' : (message || '登录已过期，请重新登录');
            const shouldEmitAuthExpired =
              typeof window !== 'undefined' &&
              !skipAuthHandling &&
              !endpoint.includes('/api/users/login') &&
              !endpoint.includes('/api/users/register');

            if (shouldEmitAuthExpired) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.dispatchEvent(
                new CustomEvent(AUTH_EXPIRED_EVENT, {
                  detail: { message: finalMessage, endpoint },
                })
              );
            }

            const error = new Error(finalMessage);
            error.status = 401;
            error.code = errorData?.code || 'UNAUTHORIZED';
            throw error;
          }

          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '15';
            const error = new Error(
              message ||
                `HTTP error! status: ${response.status} (Too Many Requests. Retry after ${retryAfter} seconds)`
            );
            error.status = 429;
            error.code = errorData?.code || 'RATE_LIMITED';
            throw error;
          }

          if (response.status === 400) {
            const error = new Error(message || 'Request parameters are invalid');
            error.status = 400;
            error.code = errorData?.code || 'BAD_REQUEST';
            throw error;
          }

          const error = new Error(message || `HTTP error! status: ${response.status}`);
          error.status = response.status;
          error.code = errorData?.code || 'REQUEST_FAILED';
          error.data = errorData?.data;
          throw error;
        }

        const contentType = response.headers.get('content-type') || '';
        const rawBody = await response.text();
        if (!rawBody) return {};
        if (contentType.includes('application/json')) {
          try {
            return JSON.parse(rawBody);
          } catch {
            const error = new Error('服务器返回了无效的 JSON 响应');
            error.status = response.status || 500;
            error.code = 'INVALID_JSON_RESPONSE';
            throw error;
          }
        }
        return { success: true, data: rawBody };
      };

      const maxRetries = isGet && !skipRetry ? RETRY_DELAYS_MS.length : 0;
      let attempt = 0;
      while (true) {
        try {
          return await executeRequestOnce();
        } catch (error) {
          const status = Number(error?.status);
          const retryable = status === 0 || RETRYABLE_STATUS_CODES.has(status);
          if (!retryable || attempt >= maxRetries) {
            throw error;
          }
          await sleep(RETRY_DELAYS_MS[attempt]);
          attempt += 1;
        }
      }
    })();

    if (isGet) {
      pendingRequests.set(requestKey, requestPromise);
    }

    const result = await requestPromise;
    if (isGet) {
      pendingRequests.delete(requestKey);
    }
    return result;
  } catch (error) {
    if (isGet) {
      pendingRequests.delete(requestKey);
    }
    if (DEBUG_LOGS_ENABLED || Number(error?.status) >= 500 || Number(error?.status) === 0) {
      const errorKey = `${error?.code || 'UNKNOWN'}|${url}`;
      if (shouldLogErrorNow(errorKey)) {
        console.error('API request failed:', {
          url: url || endpoint,
          status: error?.status ?? null,
          code: error?.code || null,
          message: error?.message || String(error || 'unknown'),
        });
      }
    }
    throw error;
  }
};

export const api = {
  birds: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/birds${queryString ? `?${queryString}` : ''}`);
    },
    getFilterOptions: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/birds/filter-options${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id, params = {}, options = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/birds/${id}${queryString ? `?${queryString}` : ''}`, options);
    },
    create: (data) =>
      apiRequest('/api/birds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    /** 普通用户申请入库（临时档案，可立即用于记笔） */
    requestNew: (data) =>
      apiRequest('/api/birds/request-new', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      apiRequest(`/api/birds/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      apiRequest(`/api/birds/${id}`, {
        method: 'DELETE',
      }),
    checkDuplicate: (payload) =>
      apiRequest('/api/birds/check-duplicate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    addImage: (id, imageFormData) =>
      apiRequest(`/api/birds/${id}/images`, {
        method: 'POST',
        body: imageFormData,
      }),
    deleteImage: (id, imageIndex) =>
      apiRequest(`/api/birds/${id}/images/${imageIndex}`, {
        method: 'DELETE',
      }),
    updateImage: (id, imageIndex, payload) =>
      apiRequest(`/api/birds/${id}/images/${imageIndex}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    setMainImage: (id, imageIndex) =>
      apiRequest(`/api/birds/${id}/images/${imageIndex}/set-main`, {
        method: 'PUT',
      }),
    addCall: (id, callFormData) =>
      apiRequest(`/api/birds/${id}/calls`, {
        method: 'POST',
        body: callFormData,
      }),
    updateCall: (id, callIndex, payload) =>
      apiRequest(`/api/birds/${id}/calls/${callIndex}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteCall: (id, callIndex) =>
      apiRequest(`/api/birds/${id}/calls/${callIndex}`, {
        method: 'DELETE',
      }),
  },

  regionLists: {
    getAll: (params = {}) => {
      const keepEmpty = new Set(['city', 'district', 'spot', 'exactDivision']);
      const cleaned = Object.fromEntries(
        Object.entries(params).filter(([key, value]) => {
          if (value == null) return false;
          if (keepEmpty.has(key)) return true;
          return String(value).trim() !== '';
        })
      );
      const queryString = new URLSearchParams(
        Object.fromEntries(
          Object.entries(cleaned).map(([key, value]) => [key, String(value)])
        )
      ).toString();
      return apiRequest(`/api/region-lists${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id, params = {}) => {
      const cleaned = Object.fromEntries(
        Object.entries(params).filter(([, value]) => value != null && String(value).trim() !== '')
      );
      const queryString = new URLSearchParams(cleaned).toString();
      return apiRequest(`/api/region-lists/${id}${queryString ? `?${queryString}` : ''}`);
    },
    create: (payload) =>
      apiRequest('/api/region-lists', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id, payload) =>
      apiRequest(`/api/region-lists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id) =>
      apiRequest(`/api/region-lists/${id}`, {
        method: 'DELETE',
      }),
    previewVersion: (id, payload) =>
      apiRequest(`/api/region-lists/${id}/versions/preview`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    publishVersion: (id, payload) =>
      apiRequest(`/api/region-lists/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    linkSpecies: (id, payload) =>
      apiRequest(`/api/region-lists/${id}/species/link`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  users: {
    getProfile: (options = {}) => apiRequest('/api/users/profile', options),
    updateProfile: (data) =>
      apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getContributions: () => apiRequest('/api/users/contributions'),
    getFavorites: () => apiRequest('/api/users/favorites'),
    addFavorite: (birdId) =>
      apiRequest(`/api/users/favorites/${birdId}`, {
        method: 'POST',
      }),
    removeFavorite: (birdId) =>
      apiRequest(`/api/users/favorites/${birdId}`, {
        method: 'DELETE',
      }),
    login: (data, options = {}) =>
      apiRequest('/api/users/login', {
        method: 'POST',
        body: JSON.stringify(data),
        ...options,
      }),
    localSession: (options = {}) =>
      apiRequest('/api/users/local-session', {
        method: 'POST',
        body: JSON.stringify({}),
        ...options,
      }),
    register: (data, options = {}) =>
      apiRequest('/api/users/register', {
        method: 'POST',
        body: JSON.stringify(data),
        ...options,
      }),
    uploadAvatar: (file) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return apiRequest('/api/users/avatar', {
        method: 'POST',
        body: formData,
      });
    },
  },

  records: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records${queryString ? `?${queryString}` : ''}`, {
        cache: 'no-store',
      });
    },
    getById: (id, options = {}) => apiRequest(`/api/records/${id}`, options),
    create: (data) =>
      apiRequest('/api/records', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      apiRequest(`/api/records/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      apiRequest(`/api/records/${id}`, {
        method: 'DELETE',
      }),
    getByBird: (birdId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records/bird/${birdId}${queryString ? `?${queryString}` : ''}`);
    },
    getByUser: (userId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records/user/${userId}${queryString ? `?${queryString}` : ''}`);
    },
    getMonthlyObservation: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records/monthly-observation${queryString ? `?${queryString}` : ''}`);
    },
    getLocationOptions: () => apiRequest('/api/records/location-options'),
    getMapPoints: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records/map-points${queryString ? `?${queryString}` : ''}`);
    },
    syncLocation: (id) =>
      apiRequest(`/api/records/${id}/sync-location`, {
        method: 'PUT',
      }),
    removeBirdFromRecord: (recordId, birdId) =>
      apiRequest(`/api/records/${recordId}/bird/${birdId}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
  },

  locations: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/locations${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/api/locations/${id}`),
    /** Optional dictionary lookup; caches hits and misses for the session. */
    getByName: (name) => {
      const key = String(name || '').trim();
      if (!key) {
        return Promise.resolve({
          success: true,
          data: null,
          message: '请提供 name 参数',
          code: 'MISSING_LOCATION_NAME',
        });
      }
      if (Date.now() < locationByNameCircuitOpenUntil) {
        return Promise.resolve(LOCATION_BY_NAME_EMPTY);
      }
      if (locationByNameCache.has(key)) {
        return Promise.resolve(locationByNameCache.get(key));
      }
      if (locationByNameInflight.has(key)) {
        return locationByNameInflight.get(key);
      }
      // Optional lookup: no retry storm when Express is restarting.
      const request = apiRequest(`/api/locations/by-name?name=${encodeURIComponent(key)}`, {
        skipRetry: true,
      })
        .then((result) => {
          locationByNameCache.set(key, result);
          return result;
        })
        .catch((error) => {
          // Cache expected empty misses if an older backend still returns 404.
          if (Number(error?.status) === 404) {
            const empty = {
              success: true,
              data: null,
              message: error.message || '未找到该名称的地点',
              code: error.code || 'LOCATION_NOT_FOUND',
            };
            locationByNameCache.set(key, empty);
            return empty;
          }
          if (isBackendDownError(error)) {
            locationByNameCircuitOpenUntil = Date.now() + LOCATION_BY_NAME_CIRCUIT_MS;
            return LOCATION_BY_NAME_EMPTY;
          }
          throw error;
        })
        .finally(() => {
          locationByNameInflight.delete(key);
        });
      locationByNameInflight.set(key, request);
      return request;
    },
    create: (data) =>
      apiRequest('/api/locations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      apiRequest(`/api/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      apiRequest(`/api/locations/${id}`, {
        method: 'DELETE',
      }),
    getPopular: (limit = 8) => apiRequest(`/api/locations/popular?limit=${limit}`),
    getSummary: () => apiRequest('/api/locations/summary'),
    addImage: (id, { url, caption = '' }) =>
      apiRequest(`/api/locations/${id}/images`, {
        method: 'POST',
        body: JSON.stringify({ url, caption }),
      }),
    updateImage: (id, imageIndex, data) =>
      apiRequest(`/api/locations/${id}/images/${imageIndex}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    setMainImage: (id, imageIndex) =>
      apiRequest(`/api/locations/${id}/images/${imageIndex}/set-main`, {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
    deleteImage: (id, imageIndex) =>
      apiRequest(`/api/locations/${id}/images/${imageIndex}`, {
        method: 'DELETE',
      }),
    syncFromRecords: () =>
      apiRequest('/api/locations/sync-from-records', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  },

  leaderboard: {
    getBirdFirsts: () => apiRequest('/api/leaderboard/bird-firsts'),
    getLocationFirsts: () => apiRequest('/api/leaderboard/location-firsts'),
  },

  init: {
    submit: (data, options = {}) => {
      // 仅允许显式传入 setupToken；禁止把令牌打进 NEXT_PUBLIC_* 前端包
      const setupToken = options.setupToken || '';
      return apiRequest('/api/init', {
        method: 'POST',
        headers: setupToken ? { 'x-setup-token': setupToken } : undefined,
        body: JSON.stringify(data),
      });
    },
    checkStatus: () => apiRequest('/api/check-init'),
  },

  upload: {
    image: (file) => {
      const formData = new FormData();
      formData.append('image', file);
      return apiRequest('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
    },
  },

  ai: {
    getStatus: () => apiRequest('/api/ai/status'),
    identify: ({ image, description = '' }) => {
      const formData = new FormData();
      formData.append('image', image);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      return apiRequest('/api/ai/identify', {
        method: 'POST',
        body: formData,
      });
    },
    identifyBatch: ({ images, description = '' }) => {
      const formData = new FormData();
      images.forEach((image) => formData.append('images', image));
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      return apiRequest('/api/ai/identify/batch', {
        method: 'POST',
        body: formData,
      });
    },
    draftRecord: (text) =>
      apiRequest('/api/ai/draft', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    listConversations: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/ai/conversations${queryString ? `?${queryString}` : ''}`);
    },
    createConversation: (payload = {}) =>
      apiRequest('/api/ai/conversations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getConversation: (id) => apiRequest(`/api/ai/conversations/${id}`),
    deleteConversation: (id) =>
      apiRequest(`/api/ai/conversations/${id}`, {
        method: 'DELETE',
      }),
    postConversationMessage: (id, content, extra = {}) =>
      apiRequest(`/api/ai/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          ...(extra.thinking ? { thinking: extra.thinking } : {}),
        }),
      }),
    /**
     * SSE 流式发消息。callbacks: onStatus, onDelta, onReasoning, onDone, onError
     * options: { signal, thinking }
     */
    streamConversationMessage: async (id, content, callbacks = {}, options = {}) => {
      const {
        onStatus,
        onDelta,
        onReasoning,
        onDone,
        onError,
      } = callbacks;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        const error = new Error('请先登录');
        error.status = 401;
        error.code = 'UNAUTHORIZED';
        throw error;
      }

      const endpoint = `/api/ai/conversations/${id}/messages/stream`;
      const shouldUseRelativeApi =
        typeof window !== 'undefined' &&
        process.env.NEXT_PUBLIC_FORCE_DIRECT_BACKEND !== 'true';
      const url = shouldUseRelativeApi ? endpoint : `${API_BASE_URL}${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          content,
          ...(options.thinking ? { thinking: options.thinking } : {}),
        }),
        signal: options.signal,
      });

      const contentType = String(response.headers.get('content-type') || '');
      if (!response.ok || !contentType.includes('text/event-stream')) {
        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        const error = new Error(data.message || `发送失败 (${response.status})`);
        error.status = response.status;
        error.code = data.code || 'AI_CONVERSATION_CHAT_FAILED';
        if (typeof onError === 'function') onError(error);
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const error = new Error('浏览器不支持流式读取');
        error.code = 'AI_STREAM_UNSUPPORTED';
        throw error;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';
      let dataLines = [];

      const dispatch = (eventName, rawData) => {
        let payload = rawData;
        try {
          payload = rawData ? JSON.parse(rawData) : {};
        } catch {
          payload = { text: rawData };
        }
        if (eventName === 'status' && typeof onStatus === 'function') onStatus(payload);
        else if (eventName === 'delta' && typeof onDelta === 'function') onDelta(payload);
        else if (eventName === 'reasoning' && typeof onReasoning === 'function') onReasoning(payload);
        else if (eventName === 'done' && typeof onDone === 'function') onDone(payload);
        else if (eventName === 'error') {
          const error = new Error(payload?.message || '发送消息失败');
          error.code = payload?.code || 'AI_CONVERSATION_CHAT_FAILED';
          if (typeof onError === 'function') onError(error);
          throw error;
        }
      };

      const flushEvent = () => {
        if (!dataLines.length) {
          currentEvent = 'message';
          return;
        }
        dispatch(currentEvent, dataLines.join('\n'));
        currentEvent = 'message';
        dataLines = [];
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line === '' || line === '\r') {
            flushEvent();
            continue;
          }
          const trimmed = line.replace(/\r$/, '');
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }
          if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice(5).replace(/^ /, ''));
          }
        }
      }
      flushEvent();
    },
    appendIdentifyResult: (id, { result, note = '' }) =>
      apiRequest(`/api/ai/conversations/${id}/identify-result`, {
        method: 'POST',
        body: JSON.stringify({ result, note }),
      }),
  },

  tianditu: {
    geocode: (keyword) => apiRequest(`/api/tianditu/geocode?keyword=${encodeURIComponent(keyword)}`),
  },

  admin: {
    getErrorMetrics: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/admin/error-metrics${queryString ? `?${queryString}` : ''}`);
    },
    getUserReports: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/admin/user-reports${queryString ? `?${queryString}` : ''}`);
    },
  },

  personal: {
    importPreview: (payload) =>
      apiRequest('/api/personal/import/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    importApply: (payload) =>
      apiRequest('/api/personal/import/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    importCbrcPreview: (payload) =>
      apiRequest('/api/personal/import/cbrc-table/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    importCbrcApply: (payload) =>
      apiRequest('/api/personal/import/cbrc-table', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    /** 浏览器侧请用 utils/personalExportDownload.js（二进制下载） */
    exportCbrcUrl: '/api/personal/export/cbrc',
    exportEbirdUrl: '/api/personal/export/ebird',
    getStatsDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/stats/dashboard${queryString ? `?${queryString}` : ''}`);
    },
    getStats: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/stats${queryString ? `?${queryString}` : ''}`);
    },
    getFootprint: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/stats/footprint${queryString ? `?${queryString}` : ''}`);
    },
    getBirdFirsts: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/stats/bird-firsts${queryString ? `?${queryString}` : ''}`);
    },
    getLocationFirsts: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(
        `/api/personal/stats/location-firsts${queryString ? `?${queryString}` : ''}`
      );
    },
    getSettings: (options = {}) => apiRequest('/api/personal/settings', options),
    updateSettings: (payload) =>
      apiRequest('/api/personal/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    getNotepad: async () => {
      const data = await apiRequest('/api/personal/settings');
      return {
        success: !!data?.success,
        data: data?.data?.notepad || { content: '', updatedAt: null },
        message: data?.message,
      };
    },
    saveNotepad: async (payloadOrContent) => {
      const isObjectPayload =
        payloadOrContent &&
        typeof payloadOrContent === 'object' &&
        !Array.isArray(payloadOrContent);
      const payload = {
        notepad: isObjectPayload
          ? {
              ...payloadOrContent,
              updatedAt: payloadOrContent.updatedAt || new Date().toISOString(),
            }
          : {
              content: String(payloadOrContent || ''),
              updatedAt: new Date().toISOString(),
            },
      };
      const data = await apiRequest('/api/personal/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return {
        success: !!data?.success,
        data: data?.data?.notepad || { content: payload.notepad.content, updatedAt: payload.notepad.updatedAt },
        message: data?.message,
      };
    },
    resetSettings: () =>
      apiRequest('/api/personal/settings/reset', {
        method: 'POST',
      }),
    getPhotos: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/photos${queryString ? `?${queryString}` : ''}`);
    },
    getPhotoStats: () => apiRequest('/api/personal/photos/stats'),
    getPhotoBirds: () => apiRequest('/api/personal/photos/birds'),
    compareTripPreview: (payload) =>
      apiRequest('/api/personal/trip-preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    pickFolderPhotos: (payload = {}) =>
      apiRequest('/api/personal/folder-photos/pick', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    previewFolderPhotos: (payload) =>
      apiRequest('/api/personal/folder-photos/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    applyFolderPhotos: (payload) =>
      apiRequest('/api/personal/folder-photos/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    listTripPreviewHistory: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/trip-preview/history${queryString ? `?${queryString}` : ''}`);
    },
    getTripPreviewHistory: (id) =>
      apiRequest(`/api/personal/trip-preview/history/${encodeURIComponent(id)}`),
    getTripPreviewLocationPast: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/trip-preview/location-past${queryString ? `?${queryString}` : ''}`);
    },
    deleteTripPreviewHistory: (id) =>
      apiRequest(`/api/personal/trip-preview/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    getGoals: () => apiRequest('/api/personal/goals'),
    updateGoals: (payload) =>
      apiRequest('/api/personal/goals', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    createGoalList: (payload) =>
      apiRequest('/api/personal/goals/lists', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteGoalList: (listId) =>
      apiRequest(`/api/personal/goals/lists/${encodeURIComponent(listId)}`, {
        method: 'DELETE',
      }),
    getChecklistTaxonomy: () => apiRequest('/api/personal/checklist/taxonomy'),
    completeGoal: (type, id, options = {}) => {
      const params = new URLSearchParams();
      if (options.listId) params.set('listId', options.listId);
      const query = params.toString();
      return apiRequest(
        `/api/personal/goals/${type}/${encodeURIComponent(id)}/complete${query ? `?${query}` : ''}`,
        {
          method: 'POST',
          body: JSON.stringify(options.listId ? { listId: options.listId } : {}),
        }
      );
    },
    getAnnualReport: (year) => apiRequest(`/api/personal/reports/annual/${year}`),
    getMonthlyReport: (year, month) => apiRequest(`/api/personal/reports/monthly/${year}/${month}`),
    getCustomReport: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/personal/reports/custom${queryString ? `?${queryString}` : ''}`);
    },
    getProjects: () => apiRequest('/api/personal/projects'),
    createProject: (payload) =>
      apiRequest('/api/personal/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getProjectById: (id) => apiRequest(`/api/personal/projects/${id}`),
    updateProject: (id, payload) =>
      apiRequest(`/api/personal/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteProject: (id) =>
      apiRequest(`/api/personal/projects/${id}`, {
        method: 'DELETE',
      }),
    getPlots: () => apiRequest('/api/personal/plots'),
    createPlot: (payload) =>
      apiRequest('/api/personal/plots', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getPlotById: (id) => apiRequest(`/api/personal/plots/${id}`),
    updatePlot: (id, payload) =>
      apiRequest(`/api/personal/plots/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    updatePlotReport: (id, reportId, payload) =>
      apiRequest(`/api/personal/plots/${id}/reports/${encodeURIComponent(reportId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload || {}),
      }),
    deletePlot: (id) =>
      apiRequest(`/api/personal/plots/${id}`, {
        method: 'DELETE',
      }),
    addPlotSpecies: (id, payload) =>
      apiRequest(`/api/personal/plots/${id}/species`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updatePlotSpecies: (id, speciesId, payload) =>
      apiRequest(`/api/personal/plots/${id}/species/${speciesId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deletePlotSpecies: (id, speciesId) =>
      apiRequest(`/api/personal/plots/${id}/species/${speciesId}`, {
        method: 'DELETE',
      }),
    addPlotEntry: (id, payload) =>
      apiRequest(`/api/personal/plots/${id}/entries`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deletePlotEntry: (id, speciesId, entryId) =>
      apiRequest(`/api/personal/plots/${id}/species/${speciesId}/entries/${entryId}`, {
        method: 'DELETE',
      }),
    importPlotCbrc: (id, payload) =>
      apiRequest('/api/personal/plots/cbrc-import', {
        method: 'POST',
        body: JSON.stringify({ ...(payload || {}), plotId: id }),
      }),
    createProjectFolder: (id, payload) =>
      apiRequest(`/api/personal/projects/${id}/folders`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateProjectFolder: (id, folderId, payload) =>
      apiRequest(`/api/personal/projects/${id}/folders/${folderId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteProjectFolder: (id, folderId) =>
      apiRequest(`/api/personal/projects/${id}/folders/${folderId}`, {
        method: 'DELETE',
      }),
    createProjectAsset: (id, payload) =>
      apiRequest(`/api/personal/projects/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateProjectAsset: (id, assetId, payload) =>
      apiRequest(`/api/personal/projects/${id}/assets/${assetId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteProjectAsset: (id, assetId) =>
      apiRequest(`/api/personal/projects/${id}/assets/${assetId}`, {
        method: 'DELETE',
      }),
    openProjectAssetFile: async (id, assetId) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        const error = new Error('请先登录后再打开文件');
        error.status = 401;
        throw error;
      }
      const endpoint = `${API_BASE_URL}/api/personal/projects/${id}/assets/${assetId}/file`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        let message = `打开文件失败 (${response.status})`;
        try {
          const data = await response.json();
          if (data?.message) message = data.message;
        } catch {
          // ignore parse error
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return { success: true };
    },
    uploadProjectFile: async (id, file, { title = '', folderId = '', tags = [] } = {}) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        const error = new Error('请先登录后再上传文件');
        error.status = 401;
        throw error;
      }
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (folderId) formData.append('folderId', folderId);
      if (Array.isArray(tags) && tags.length > 0) formData.append('tags', tags.join(','));

      const endpoint = `${API_BASE_URL}/api/personal/projects/${id}/upload`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, message: '上传响应解析失败' };
      }
      if (!response.ok) {
        const error = new Error(data?.message || `上传失败 (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return data;
    },
  },
};

export default api;

