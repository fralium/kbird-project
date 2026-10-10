import { useMemo } from 'react';
import Image from 'next/image';

/**
 * 根据标识符生成稳定的随机颜色
 * @param {string} identifier - 标识符（如birdId）
 * @returns {string} - 十六进制颜色代码
 */
function getColorFromIdentifier(identifier) {
  if (!identifier) {
    identifier = Math.random().toString();
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
 * 带随机颜色的Logo组件
 * @param {string} identifier - 用于生成稳定颜色的标识符（如birdId）
 * @param {number} size - Logo尺寸，默认64
 * @param {string} className - 额外的CSS类名
 */
export default function ColoredLogo({ identifier, size = 64, className = '' }) {
  const backgroundColor = useMemo(() => {
    return getColorFromIdentifier(identifier);
  }, [identifier]);
  
  // 如果传入了 className，说明要填充容器，使用容器大小；否则使用指定的 size
  const containerSize = className ? null : size;
  const logoSize = containerSize ? containerSize * 0.6 : '60%';
  
  return (
    <div 
      className={className}
      style={{
        ...(containerSize ? { width: containerSize, height: containerSize } : { width: '100%', height: '100%' }),
        borderRadius: size * 0.2,
        background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}dd)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Image 
        src="/logo.png" 
        alt="KBird Logo"
        width={typeof logoSize === 'number' ? logoSize : size}
        height={typeof logoSize === 'number' ? logoSize : size}
        unoptimized
        style={{
          width: typeof logoSize === 'number' ? logoSize : logoSize,
          height: typeof logoSize === 'number' ? logoSize : logoSize,
          objectFit: 'contain',
          opacity: 0.9,
        }}
        onError={(e) => {
          // 如果logo加载失败，显示emoji作为后备
          e.target.style.display = 'none';
          const parent = e.target.parentElement;
          if (parent && !parent.querySelector('.fallback-emoji')) {
            const emoji = document.createElement('div');
            emoji.className = 'fallback-emoji';
            emoji.textContent = '🐦';
            emoji.style.cssText = `
              font-size: ${size * 0.6}px;
              line-height: ${size * 0.6}px;
              color: white;
            `;
            parent.appendChild(emoji);
          }
        }}
      />
    </div>
  );
}
