const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// 允许的文件类型和MIME类型
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

const ALLOWED_EXTENSIONS = Object.values(ALLOWED_IMAGE_TYPES);

// 文件大小限制 (字节)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5; // 最多5个文件

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 生成安全的文件名
const generateSafeFileName = (originalName, userId) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName).toLowerCase();
  
  // 确保扩展名是安全的
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('不支持的文件类型');
  }
  
  return `${userId}_${timestamp}_${randomString}${ext}`;
};

// 文件过滤器
const fileFilter = (req, file, cb) => {
  try {
    // 检查MIME类型
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return cb(new Error('只允许上传图片文件 (JPG, PNG, GIF, WebP)'), false);
    }
    
    // 检查文件扩展名
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('文件扩展名不被支持'), false);
    }
    
    // 检查文件名是否包含危险字符
    const fileName = path.basename(file.originalname, ext);
    if (!/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_\.]+$/.test(fileName)) {
      return cb(new Error('文件名包含非法字符'), false);
    }
    
    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

// 配置存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = path.join(process.cwd(), 'uploads', 'active');
      
      // 确保上传目录存在
      await fs.mkdir(uploadDir, { recursive: true });
      
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const safeFileName = generateSafeFileName(file.originalname, userId);
      cb(null, safeFileName);
    } catch (error) {
      cb(error);
    }
  }
});

// 创建multer实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  }
});

// 文件上传中间件
const uploadImages = upload.array('images', MAX_FILES);

// 单个文件上传中间件
const uploadSingleImage = upload.single('image');

// 文件安全检查中间件
const validateUploadedFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }
    
    const fileChecks = req.files.map(async (file) => {
      try {
        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`文件 ${file.originalname} 过大，最大允许 ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
        
        // 检查文件是否为空
        if (file.size === 0) {
          throw new Error(`文件 ${file.originalname} 为空`);
        }
        
        // 检查文件路径
        if (!file.path || !path.isAbsolute(file.path)) {
          throw new Error(`文件 ${file.originalname} 路径无效`);
        }
        
        // 验证文件确实存在
        try {
          await fs.access(file.path);
        } catch (error) {
          throw new Error(`文件 ${file.originalname} 不存在`);
        }
        
        // 检查文件是否在允许的目录内
        const uploadDir = path.join(process.cwd(), 'uploads');
        const fileDir = path.dirname(file.path);
        if (!fileDir.startsWith(uploadDir)) {
          throw new Error(`文件 ${file.originalname} 路径不安全`);
        }
        
        return true;
      } catch (error) {
        // 删除有问题的文件
        try {
          if (file.path) {
            await fs.unlink(file.path);
          }
        } catch (unlinkError) {
          console.error('删除问题文件失败:', unlinkError);
        }
        throw error;
      }
    });
    
    await Promise.all(fileChecks);
    
    if (isDevelopment) {
      console.log(`✅ 文件上传验证通过: ${req.files.length} 个文件`);
    }
    
    next();
  } catch (error) {
    // 清理所有已上传的文件
    if (req.files) {
      for (const file of req.files) {
        try {
          if (file.path) {
            await fs.unlink(file.path);
          }
        } catch (unlinkError) {
          console.error('清理文件失败:', unlinkError);
        }
      }
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 错误处理中间件
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = '文件上传失败';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `文件过大，最大允许 ${MAX_FILE_SIZE / 1024 / 1024}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = `文件数量过多，最多允许 ${MAX_FILES} 个文件`;
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = '意外的文件字段';
        break;
      case 'LIMIT_PART_COUNT':
        message = '文件部分过多';
        break;
      default:
        message = `文件上传错误: ${error.message}`;
    }
    
    return res.status(400).json({
      success: false,
      message: message
    });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next();
};

// 清理临时文件中间件
const cleanupTempFiles = async (req, res, next) => {
  // 在请求结束时清理临时文件（如果有的话）
  res.on('finish', async () => {
    if (req.files && req.files.length > 0) {
      // 这里可以添加额外的清理逻辑
      if (isDevelopment) {
        console.log(`🧹 请求结束，清理 ${req.files.length} 个上传文件`);
      }
    }
  });
  
  next();
};

module.exports = {
  uploadImages,
  uploadSingleImage,
  validateUploadedFiles,
  handleUploadError,
  cleanupTempFiles,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILES
};



