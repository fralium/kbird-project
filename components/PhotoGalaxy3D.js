'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from '../styles/PhotoGalaxy3D.module.css';

const LAYOUTS = [
  { id: 'sphere', label: '球形' },
  { id: 'cylinder', label: '圆柱' },
  { id: 'plane', label: '平面' },
];

function layoutPositions(count, layout) {
  const n = Math.max(count, 1);
  const radius = Math.min(340, 90 + Math.sqrt(n) * 28);
  const items = [];

  if (layout === 'cylinder') {
    const cols = Math.max(8, Math.ceil(Math.sqrt(n * 1.8)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowGap = 78;
    for (let i = 0; i < n; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const theta = (col / cols) * Math.PI * 2;
      items.push({
        x: Math.sin(theta) * radius,
        y: (row - (rows - 1) / 2) * rowGap,
        z: Math.cos(theta) * radius,
      });
    }
    return items;
  }

  if (layout === 'plane') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.35)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const gapX = 96;
    const gapY = 74;
    for (let i = 0; i < n; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      items.push({
        x: (col - (cols - 1) / 2) * gapX,
        y: (row - (rows - 1) / 2) * gapY,
        z: Math.sin(col * 0.7 + row * 0.4) * 18,
      });
    }
    return items;
  }

  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    items.push({
      x: Math.cos(theta) * r * radius,
      y: y * radius * 0.92,
      z: Math.sin(theta) * r * radius,
    });
  }
  return items;
}

function projectPoint(x, y, z, rotXDeg, rotYDeg, zoom, perspective) {
  const rx = (rotXDeg * Math.PI) / 180;
  const ry = (rotYDeg * Math.PI) / 180;
  let px = x * zoom;
  let py = y * zoom;
  let pz = z * zoom;
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x1 = px * cosY + pz * sinY;
  const z1 = -px * sinY + pz * cosY;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y2 = py * cosX - z1 * sinX;
  const z2 = py * sinX + z1 * cosX;
  const w = perspective / Math.max(80, perspective - z2);
  return { x: x1 * w, y: y2 * w, z: z2, w };
}

function pickPhotoIndex(clientX, clientY, stage, photos, positions, rot, tileSize) {
  if (!stage || !photos.length) return -1;
  const rect = stage.getBoundingClientRect();
  const cx = clientX - (rect.left + rect.width / 2);
  const cy = clientY - (rect.top + rect.height / 2);
  const halfW = tileSize / 2;
  const halfH = (tileSize * 0.74) / 2;
  let best = -1;
  let bestZ = -Infinity;
  positions.forEach((pos, index) => {
    const projected = projectPoint(pos.x, pos.y, pos.z, rot.x, rot.y, rot.zoom, 1100);
    if (Math.abs(cx - projected.x) <= halfW * projected.w * 1.2 && Math.abs(cy - projected.y) <= halfH * projected.w * 1.2) {
      if (projected.z > bestZ) {
        bestZ = projected.z;
        best = index;
      }
    }
  });
  return best;
}

export default function PhotoGalaxy3D({ photos, onSelect }) {
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const cardRefs = useRef([]);
  const rotRef = useRef({ x: -12, y: 18, zoom: 0.92 });
  const dragRef = useRef({
    active: false,
    moved: false,
    hitIndex: -1,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  });
  const autoRef = useRef(true);
  const hoverRef = useRef(-1);
  const [layout, setLayout] = useState('sphere');
  const [hint, setHint] = useState('');

  const positions = useMemo(() => layoutPositions(photos.length, layout), [photos.length, layout]);
  const tileSize = Math.round(Math.min(108, Math.max(58, 520 / Math.sqrt(Math.max(photos.length, 4)))));

  const applyTransforms = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const { x, y, zoom } = rotRef.current;
    world.style.transform = `translate(-50%, -50%) rotateX(${x}deg) rotateY(${y}deg) scale(${zoom})`;
    cardRefs.current.forEach((node) => {
      if (!node) return;
      const px = Number(node.dataset.x);
      const py = Number(node.dataset.y);
      const pz = Number(node.dataset.z);
      node.style.transform = `translate(-50%, -50%) translate3d(${px}px, ${py}px, ${pz}px) rotateY(${-y}deg) rotateX(${-x}deg)`;
    });
  }, []);

  useEffect(() => {
    applyTransforms();
  }, [applyTransforms, layout, photos.length, positions]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheelNative = (event) => {
      event.preventDefault();
      const next = rotRef.current.zoom + (event.deltaY > 0 ? -0.06 : 0.06);
      rotRef.current.zoom = Math.max(0.45, Math.min(1.7, next));
      applyTransforms();
    };
    stage.addEventListener('wheel', onWheelNative, { passive: false });
    return () => stage.removeEventListener('wheel', onWheelNative);
  }, [applyTransforms]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (autoRef.current && !dragRef.current.active) {
        rotRef.current.y += 0.12;
        applyTransforms();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyTransforms]);

  const onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    const hitIndex = pickPhotoIndex(
      event.clientX,
      event.clientY,
      event.currentTarget,
      photos,
      positions,
      rotRef.current,
      tileSize
    );
    dragRef.current = {
      active: true,
      moved: false,
      hitIndex,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    };
    autoRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const travel = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY);
    if (!drag.moved && travel < 8) return;
    drag.moved = true;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    rotRef.current.y += dx * 0.35;
    rotRef.current.x = Math.max(-72, Math.min(72, rotRef.current.x - dy * 0.28));
    drag.x = event.clientX;
    drag.y = event.clientY;
    applyTransforms();
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    const hitIndex = drag.hitIndex;
    const shouldOpen = drag.active && !drag.moved && hitIndex >= 0;
    drag.active = false;
    drag.hitIndex = -1;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    if (shouldOpen) onSelect?.(hitIndex);
  };

  if (!photos.length) {
    return <p className={styles.empty}>当前筛选没有照片，换一组再试 3D。</p>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <p className={styles.caption}>{hint || '拖拽旋转 · 滚轮远近 · 点击打开大图'}</p>
        <div className="kb-view-seg kb-meta-seg" role="group" aria-label="3D 排布">
          <span className="kb-meta-label">排布</span>
          {LAYOUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`kb-view-tab kb-meta-tab${layout === item.id ? ' is-active' : ''}`}
              aria-pressed={layout === item.id}
              onClick={() => {
                setLayout(item.id);
                rotRef.current = {
                  x: item.id === 'plane' ? -18 : -12,
                  y: item.id === 'plane' ? 0 : 18,
                  zoom: item.id === 'plane' ? 0.78 : 0.92,
                };
                applyTransforms();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="presentation"
      >
        <div ref={worldRef} className={styles.world}>
          {photos.map((photo, index) => {
            const pos = positions[index] || { x: 0, y: 0, z: 0 };
            return (
              <button
                key={`${photo.recordId || photo.source || 'photo'}-${photo.url}-${index}`}
                type="button"
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                className={styles.card}
                data-photo-index={index}
                data-x={pos.x}
                data-y={pos.y}
                data-z={pos.z}
                style={{ width: tileSize, height: Math.round(tileSize * 0.74) }}
                onMouseEnter={() => {
                  hoverRef.current = index;
                  setHint([photo.birdName, photo.location, photo.caption].filter(Boolean).join(' · '));
                }}
                onMouseLeave={() => {
                  if (hoverRef.current === index) {
                    hoverRef.current = -1;
                    setHint('');
                  }
                }}
                aria-label={photo.birdName || photo.caption || '查看照片'}
              >
                <img src={photo.url} alt="" draggable={false} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
