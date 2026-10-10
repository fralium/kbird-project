// 简单的请求缓存工具
class RequestCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 30000; // 30秒缓存
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const requestCache = new RequestCache();

export default requestCache;
