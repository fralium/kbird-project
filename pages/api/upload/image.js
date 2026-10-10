import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { devError, devLog } from '../../../utils/devLogger';
import { sendMethodNotAllowed } from '../../../utils/proxyApi';

// 禁用默认的body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim()) {
    return String(secret).trim();
  }
  throw new Error('JWT_SECRET_NOT_CONFIGURED');
}

function authenticateRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('MISSING_BEARER_TOKEN');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('MISSING_BEARER_TOKEN');
  }
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (!decoded?.id) {
    throw new Error('INVALID_TOKEN_PAYLOAD');
  }
}

// Next.js API代理路由 - 通用图片上传
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  try {
    authenticateRequest(req);
    devLog('开始处理上传请求...');
    
    // 确保uploads/active目录存在
    const uploadDir = './uploads/active';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 使用formidable 3.x的新API
    const ALLOWED_MIME = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      multiples: false,
      filter: function ({name, originalFilename, mimetype}) {
        devLog('文件过滤:', { name, originalFilename, mimetype });
        if (!mimetype || !ALLOWED_MIME.has(mimetype)) return false;
        const ext = path.extname(originalFilename || '').toLowerCase();
        if (ext && !ALLOWED_EXT.has(ext)) return false;
        return true;
      }
    });

    devLog('开始解析表单数据...');
    
    // 使用Promise包装form.parse
    const parseForm = () => new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve([fields, files]);
        }
      });
    });
    
    const [fields, files] = await parseForm();
    devLog('表单解析完成:', { fields, files });
    
    if (!files.image || !files.image[0]) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件',
        code: 'MISSING_UPLOAD_FILE',
      });
    }

    const uploadedFile = files.image[0];

    const mime = uploadedFile.mimetype || '';
    const fileExtension = path.extname(uploadedFile.originalFilename || '').toLowerCase();
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    if (!mimeToExt[mime]) {
      try {
        fs.unlinkSync(uploadedFile.filepath);
      } catch {
        // ignore cleanup failure
      }
      return res.status(400).json({
        success: false,
        message: '只允许上传图片文件 (JPG, PNG, GIF, WebP)',
        code: 'INVALID_UPLOAD_TYPE',
      });
    }

    const safeExt = ALLOWED_EXT.has(fileExtension) ? fileExtension : mimeToExt[mime];
    const fileName = `upload_${Date.now()}_${Math.round(Math.random() * 1E9)}${safeExt}`;
    const newPath = path.join('./uploads/active', fileName);
    
    // 移动文件到新位置
    fs.renameSync(uploadedFile.filepath, newPath);
    
    // 返回文件信息
    res.status(200).json({
      success: true,
      message: '图片上传成功',
      data: {
        filename: fileName,
        originalName: uploadedFile.originalFilename,
        size: uploadedFile.size,
        url: `/uploads/active/${fileName}`
      }
    });
  } catch (error) {
    devError('图片上传错误:', error);
    if (error.message === 'MISSING_BEARER_TOKEN' || error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.message === 'INVALID_TOKEN_PAYLOAD') {
      return res.status(401).json({
        success: false,
        message: '未授权访问，请先登录',
        code: 'UNAUTHORIZED',
      });
    }
    if (error.message === 'JWT_SECRET_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        message: '服务器鉴权配置不完整，请联系管理员',
        code: 'JWT_SECRET_NOT_CONFIGURED',
      });
    }
    res.status(500).json({
      success: false,
      message: '服务器错误',
      code: 'UPLOAD_IMAGE_PROXY_FAILED',
    });
  }
}
