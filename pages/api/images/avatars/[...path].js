import fs from 'fs';
import path from 'path';
import { generateDefaultAvatar } from '@/utils/generateDefaultAvatar';
import { devError, devLog } from '@/utils/devLogger';
import { sendMethodNotAllowed } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const { path: filePath } = req.query;
  
  if (!filePath || !Array.isArray(filePath)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file path',
      code: 'INVALID_AVATAR_PATH',
    });
  }

  try {
    // 构建文件路径 - 支持从uploads目录读取
    const fileName = filePath.join('/');
    // eslint-disable-next-line global-require
    const { getAvatarsRoot } = require('@/utils/kbirdDataPaths');
    const uploadsAvatarDir = getAvatarsRoot();
    const publicAvatarDir = path.resolve(process.cwd(), 'public', 'images', 'avatars');
    const fullPath = resolveAvatarPath(fileName, [uploadsAvatarDir, publicAvatarDir]);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      devLog('头像文件不存在:', fullPath);
      
      // 生成默认头像（使用logo + 随机颜色）
      try {
        const defaultAvatarBuffer = generateDefaultAvatar(fileName, 200);
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', defaultAvatarBuffer.length);
        return res.status(200).send(defaultAvatarBuffer);
      } catch (error) {
        devError('生成默认头像失败:', error);
        
        // 如果生成失败，尝试返回静态默认头像
        const defaultAvatarPath = path.join(process.cwd(), 'public', 'default-avatar.png');
        if (fs.existsSync(defaultAvatarPath)) {
          const defaultBuffer = fs.readFileSync(defaultAvatarPath);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.status(200).send(defaultBuffer);
        }
        
        return res.status(404).json({
          success: false,
          message: 'Avatar file not found',
          code: 'AVATAR_NOT_FOUND',
        });
      }
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(fullPath);
    
    // 设置正确的Content-Type
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }

    // 设置缓存头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', fileBuffer.length);

    // 返回文件内容
    res.status(200).send(fileBuffer);
    
  } catch (error) {
    devError('头像文件服务错误:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'AVATAR_SERVE_FAILED',
    });
  }
}

function resolveAvatarPath(fileName, allowedDirs) {
  for (const allowedDir of allowedDirs) {
    const resolvedPath = path.resolve(allowedDir, fileName);
    const isInAllowedDir = resolvedPath === allowedDir || resolvedPath.startsWith(`${allowedDir}${path.sep}`);
    if (!isInAllowedDir) {
      continue;
    }
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  return path.resolve(allowedDirs[0], '__not_found__');
}








