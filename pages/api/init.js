import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '方法不允许' });
  }

  try {
    const config = req.body;

    // 验证必需字段
    if (!config.siteName || !config.adminUsername || !config.adminEmail || !config.adminPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请填写所有必需字段' 
      });
    }

    // 验证密码
    if (config.adminPassword !== config.confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '管理员密码不匹配' 
      });
    }

    if (config.adminPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: '管理员密码至少6位' 
      });
    }

    // 生成JWT密钥
    const jwtSecret = generateJWTSecret();

    // 创建.env文件
    const envContent = generateEnvFile(config, jwtSecret);
    const envPath = path.join(process.cwd(), '.env');
    
    try {
      fs.writeFileSync(envPath, envContent, 'utf8');
    } catch (error) {
      console.error('写入.env文件失败:', error);
      return res.status(500).json({ 
        success: false, 
        message: '无法创建配置文件' 
      });
    }

    // 创建配置存储文件
    const configData = {
      siteName: config.siteName,
      siteDescription: config.siteDescription,
      siteUrl: config.siteUrl,
      theme: config.theme,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      enableRegistration: config.enableRegistration,
      enableComments: config.enableComments,
      enableUpload: config.enableUpload,
      maxFileSize: config.maxFileSize,
      initialized: true,
      initializedAt: new Date().toISOString()
    };

    const configPath = path.join(process.cwd(), 'config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (error) {
      console.error('写入配置文件失败:', error);
    }

    // 创建管理员用户
    const hashedPassword = await bcrypt.hash(config.adminPassword, 12);
    
    // 这里需要连接数据库并创建管理员用户
    // 由于数据库连接可能还没有建立，我们创建一个初始化脚本
    const initScript = generateInitScript(config, hashedPassword);
    const scriptPath = path.join(process.cwd(), 'scripts', 'initAdmin.js');
    
    try {
      fs.writeFileSync(scriptPath, initScript, 'utf8');
    } catch (error) {
      console.error('创建初始化脚本失败:', error);
    }

    // 创建上传目录
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const publicImagesDir = path.join(process.cwd(), 'public', 'images');
    
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      if (!fs.existsSync(publicImagesDir)) {
        fs.mkdirSync(publicImagesDir, { recursive: true });
      }
    } catch (error) {
      console.error('创建目录失败:', error);
    }

    res.status(200).json({
      success: true,
      message: '初始化完成',
      data: {
        siteName: config.siteName,
        adminUsername: config.adminUsername,
        nextSteps: [
          '重启服务器以应用新配置',
          '运行 npm run server 启动后端',
          '运行 npm run dev 启动前端',
          '访问网站完成最终设置'
        ]
      }
    });

  } catch (error) {
    console.error('初始化失败:', error);
    res.status(500).json({
      success: false,
      message: '初始化失败: ' + error.message
    });
  }
}

function generateJWTSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateEnvFile(config, jwtSecret) {
  return `# KBird 配置文件
# 由初始化向导自动生成

# 数据库配置
MONGODB_URI=mongodb://${config.dbHost}:${config.dbPort}/${config.dbName}

# JWT密钥
JWT_SECRET=${jwtSecret}

# 服务器端口
PORT=${config.backendPort}

# 前端API地址
NEXT_PUBLIC_API_URL=http://localhost:${config.backendPort}

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=${getMaxFileSizeBytes(config.maxFileSize)}

# 网站配置
SITE_NAME=${config.siteName}
SITE_DESCRIPTION=${config.siteDescription}
SITE_URL=${config.siteUrl}

# 功能开关
ENABLE_REGISTRATION=${config.enableRegistration}
ENABLE_COMMENTS=${config.enableComments}
ENABLE_UPLOAD=${config.enableUpload}

# 主题配置
THEME=${config.theme}
PRIMARY_COLOR=${config.primaryColor}
SECONDARY_COLOR=${config.secondaryColor}

# 环境
NODE_ENV=development
`;
}

function generateInitScript(config, hashedPassword) {
  return `// 管理员用户初始化脚本
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 用户模型
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar: String,
  bio: String,
  location: String,
  website: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function initAdmin() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird');
    console.log('数据库连接成功');

    // 检查是否已存在管理员
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('管理员用户已存在');
      return;
    }

    // 创建管理员用户
    const adminUser = new User({
      username: '${config.adminUsername}',
      email: '${config.adminEmail}',
      password: '${hashedPassword}',
      role: 'admin',
      bio: '系统管理员'
    });

    await adminUser.save();
    console.log('管理员用户创建成功:', adminUser.username);

  } catch (error) {
    console.error('初始化管理员失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// 运行初始化
initAdmin();
`;
}

function getMaxFileSizeBytes(maxFileSize) {
  const sizeMap = {
    '1MB': 1048576,
    '5MB': 5242880,
    '10MB': 10485760,
    '20MB': 20971520
  };
  return sizeMap[maxFileSize] || 5242880;
}

