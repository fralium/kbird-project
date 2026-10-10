const NodeCache = require('node-cache');
const { devLog, devError } = require('../utils/devLogger');

// 创建缓存实例，TTL为5分钟；限制 key 数量防止查询参数刷爆内存
const cache = new NodeCache({ stdTTL: 300, maxKeys: 2000, useClones: false });
const cacheMetrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0,
};

const logCache = (...args) => {
  devLog(...args);
};

// 缓存中间件
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // 只缓存GET请求
    if (req.method !== 'GET') {
      return next();
    }

    // 含认证头的请求通常返回用户相关内容，避免跨身份缓存污染。
    if (req.headers.authorization) {
      return next();
    }

    // 生成缓存键（仅用 pathname，避免任意 query 刷爆缓存）
    const pathname = String(req.originalUrl || '').split('?')[0];
    const key = `${pathname}_${JSON.stringify(req.query || {})}`;
    
    // 检查缓存
    const cachedData = cache.get(key);
    if (cachedData) {
      cacheMetrics.hits += 1;
      logCache('缓存命中:', key);
      return res.json(cachedData);
    }
    cacheMetrics.misses += 1;

    // 拦截响应
    const originalJson = res.json;
    res.json = function(data) {
      // 只缓存成功的响应
      if (res.statusCode === 200 && data.success) {
        logCache('缓存数据:', key);
        try {
          // 安全地将Mongoose文档转换为纯JavaScript对象
          let serializableData;
          if (data && typeof data === 'object') {
            // 如果是Mongoose文档或包含Mongoose文档的对象，使用toObject()方法
            if (data.toObject && typeof data.toObject === 'function') {
              serializableData = data.toObject();
            } else if (data.data && data.data.toObject && typeof data.data.toObject === 'function') {
              // 如果数据在data字段中
              serializableData = { ...data, data: data.data.toObject() };
            } else {
              // 尝试递归处理嵌套的Mongoose文档
              serializableData = JSON.parse(JSON.stringify(data, (key, value) => {
                if (value && typeof value === 'object' && value.toObject && typeof value.toObject === 'function') {
                  return value.toObject();
                }
                return value;
              }));
            }
          } else {
            serializableData = data;
          }
          cache.set(key, serializableData, duration);
          cacheMetrics.sets += 1;
        } catch (error) {
          devError('缓存序列化失败:', error);
          // 如果序列化失败，不缓存数据，但继续正常响应
        }
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// 清除缓存：兼容历史写法 `/api/birds\\?`，实际 key 形如 `/api/birds_{...}`
const clearCache = (pattern) => {
  const keys = cache.keys();
  const testKey = (key) => {
    if (pattern instanceof RegExp) {
      return pattern.test(key);
    }
    const raw = String(pattern || '');
    // 去掉为匹配 query 而加的 \? / ?
    const prefix = raw
      .replace(/\\\?/g, '')
      .replace(/\?$/g, '')
      .replace(/\/$/g, '');
    if (!prefix) return false;
    if (
      key === prefix ||
      key.startsWith(`${prefix}_`) ||
      key.startsWith(`${prefix}/`) ||
      key.startsWith(`${prefix}?`)
    ) {
      return true;
    }
    try {
      return new RegExp(raw).test(key);
    } catch {
      return key.includes(prefix);
    }
  };

  keys.forEach((key) => {
    if (testKey(key)) {
      cache.del(key);
      cacheMetrics.evictions += 1;
      logCache('清除缓存:', key);
    }
  });
};

const clearLeaderboardCache = () => {
  clearCache(/^\/api\/leaderboard(?:\/|\?|_)/);
};

const getCacheMetrics = () => ({
  ...cacheMetrics,
  keyCount: cache.keys().length,
});

module.exports = {
  cacheMiddleware,
  clearCache,
  clearLeaderboardCache,
  getCacheMetrics,
  cache
};
