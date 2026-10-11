'use client';

import { useEffect, useMemo, useRef } from 'react';
import styles from '@/styles/SpeciesWordCloud.module.css';

const MAX_WORDS = 100;

/* 偏柔和的多色，邻近词易区分 */
const PALETTE = [
  '#7cb342',
  '#5c6bc0',
  '#26a69a',
  '#ef5350',
  '#ab47bc',
  '#42a5f5',
  '#8d6e63',
  '#ec407a',
  '#66bb6a',
  '#ffa726',
  '#78909c',
  '#7e57c2',
  '#29b6f6',
  '#d4a373',
  '#43a047',
  '#5e35b1',
];

function hashInt(name, salt = 0) {
  let h = salt >>> 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0);
  }
  return h;
}

function pickColor(name) {
  return PALETTE[hashInt(name) % PALETTE.length];
}

function measure(ctx, text, fontSize, fontWeight) {
  ctx.font = `${fontWeight} ${fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const m = ctx.measureText(text);
  return {
    w: Math.ceil(m.width + 2),
    h: Math.ceil(fontSize * 1.12),
  };
}

function overlaps(a, b, pad = 2) {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

/**
 * 稳定伪随机打乱：大词仍优先放置，中小词交错，视觉更「乱」。
 */
function chaosOrder(list) {
  if (list.length <= 3) return list;
  const head = list.slice(0, 3);
  const rest = list.slice(3).map((item, i) => ({ item, i, k: hashInt(item.name, i + 17) }));
  rest.sort((a, b) => {
    const bandA = Math.floor(a.i / 4);
    const bandB = Math.floor(b.i / 4);
    if (bandA !== bandB) return bandA - bandB;
    return a.k - b.k;
  });
  return [...head, ...rest.map((r) => r.item)];
}

/**
 * 鸟种记录热度词云：矩形铺满、横竖混排、字号按次数。
 */
export default function SpeciesWordCloud({
  items = [],
  maxWords = MAX_WORDS,
  className = '',
  emptyTip = '暂无鸟种记录',
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  const words = useMemo(() => {
    const limit = Math.min(Math.max(Number(maxWords) || MAX_WORDS, 1), MAX_WORDS);
    const list = (Array.isArray(items) ? items : [])
      .map((item) => ({
        name: String(item?.name || '').trim(),
        value: Number(item?.count ?? item?.value ?? 0) || 0,
        birdId: item?.birdId || '',
      }))
      .filter((item) => item.name && item.value > 0)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, limit);

    if (!list.length) return [];

    const maxV = list[0].value;
    const minV = list[list.length - 1].value;
    const span = Math.max(1, maxV - minV);

    const sized = list.map((word, index) => {
      const t = (word.value - minV) / span;
      const fontSize = Math.round(10 + t * 22); // 10–32
      const fontWeight = t > 0.6 ? 700 : t > 0.3 ? 650 : 600;
      // 约 1/3 竖排（短名优先），制造混乱感
      const vertical =
        index > 0 &&
        word.name.length <= 5 &&
        (hashInt(word.name, 9) % 3 === 0 || (index % 5 === 2 && word.name.length <= 4));
      return {
        ...word,
        fontSize,
        fontWeight,
        color: pickColor(word.name),
        vertical,
      };
    });

    return chaosOrder(sized);
  }, [items, maxWords]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, wrap.clientWidth || 720);
      // 矩形：偏扁长，约 100 词可铺满
      const height = Math.max(280, Math.min(420, Math.round(width * 0.52)));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (!words.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 14px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emptyTip, width / 2, height / 2);
        return;
      }

      const placed = [];
      const cx = width / 2;
      const cy = height / 2;
      const margin = 6;

      const tryPlace = (candidate) => {
        if (
          candidate.x < margin ||
          candidate.y < margin ||
          candidate.x + candidate.w > width - margin ||
          candidate.y + candidate.h > height - margin
        ) {
          return false;
        }
        return !placed.some((p) => overlaps(p, candidate));
      };

      words.forEach((word) => {
        const { w, h } = measure(ctx, word.name, word.fontSize, word.fontWeight);
        const boxW = word.vertical ? h : w;
        const boxH = word.vertical ? w : h;

        let best = null;
        // 椭圆螺旋：按画布宽高比扩展，避免铺成正圆
        const rx = Math.max(8, (width - boxW) / 2 - margin);
        const ry = Math.max(8, (height - boxH) / 2 - margin);
        let angle = hashInt(word.name, 3) % 360;
        const maxTries = 1600;

        for (let tryN = 0; tryN < maxTries; tryN += 1) {
          const t = tryN * 0.0115; // 0 → 铺满矩形外接椭圆
          const rad = (angle * Math.PI) / 180;
          const candidate = {
            x: cx + Math.cos(rad) * t * rx - boxW / 2,
            y: cy + Math.sin(rad) * t * ry - boxH / 2,
            w: boxW,
            h: boxH,
          };
          if (tryPlace(candidate)) {
            best = candidate;
            break;
          }
          angle += 19;
        }

        // 补扫整幅矩形（含边角），进一步铺满
        if (!best) {
          const stepX = Math.max(6, Math.floor(boxW * 0.32));
          const stepY = Math.max(5, Math.floor(boxH * 0.38));
          const ox = hashInt(word.name, 11) % stepX;
          const oy = hashInt(word.name, 13) % stepY;
          outer: for (let y = margin + oy; y <= height - margin - boxH; y += stepY) {
            for (let x = margin + ox; x <= width - margin - boxW; x += stepX) {
              const candidate = { x, y, w: boxW, h: boxH };
              if (tryPlace(candidate)) {
                best = candidate;
                break outer;
              }
            }
          }
        }

        if (!best) return;
        placed.push(best);

        ctx.save();
        ctx.fillStyle = word.color;
        ctx.font = `${word.fontWeight} ${word.fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textBaseline = 'middle';
        if (word.vertical) {
          ctx.translate(best.x + best.w / 2, best.y + best.h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.fillText(word.name, 0, 0);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(word.name, best.x, best.y + best.h / 2);
        }
        ctx.restore();
      });
    };

    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    if (ro) ro.observe(wrap);
    window.addEventListener('resize', draw);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [words, emptyTip]);

  return (
    <div ref={wrapRef} className={`${styles.root} ${className}`.trim()}>
      <canvas ref={canvasRef} role="img" aria-label="鸟种记录热度词云" />
    </div>
  );
}
