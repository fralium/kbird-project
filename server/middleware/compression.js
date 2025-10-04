const compression = require('compression');

// 压缩中间件配置
const compressionMiddleware = compression({
  // 只压缩大于1KB的响应
  threshold: 1024,
  // 压缩级别 (1-9, 6是默认值)
  level: 6,
  // 只压缩这些MIME类型
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

module.exports = compressionMiddleware;
