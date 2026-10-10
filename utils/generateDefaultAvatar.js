import fs from 'fs';
import path from 'path';

/**
 * 根据用户ID或文件名生成一个稳定的随机颜色
 * @param {string} identifier - 用户ID或文件名
 * @returns {string} - 十六进制颜色代码
 */
function getColorFromIdentifier(identifier) {
  if (!identifier) {
    // 如果没有标识符，使用时间戳生成随机颜色
    identifier = Date.now().toString();
  }
  
  // 使用简单的哈希函数生成颜色
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 生成明亮但不过于鲜艳的颜色
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 50 + (Math.abs(hash) % 15); // 50-65%
  
  // 转换为RGB
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  
  let r, g, b;
  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 从文件名中提取用户ID
 * @param {string} fileName - 文件名，格式如：user_68be830cbbf82569e9235ac8_1757689048012_xxx.png
 * @returns {string|null} - 用户ID
 */
function extractUserIdFromFileName(fileName) {
  if (!fileName) return null;
  
  // 文件名格式：user_{userId}_{timestamp}_{originalName}
  const match = fileName.match(/^user_([a-f0-9]{24})_/);
  return match ? match[1] : null;
}

/**
 * 生成默认头像SVG
 * @param {string} identifier - 用户ID或文件名（用于生成稳定颜色）
 * @param {number} size - 头像尺寸，默认200
 * @returns {string} - SVG字符串
 */
export function generateDefaultAvatarSVG(identifier = null, size = 200) {
  // 如果identifier是文件名，尝试提取用户ID
  let userId = identifier;
  if (identifier && identifier.includes('user_')) {
    userId = extractUserIdFromFileName(identifier);
  }
  
  const backgroundColor = getColorFromIdentifier(userId || identifier);
  
  // 尝试读取logo并转换为base64
  let logoBase64 = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    }
  } catch (error) {
    console.log('无法读取logo文件，将使用emoji:', error.message);
  }
  
  // 创建SVG
  let svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${backgroundColor}dd;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bgGradient)" rx="${size * 0.2}"/>
  `;
  
  // 如果有logo，嵌入logo；否则使用emoji
  if (logoBase64) {
    const logoSize = size * 0.6;
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;
    svg += `
      <image 
        x="${logoX}" 
        y="${logoY}" 
        width="${logoSize}" 
        height="${logoSize}" 
        href="data:image/png;base64,${logoBase64}"
        opacity="0.9"
      />
    `;
  } else {
    // 使用emoji作为后备
    svg += `
      <text 
        x="${size / 2}" 
        y="${size / 2 + size * 0.15}" 
        font-family="Arial, sans-serif" 
        font-size="${size * 0.6}" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        opacity="0.9"
      >🐦</text>
    `;
  }
  
  svg += `</svg>`;
  
  return svg.trim();
}

/**
 * 生成默认头像（返回SVG Buffer）
 * @param {string} identifier - 用户ID或文件名（用于生成稳定颜色）
 * @param {number} size - 头像尺寸，默认200
 * @returns {Buffer} - SVG Buffer
 */
export function generateDefaultAvatar(identifier = null, size = 200) {
  const svg = generateDefaultAvatarSVG(identifier, size);
  return Buffer.from(svg);
}
