'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import styles from '@/styles/FootprintOrbit3D.module.css';

const PERSPECTIVE = 1100;

function layoutSphere(count) {
  const n = Math.max(count, 1);
  const radius = Math.min(220, 64 + Math.sqrt(n) * 28);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const items = [];
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    items.push({
      x: Math.cos(theta) * r * radius,
      y: y * radius * 0.9,
      z: Math.sin(theta) * r * radius,
    });
  }
  return items;
}

/** 手动投影，避免父级 overflow 把 CSS preserve-3d 压扁 */
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

export default function FootprintOrbit3D({
  points = [],
  selectedKey = '',
  onSelect,
  height = 420,
}) {
  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const positionsRef = useRef([]);
  const rotRef = useRef({ x: -14, y: 22, zoom: 0.95 });
  const dragRef = useRef({ active: false, moved: false, x: 0, y: 0 });
  const autoRef = useRef(!selectedKey);
  const selectedRef = useRef(selectedKey);

  const positions = useMemo(() => layoutSphere(points.length), [points.length]);
  positionsRef.current = positions;

  const syncAuto = useCallback(() => {
    autoRef.current = !selectedRef.current;
  }, []);

  const applyTransforms = useCallback(() => {
    const { x, y, zoom } = rotRef.current;
    const layout = positionsRef.current;
    cardRefs.current.forEach((node, index) => {
      if (!node) return;
      const pos = layout[index];
      if (!pos) return;
      const p = projectPoint(pos.x, pos.y, pos.z, x, y, zoom, PERSPECTIVE);
      const scale = Math.max(0.55, Math.min(1.4, p.w));
      const depth = Math.max(0.4, Math.min(1, 0.55 + p.z / 360));
      node.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) scale(${scale})`;
      node.style.opacity = String(depth);
      node.style.zIndex = String(Math.round(500 + p.z));
    });
  }, []);

  useEffect(() => {
    selectedRef.current = selectedKey;
    syncAuto();
  }, [selectedKey, syncAuto]);

  useLayoutEffect(() => {
    applyTransforms();
  }, [applyTransforms, points.length, positions]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      rotRef.current.zoom = Math.max(
        0.5,
        Math.min(1.6, rotRef.current.zoom + (event.deltaY > 0 ? -0.05 : 0.05))
      );
      applyTransforms();
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [applyTransforms]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (autoRef.current && !dragRef.current.active) {
        rotRef.current.y += 0.1;
        applyTransforms();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyTransforms]);

  if (!points.length) {
    return (
      <div className={styles.empty} style={{ height }}>
        暂无点位
      </div>
    );
  }

  const endDrag = () => {
    dragRef.current.active = false;
    syncAuto();
  };

  return (
    <div
      className={styles.stage}
      style={{ height }}
      ref={stageRef}
      onPointerDown={(e) => {
        if (e.button != null && e.button !== 0) return;
        autoRef.current = false;
        dragRef.current = { active: true, moved: false, x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragRef.current.moved = true;
        dragRef.current.x = e.clientX;
        dragRef.current.y = e.clientY;
        rotRef.current.y += dx * 0.35;
        rotRef.current.x = Math.max(-60, Math.min(60, rotRef.current.x - dy * 0.3));
        applyTransforms();
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <div className={styles.world}>
        {points.map((p, index) => {
          const active = selectedKey && selectedKey === p.key;
          return (
            <button
              key={p.key || index}
              type="button"
              className={`${styles.dot}${active ? ` ${styles.dotActive}` : ''}`}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              title={`${p.name} · ${p.speciesCount || 0} 种`}
              onPointerDown={(e) => {
                e.stopPropagation();
                dragRef.current = { active: false, moved: false, x: e.clientX, y: e.clientY };
                autoRef.current = false;
              }}
              onClick={(e) => {
                e.stopPropagation();
                autoRef.current = false;
                selectedRef.current = p.key;
                onSelect?.(p);
              }}
            >
              <span className={styles.dotCore} />
              <span className={styles.dotLabel}>{p.name}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>
        {selectedKey
          ? '已暂停自转 · 拖拽可手动转 · 右侧查看详情'
          : '拖拽旋转 · 滚轮缩放 · 点击选点暂停'}
      </p>
    </div>
  );
}
