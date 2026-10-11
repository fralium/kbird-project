'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/utils/api';
import { getFullImageUrl } from '@/utils/imageUtils';
import styles from '@/styles/SpeciesHoverChip.module.css';

/** @type {Map<string, { url: string|null } | { loading: Promise<string|null> }>} */
const imageCache = new Map();

function pickImageUrl(birds, name) {
  const list = Array.isArray(birds) ? birds : [];
  const key = String(name || '').trim();
  if (!key) return null;
  // 只取本种（主名或别名命中），禁止退回到搜索结果里其它有图的鸟
  const match = list.find((bird) => {
    if (!bird) return false;
    if (String(bird.name || '').trim() === key) return true;
    return (Array.isArray(bird.nameAliases) ? bird.nameAliases : []).some(
      (alias) => String(alias || '').trim() === key
    );
  });
  const raw = match?.images?.[0]?.url || '';
  return raw ? getFullImageUrl(raw) : null;
}

async function resolveBirdImage(name) {
  const key = String(name || '').trim();
  if (!key) return null;

  const cached = imageCache.get(key);
  if (cached && 'url' in cached) return cached.url;
  if (cached && 'loading' in cached) return cached.loading;

  const loading = (async () => {
    try {
      const data = await api.birds.getAll({ search: key, limit: '8' });
      const url = data?.success ? pickImageUrl(data.data, key) : null;
      imageCache.set(key, { url });
      return url;
    } catch {
      imageCache.set(key, { url: null });
      return null;
    }
  })();

  imageCache.set(key, { loading });
  return loading;
}

function placePreview(anchorRect, previewW = 200, previewH = 168) {
  if (typeof window === 'undefined' || !anchorRect) {
    return { left: 0, top: 0, placement: 'above' };
  }
  const gap = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchorRect.left + anchorRect.width / 2 - previewW / 2;
  left = Math.max(8, Math.min(left, vw - previewW - 8));

  const spaceAbove = anchorRect.top;
  const spaceBelow = vh - anchorRect.bottom;
  const preferAbove = spaceAbove >= previewH + gap || spaceAbove >= spaceBelow;
  let top;
  let placement;
  if (preferAbove) {
    top = anchorRect.top - previewH - gap;
    placement = 'above';
    if (top < 8) {
      top = anchorRect.bottom + gap;
      placement = 'below';
    }
  } else {
    top = anchorRect.bottom + gap;
    placement = 'below';
    if (top + previewH > vh - 8) {
      top = Math.max(8, anchorRect.top - previewH - gap);
      placement = 'above';
    }
  }
  return { left, top, placement };
}

/**
 * 鸟名悬停出图鉴照片。
 * - 默认 span；可传 href → Link，onClick → button
 * - 嵌在外层 button 内时设 focusable={false}，避免非法嵌套焦点
 */
export default function SpeciesHoverChip({
  name,
  className = '',
  title,
  children,
  href,
  onClick,
  focusable = true,
}) {
  const chipRef = useRef(null);
  const hideTimer = useRef(null);
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [coords, setCoords] = useState({ left: 0, top: 0, placement: 'above' });
  const [mounted, setMounted] = useState(false);

  const label = String(
    name || (typeof children === 'string' || typeof children === 'number' ? children : '') || ''
  ).trim();

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    const rect = chipRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords(placePreview(rect));
  }, []);

  const show = useCallback(async () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!label) return;

    updatePosition();
    setOpen(true);

    const cached = imageCache.get(label);
    if (cached && 'url' in cached) {
      setImageUrl(cached.url);
      setLoading(false);
      return;
    }

    setLoading(true);
    const url = await resolveBirdImage(label);
    setImageUrl(url);
    setLoading(false);
    updatePosition();
  }, [label, updatePosition]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setOpen(false);
    }, 120);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  if (!label) return null;

  const chipClass = [className, styles.chip, open ? styles.chipOpen : '']
    .filter(Boolean)
    .join(' ');

  const canFocus = focusable && !href && !onClick;
  const triggerProps = {
    ref: chipRef,
    className: chipClass,
    title: title || label,
    'aria-describedby': open ? labelId : undefined,
    onMouseEnter: show,
    onMouseLeave: scheduleHide,
    ...(canFocus
      ? { tabIndex: 0, onFocus: show, onBlur: scheduleHide }
      : href || onClick
        ? { onFocus: show, onBlur: scheduleHide }
        : {}),
  };

  const content = children ?? label;

  let trigger;
  if (href) {
    trigger = (
      <Link href={href} {...triggerProps}>
        {content}
      </Link>
    );
  } else if (onClick) {
    trigger = (
      <button type="button" onClick={onClick} {...triggerProps}>
        {content}
      </button>
    );
  } else {
    trigger = <span {...triggerProps}>{content}</span>;
  }

  return (
    <>
      {trigger}
      {mounted && open
        ? createPortal(
            <div
              className={`${styles.preview} ${
                coords.placement === 'below' ? styles.previewBelow : styles.previewAbove
              }`}
              style={{ left: coords.left, top: coords.top }}
              role="tooltip"
              id={labelId}
              onMouseEnter={show}
              onMouseLeave={scheduleHide}
            >
              <div className={styles.previewMedia}>
                {loading ? (
                  <div className={styles.previewState}>加载中…</div>
                ) : imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={label}
                    fill
                    sizes="200px"
                    unoptimized
                    className={styles.previewImg}
                  />
                ) : (
                  <div className={styles.previewState}>暂无照片</div>
                )}
              </div>
              <div className={styles.previewCaption}>{label}</div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
