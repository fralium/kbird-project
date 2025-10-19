// 应用配置
module.exports = {
  // 数据库配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird'
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production',
    expiresIn: '30d'
  },
  
  // 服务器配置
  server: {
    port: process.env.PORT || 3001
  },
  
  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: process.env.MAX_FILE_SIZE || 5242880 // 5MB
  }
};

