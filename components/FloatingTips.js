'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/utils/api';
import styles from '@/styles/FloatingTips.module.css';

const IDENTIFY_TIPS = [
  '先看体型与轮廓，再看颜色细节。',
  '重点观察喙形、腿长、尾型和飞行姿态。',
  '先按生境缩小范围：湿地、林地、农田或城市。',
  '听叫声常比看羽色更稳定，优先记录鸣声节奏。',
];

const DISMISS_KEY = 'kbird.floatingTips.hidden';
const SIDE_KEY = 'kbird.floatingTips.side';
const CLOSE_MS = 240;
const DRAG_PX = 8;

function readDismissed() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(hidden) {
  if (typeof window === 'undefined') return;
  try {
    if (hidden) localStorage.setItem(DISMISS_KEY, '1');
    else localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

function readSide() {
  if (typeof window === 'undefined') return 'right';
  try {
    return localStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

function writeSide(side) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDE_KEY, side);
  } catch {
    // ignore
  }
}

function canHoverOpen() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export default function FloatingTips() {
  const [hidden, setHidden] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [side, setSide] = useState('right');
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('identify');
  const [loading, setLoading] = useState(false);
  const [popularLocations, setPopularLocations] = useState([]);
  const [monthlyBirds, setMonthlyBirds] = useState([]);
  const [monthLabel, setMonthLabel] = useState('');
  const closeTimer = useRef(null);
  const drag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const isOpen = !dragging && (hovering || pinned);

  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);

  useEffect(() => {
    setHidden(readDismissed());
    setSide(readSide());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [monthlyRes, locationsRes] = await Promise.all([
          api.records.getMonthlyObservation({ month: currentMonth, limit: 5 }),
          api.locations.getPopular(5),
        ]);
        if (cancelled) return;

        setMonthlyBirds(Array.isArray(monthlyRes?.data) ? monthlyRes.data : []);
        setMonthLabel(monthlyRes?.meta?.monthLabel || `${currentMonth}月`);
        setPopularLocations(Array.isArray(locationsRes?.data) ? locationsRes.data : []);
      } catch (_error) {
        if (!cancelled) {
          setMonthlyBirds([]);
          setPopularLocations([]);
          setMonthLabel(`${currentMonth}月`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentMonth]);

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openFromPointer = () => {
    if (drag.current.active) return;
    clearClose();
    setHovering(true);
  };

  const scheduleClose = () => {
    clearClose();
    closeTimer.current = setTimeout(() => {
      setHovering(false);
      if (canHoverOpen()) setPinned(false);
    }, CLOSE_MS);
  };

  const handleHide = () => {
    clearClose();
    setHovering(false);
    setPinned(false);
    setHidden(true);
    writeDismissed(true);
  };

  const snapSide = (clientX, persist) => {
    const next = clientX < window.innerWidth / 2 ? 'left' : 'right';
    setSide(next);
    if (persist) writeSide(next);
  };

  const handlePointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    drag.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
  };

  useEffect(() => {
    const onMove = (event) => {
      if (!drag.current.active) return;
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (!drag.current.moved && Math.hypot(dx, dy) < DRAG_PX) return;
      drag.current.moved = true;
      setDragging(true);
      setHovering(false);
      setPinned(false);
      snapSide(event.clientX, false);
    };
    const onUp = (event) => {
      if (!drag.current.active) return;
      const moved = drag.current.moved;
      drag.current.active = false;
      setDragging(false);
      if (moved) {
        snapSide(event.clientX, true);
        return;
      }
      if (!canHoverOpen()) {
        setPinned((prev) => !prev);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  if (!hydrated || hidden) return null;

  const renderContent = () => {
    if (activeTab === 'identify') {
      return (
        <ul className={styles.list}>
          {IDENTIFY_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      );
    }

    if (activeTab === 'monthly') {
      if (loading) return <p className={styles.placeholder}>加载中...</p>;
      if (monthlyBirds.length === 0) return <p className={styles.placeholder}>暂无推荐数据</p>;
      return (
        <>
          <p className={styles.subtle}>{monthLabel} 推荐观察</p>
          <ul className={styles.list}>
            {monthlyBirds.map((bird) => (
              <li key={bird._id}>
                <Link href={`/birds/${bird._id}`} className={styles.link}>
                  {bird.name}
                </Link>
                <span className={styles.meta}>（{bird.recordCount || 0} 条记录）</span>
              </li>
            ))}
          </ul>
        </>
      );
    }

    if (loading) return <p className={styles.placeholder}>加载中...</p>;
    if (popularLocations.length === 0) return <p className={styles.placeholder}>暂无热门地点</p>;
    return (
      <ul className={styles.list}>
        {popularLocations.map((location, index) => {
          const key = location._id || `${location.name}-${index}`;
          const href = location._id
            ? `/locations/${location._id}`
            : `/records?location=${encodeURIComponent(location.name || '')}`;
          return (
            <li key={key}>
              <Link href={href} className={styles.link}>
                {location.name || '未知地点'}
              </Link>
              <span className={styles.meta}>
                （{location.recordCount || location.stats?.totalRecords || 0} 次）
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div
      className={`${styles.wrapper} ${side === 'left' ? styles.left : styles.right} ${
        isOpen ? styles.awake : styles.docked
      }`}
      onMouseEnter={openFromPointer}
      onMouseLeave={scheduleClose}
      onFocusCapture={openFromPointer}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
      }}
    >
      {isOpen ? (
        <div className={styles.panel} role="dialog" aria-label="观鸟小助手" aria-modal="false">
          <div className={styles.header}>
            <strong className={styles.headerTitle}>
              <img src="/logo-wetland.png" alt="" width={20} height={20} className={styles.headerMark} />
              观鸟小助手
            </strong>
            <div className={styles.headerActions}>
              <button type="button" onClick={handleHide} className={styles.hideButton}>
                不再显示
              </button>
            </div>
          </div>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'identify' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('identify')}
            >
              识别技巧
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'monthly' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              本月观察
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'hot' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('hot')}
            >
              热门地点
            </button>
          </div>
          <div className={styles.content}>{renderContent()}</div>
        </div>
      ) : null}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        className={`${styles.fab}${isOpen ? ` ${styles.fabOpen}` : ''}`}
        aria-expanded={isOpen}
        aria-label={isOpen ? '收起观鸟小助手' : '打开观鸟小助手'}
        title="观鸟小助手 · 移近打开 · 拖到左右贴边"
      >
        <img src="/logo-wetland.png" alt="" width={32} height={32} className={styles.fabMark} />
      </button>
    </div>
  );
}
