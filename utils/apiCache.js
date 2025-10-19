class ApiCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 5 * 60 * 1000; // 5分钟缓存
    this.maxSize = 100; // 最大缓存条目数
  }

  // 生成缓存键
  generateKey(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  // 检查缓存是否有效
  isValid(entry) {
    return Date.now() - entry.timestamp < this.maxAge;
  }

  // 获取缓存
  get(url, options = {}) {
    const key = this.generateKey(url, options);
    const entry = this.cache.get(key);
    
    if (entry && this.isValid(entry)) {
      return entry.data;
    }
    
    // 缓存过期或不存在，删除
    if (entry) {
      this.cache.delete(key);
    }
    
    return null;
  }

  // 设置缓存
  set(url, options = {}, data) {
    const key = this.generateKey(url, options);
    
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // 清除特定缓存
  clear(url, options = {}) {
    const key = this.generateKey(url, options);
    this.cache.delete(key);
  }

  // 清除所有缓存
  clearAll() {
    this.cache.clear();
  }

  // 清除过期缓存
  clearExpired() {
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
      }
    }
  }

  // 获取缓存统计
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge
    };
  }
}

// 创建单例实例
const apiCache = new ApiCache();

// 定期清理过期缓存
setInterval(() => {
  apiCache.clearExpired();
}, 60000); // 每分钟清理一次

export default apiCache;
