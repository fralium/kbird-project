import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req, res) {
  const { path: imagePath } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!imagePath || !Array.isArray(imagePath)) {
    return res.status(400).json({ message: 'Invalid path' });
  }

  try {
    // 构建完整的文件路径
    const fullPath = path.join(process.cwd(), 'public', 'images', 'birds', ...imagePath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // 检查文件是否在允许的目录内（安全防护）
    const allowedDir = path.join(process.cwd(), 'public', 'images', 'birds');
    const resolvedPath = path.resolve(fullPath);
    const resolvedAllowedDir = path.resolve(allowedDir);
    
    if (!resolvedPath.startsWith(resolvedAllowedDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 获取文件扩展名以确定Content-Type
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // 读取并发送文件
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}








