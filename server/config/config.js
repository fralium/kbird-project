const { getJwtSecret } = require('./jwtSecret');
const { getUploadsRoot, getDataRoot } = require('./dataPaths');

// 应用配置
module.exports = {
  // 数据库配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird'
  },
  
  // JWT配置
  jwt: {
    get secret() {
      return getJwtSecret();
    },
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // 服务器配置
  server: {
    port: process.env.PORT || 13082
  },

  // 个人数据根（仓库外）
  data: {
    get root() {
      return getDataRoot();
    },
  },
  
  // 文件上传配置（物理目录在 KBIRD_DATA_ROOT/uploads，URL 仍为 /uploads/...）
  upload: {
    get path() {
      return getUploadsRoot();
    },
    maxFileSize: process.env.MAX_FILE_SIZE || 5242880 // 5MB
  }
};

