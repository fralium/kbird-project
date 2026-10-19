'use client';

import { useMemo, useState } from 'react';
import styles from '@/styles/PhenologyMonthBar.module.css';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function computePhenologyProfile({ sightings = [], images = [], migrationText = '' } = {}) {
  const buckets = MONTHS.map((m) => ({
    month: m,
    label: `${m}月`,
    sightingCount: 0,
    photoCount: 0,
    places: new Map(),
    behaviors: new Set(),
    years: new Set(),
  }));

  (Array.isArray(sightings) ? sightings : []).forEach((item) => {
    if (!item?.date) return;
    const d = new Date(item.date);
    if (Number.isNaN(d.getTime())) return;
    const idx = d.getMonth();
    const bucket = buckets[idx];
    bucket.sightingCount += 1;
    bucket.years.add(d.getFullYear());
    const locName = String(item?.location?.name || '').trim();
    if (locName) {
      bucket.places.set(locName, (bucket.places.get(locName) || 0) + 1);
    }
    if (Array.isArray(item.behaviorTags)) {
      item.behaviorTags.forEach((tag) => {
        if (tag) bucket.behaviors.add(tag);
      });
    }
  });

  (Array.isArray(images) ? images : []).forEach((img) => {
    if (!img?.date) return;
    // 默认"用户上传"没有真实拍摄日的不计入物候，优先计入文件夹同步或观察记录照片
    const d = new Date(img.date);
    if (Number.isNaN(d.getTime())) return;
    const idx = d.getMonth();
    buckets[idx].photoCount += 1;
  });

  const maxScore = Math.max(
    1,
    ...buckets.map((b) => b.sightingCount + (b.sightingCount === 0 && b.photoCount > 0 ? 0.5 : 0))
  );

  const months = buckets.map((b) => {
    const score = b.sightingCount + (b.sightingCount === 0 && b.photoCount > 0 ? 0.5 : 0);
    let level = 0;
    if (score > 0) {
      const ratio = score / maxScore;
      if (ratio >= 0.66) level = 3;
      else if (ratio >= 0.33) level = 2;
      else level = 1;
    }
    const topPlaces = Array.from(b.places.entries())
      .sort((a, c) => c[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return {
      month: b.month,
      label: b.label,
      sightingCount: b.sightingCount,
      photoCount: b.photoCount,
      hasData: b.sightingCount > 0 || b.photoCount > 0,
      level,
      topPlaces,
      behaviors: Array.from(b.behaviors),
      yearCount: b.years.size,
    };
  });

  const activeMonths = months.filter((m) => m.hasData);
  const peakMonths = [...months]
    .filter((m) => m.sightingCount > 0)
    .sort((a, b) => b.sightingCount - a.sightingCount)
    .slice(0, 2)
    .map((m) => `${m.month}月`);

  const residencyTag =
    String(migrationText || '').match(/留鸟|夏候鸟|冬候鸟|旅鸟|迷鸟|候鸟/)?.[0] || '';

  return {
    months,
    activeMonthCount: activeMonths.length,
    peakLabel: peakMonths.length ? `高频 ${peakMonths.join('、')}` : '',
    residencyTag,
    currentMonth: new Date().getMonth() + 1,
  };
}

export default function PhenologyMonthBar({
  sightings = [],
  images = [],
  migrationText = '',
  compact = false,
  title = '年度物候与出现月份',
}) {
  const profile = useMemo(
    () => computePhenologyProfile({ sightings, images, migrationText }),
    [sightings, images, migrationText]
  );

  const [selectedMonth, setSelectedMonth] = useState(null);

  const activeDetail = useMemo(() => {
    if (selectedMonth) {
      return profile.months.find((m) => m.month === selectedMonth) || null;
    }
    return null;
  }, [profile.months, selectedMonth]);

  if (compact) {
    return (
      <div className={styles.compactWrap} aria-label={title}>
        <div className={styles.compactCells}>
          {profile.months.map((m) => (
            <div
              key={m.month}
              className={`${styles.compactCell} ${styles[`level_${m.level}`]} ${
                m.month === profile.currentMonth ? styles.cellCurrent : ''
              }`}
              title={
                m.hasData
                  ? `${m.label}：观察 ${m.sightingCount} 次${
                      m.topPlaces.length ? `（${m.topPlaces.join('、')}）` : ''
                    }`
                  : `${m.label}：暂无记录`
              }
            >
              <span>{m.month}</span>
            </div>
          ))}
        </div>
        <div className={styles.compactMeta}>
          {profile.residencyTag ? (
            <span className={styles.residencyPill}>{profile.residencyTag}</span>
          ) : null}
          <span>
            {profile.activeMonthCount > 0
              ? `活跃 ${profile.activeMonthCount} 个月${profile.peakLabel ? ` · ${profile.peakLabel}` : ''}`
              : '暂无月份记录'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} aria-label={title}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          {profile.residencyTag ? (
            <span className={styles.residencyPill}>{profile.residencyTag}</span>
          ) : null}
        </div>
        <span className={styles.summary}>
          {profile.activeMonthCount > 0
            ? `已点亮 ${profile.activeMonthCount}/12 个月${
                profile.peakLabel ? ` · ${profile.peakLabel}` : ''
              }`
            : '记一笔或导入带日期的照片后，自动点亮 1–12 月物候格'}
        </span>
      </div>

      <div className={styles.grid}>
        {profile.months.map((m) => {
          const isSelected = selectedMonth === m.month;
          const isCurrent = m.month === profile.currentMonth;
          return (
            <button
              key={m.month}
              type="button"
              onClick={() =>
                setSelectedMonth((prev) => (prev === m.month ? null : m.hasData ? m.month : null))
              }
              className={`${styles.cell} ${styles[`level_${m.level}`]} ${
                isCurrent ? styles.cellCurrent : ''
              } ${isSelected ? styles.cellSelected : ''}`}
              title={
                m.hasData
                  ? `${m.label}：${m.sightingCount} 次观察${
                      m.photoCount ? ` · ${m.photoCount} 张图` : ''
                    }`
                  : `${m.label}：暂无记录`
              }
            >
              <span className={styles.monthNum}>{m.label}</span>
              <span className={styles.monthVal}>
                {m.sightingCount > 0
                  ? `${m.sightingCount}次`
                  : m.photoCount > 0
                  ? `${m.photoCount}图`
                  : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {activeDetail && activeDetail.hasData ? (
        <div className={styles.detailStrip}>
          <strong>{activeDetail.label}</strong>
          <span>
            观察 {activeDetail.sightingCount} 次
            {activeDetail.yearCount > 1 ? `（跨 ${activeDetail.yearCount} 年）` : ''}
            {activeDetail.photoCount > 0 ? ` · 图库 ${activeDetail.photoCount} 张` : ''}
          </span>
          {activeDetail.topPlaces.length > 0 ? (
            <span className={styles.detailPlaces}>
              常见于：{activeDetail.topPlaces.join('、')}
            </span>
          ) : null}
          {activeDetail.behaviors.length > 0 ? (
            <span className={styles.detailBehaviors}>
              状态：{activeDetail.behaviors.join(' · ')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
