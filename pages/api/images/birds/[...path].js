import fs from 'fs';
import path from 'path';
import { devError } from '../../../../utils/devLogger';
import { sendMethodNotAllowed } from '../../../../utils/proxyApi';

export default function handler(req, res) {
  const { path: imagePath } = req.query;
  
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  if (!imagePath || !Array.isArray(imagePath)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid path',
      code: 'INVALID_IMAGE_PATH',
    });
  }

  try {
    if (imagePath.some((segment) => segment === '..' || segment.includes('\0'))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'IMAGE_ACCESS_DENIED',
      });
    }

    const allowedDir = path.resolve(process.cwd(), 'public', 'images', 'birds');
    const fullPath = path.resolve(allowedDir, ...imagePath);

    if (fullPath !== allowedDir && !fullPath.startsWith(`${allowedDir}${path.sep}`)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'IMAGE_ACCESS_DENIED',
      });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
        code: 'IMAGE_NOT_FOUND',
      });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypes[ext];
    if (!contentType) {
      return res.status(403).json({
        success: false,
        message: 'Unsupported image type',
        code: 'UNSUPPORTED_IMAGE_TYPE',
      });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (error) {
    devError('Error serving bird image:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'BIRD_IMAGE_SERVE_FAILED',
    });
  }
}
