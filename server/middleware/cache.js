const NodeCache = require('node-cache');

// 创建缓存实例，TTL为5分钟
const cache = new NodeCache({ stdTTL: 300 });

// 缓存中间件
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // 只缓存GET请求
    if (req.method !== 'GET') {
      return next();
    }

    // 生成缓存键
    const key = `${req.originalUrl}_${JSON.stringify(req.query)}`;
    
    // 检查缓存
    const cachedData = cache.get(key);
    if (cachedData) {
      console.log('缓存命中:', key);
      return res.json(cachedData);
    }

    // 拦截响应
    const originalJson = res.json;
    res.json = function(data) {
      // 只缓存成功的响应
      if (res.statusCode === 200 && data.success) {
        console.log('缓存数据:', key);
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
        } catch (error) {
          console.error('缓存序列化失败:', error);
          // 如果序列化失败，不缓存数据，但继续正常响应
        }
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// 清除缓存
const clearCache = (pattern) => {
  const keys = cache.keys();
  const regex = new RegExp(pattern);
  keys.forEach(key => {
    if (regex.test(key)) {
      cache.del(key);
      console.log('清除缓存:', key);
    }
  });
};

module.exports = {
  cacheMiddleware,
  clearCache,
  cache
};
