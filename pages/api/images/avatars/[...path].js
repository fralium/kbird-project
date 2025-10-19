import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { path: filePath } = req.query;
  
  if (!filePath || !Array.isArray(filePath)) {
    return res.status(400).json({ message: 'Invalid file path' });
  }

  try {
    // 构建文件路径
    const fileName = filePath.join('/');
    const fullPath = path.join(process.cwd(), 'public', 'images', 'avatars', fileName);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.log('头像文件不存在:', fullPath);
      return res.status(404).json({ message: 'Avatar file not found' });
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
    console.error('头像文件服务错误:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}








