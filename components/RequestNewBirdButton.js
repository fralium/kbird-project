'use client';

import { useState } from 'react';
import { api } from '../utils/api';

/**
 * 申请将未入库鸟种写入临时档案，成功后通过 onCreated 回传完整 bird。
 */
export default function RequestNewBirdButton({
  name,
  scientificName = '',
  onCreated,
  className = '',
  label,
  compact = false,
}) {
  const [busy, setBusy] = useState(false);
  const trimmed = String(name || '').trim();
  const sci = String(scientificName || '').trim();

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const data = await api.birds.requestNew({
        name: trimmed,
        ...(sci ? { scientificName: sci } : {}),
      });
      if (!data?.success) {
        throw new Error(data?.message || '申请入库失败');
      }
      const bird = data.data?.bird || {
        _id: data.data?.birdId,
        name: data.data?.name || trimmed,
        scientificName: sci || 'Pending sp.',
      };
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(`已申请入库「${bird.name}」，可直接用于记笔`, 'success', 2400);
      }
      if (typeof onCreated === 'function') {
        onCreated(bird, data);
      }
    } catch (error) {
      const msg = error?.message || '申请入库失败';
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(msg, 'error', 2800);
      } else {
        console.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!trimmed) return null;

  const text = label || (compact ? '申请入库' : `申请入库「${trimmed}」`);

  return (
    <button
      type="button"
      className={className}
      onMouseDown={(event) => {
        // 避免父级 input blur 先关掉下拉，导致点不到按钮
        event.preventDefault();
      }}
      onClick={handleClick}
      disabled={busy}
      title={`将「${trimmed}」申请写入鸟种库`}
    >
      {busy ? '申请中…' : text}
    </button>
  );
}
