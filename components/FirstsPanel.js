'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PageState from './PageState';
import { api } from '@/utils/api';
import { getFullImageUrl, isValidImageUrl } from '@/utils/imageUtils';
import { resolveLocationCover } from '@/utils/habitatCover';
import styles from '@/styles/FirstsTrail.module.css';

function colsForWidth(width) {
  if (width <= 520) return 2;
  if (width <= 760) return 2;
  if (width <= 1100) return 3;
  return 4;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function chunkForSnake(items, cols) {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

function padIndex(index) {
  return String(index + 1).padStart(2, '0');
}

function StepShell({ index, milestone, children }) {
  return (
    <div className={styles.step} style={{ '--step-i': index }}>
      <span className={`${styles.node}${milestone ? ` ${styles.nodeMilestone}` : ''}`}>
        {padIndex(index)}
      </span>
      {children}
    </div>
  );
}

function BirdStepCard({ record, index }) {
  const birdId = record?.bird?._id;
  const name = record?.bird?.name || '未知鸟种';
  const sci = record?.bird?.scientificName || '';
  const rawUrl = record?.bird?.images?.[0]?.url;
  const src = rawUrl ? getFullImageUrl(rawUrl) : '';
  const hasImage = isValidImageUrl(src);
  const milestone = (index + 1) % 50 === 0 || index === 0;
  const body = (
    <>
      <div className={styles.thumb}>
        {hasImage ? (
          <Image
            src={src}
            alt={name}
            width={132}
            height={132}
            unoptimized
            className={styles.thumbImg}
          />
        ) : (
          <div className={styles.thumbPlaceholder}>{name.slice(0, 2)}</div>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.name} title={name}>
          {name}
        </h3>
        {sci ? (
          <p className={styles.sci} data-scientific title={sci}>
            {sci}
          </p>
        ) : null}
        <p
          className={styles.meta}
          title={`${record.location || '地点未知'} · ${formatDate(record.createdAt)}`}
        >
          {formatDate(record.createdAt)}
          {' · '}
          {record.location || '地点未知'}
        </p>
      </div>
    </>
  );

  return (
    <StepShell index={index} milestone={milestone}>
      {birdId ? (
        <Link href={`/birds/${birdId}`} className={styles.card}>
          {body}
        </Link>
      ) : (
        <div className={styles.card}>{body}</div>
      )}
    </StepShell>
  );
}

function LocationStepCard({ record, index, coverUrl }) {
  const milestone = (index + 1) % 20 === 0 || index === 0;
  const name = record.location || '未知地点';
  const raw = String(coverUrl || '').trim();
  const src = raw
    ? raw.startsWith('/habitat/') || raw.startsWith('/cover/')
      ? raw
      : getFullImageUrl(raw)
    : '';
  const hasImage = Boolean(src);
  const href = record.locationId
    ? `/locations/${record.locationId}`
    : `/locations?search=${encodeURIComponent(name)}`;

  const body = (
    <>
      <div className={styles.thumb}>
        {hasImage ? (
          <Image
            src={src}
            alt={name}
            width={132}
            height={132}
            unoptimized
            className={styles.thumbImg}
          />
        ) : (
          <div className={styles.thumbPlaceholder}>{String(name).slice(0, 2)}</div>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.name} title={name}>
          {name}
        </h3>
        <p className={styles.meta}>
          {formatDate(record.firstRecordDate)}
          {' · '}
          {Number.isFinite(record.birdCount) ? `${record.birdCount} 种` : '—'}
        </p>
      </div>
    </>
  );

  return (
    <StepShell index={index} milestone={milestone}>
      <Link href={href} className={styles.card}>
        {body}
      </Link>
    </StepShell>
  );
}

function SnakeTrail({ items, renderStep }) {
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const update = () => setCols(colsForWidth(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const rows = useMemo(() => chunkForSnake(items, cols), [items, cols]);

  return (
    <div className={styles.snake} style={{ '--snake-cols': cols }}>
      {rows.map((row, rowIndex) => {
        const reverse = rowIndex % 2 === 1;
        const baseIndex = rowIndex * cols;
        const showTurn = rowIndex < rows.length - 1;
        return (
          <div key={`row-${rowIndex}`}>
            <div
              className={`${styles.snakeRow}${reverse ? ` ${styles.snakeRowReverse}` : ''}`}
            >
              {row.map((item, colIndex) =>
                renderStep(item, baseIndex + colIndex, `${rowIndex}-${colIndex}`)
              )}
            </div>
            {showTurn ? (
              <div
                className={`${styles.turn}${
                  reverse ? ` ${styles.turnLeft}` : ` ${styles.turnRight}`
                }`}
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function FirstsPanel({
  kind = 'birds',
  year = '',
  yearScopeLabel = '全部年份',
  coverSet = 'watercolor',
}) {
  const [birdFirsts, setBirdFirsts] = useState([]);
  const [locationFirsts, setLocationFirsts] = useState([]);
  const [loading, setLoading] = useState(true);
  const isLocations = kind === 'locations';

  const locationCovers = useMemo(() => {
    const used = new Set();
    const map = new Map();
    locationFirsts.forEach((record, index) => {
      const cover = resolveLocationCover(
        {
          _id: record.locationId || record._id,
          name: record.location,
          type: record.locationType,
          images: record.images,
          environment: record.environment,
        },
        used,
        coverSet
      );
      map.set(record._id || `${record.location}-${index}`, cover?.url || '');
    });
    return map;
  }, [locationFirsts, coverSet]);

  useEffect(() => {
    let cancelled = false;
    const fetchPersonalFirsts = async () => {
      setLoading(true);
      const params = year ? { year } : {};
      try {
        const [birdData, locationData] = await Promise.all([
          api.personal.getBirdFirsts(params),
          api.personal.getLocationFirsts(params),
        ]);
        if (cancelled) return;
        if (birdData.success) {
          setBirdFirsts(Array.isArray(birdData.data) ? birdData.data : []);
        } else {
          setBirdFirsts([]);
        }
        if (locationData.success) {
          setLocationFirsts(Array.isArray(locationData.data) ? locationData.data : []);
        } else {
          setLocationFirsts([]);
        }
      } catch (error) {
        console.error('获取个人初见失败:', error);
        if (!cancelled) {
          setBirdFirsts([]);
          setLocationFirsts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPersonalFirsts();
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div className={styles.panelRoot}>
        <PageState
          type="loading"
          title="初见时刻加载中..."
          message="正在汇总你的首次观察时间。"
        />
      </div>
    );
  }

  if (isLocations) {
    return (
      <div className={styles.panelRoot}>
        <p className={styles.intro}>
          你的地点初见（{yearScopeLabel}）。共 {locationFirsts.length || '—'} 处。点卡片进地点词典。
        </p>
        {locationFirsts.length === 0 ? (
          <div className={styles.empty}>
            <h3>暂无地点初见</h3>
            <p>
              {year
                ? `${year} 年还没有新地点初见。可改「全部」看生涯，或补记带地点的观察。`
                : '添加带地点的观察记录后，会按时间排成这条曲线。'}
            </p>
          </div>
        ) : (
          <SnakeTrail
            items={locationFirsts}
            renderStep={(record, index, key) => (
              <LocationStepCard
                key={key}
                record={record}
                index={index}
                coverUrl={locationCovers.get(record._id || `${record.location}-${index}`)}
              />
            )}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.panelRoot}>
      <p className={styles.intro}>
        你的鸟种初见（{yearScopeLabel}）。共 {birdFirsts.length || '—'} 种。
      </p>
      {birdFirsts.length === 0 ? (
        <div className={styles.empty}>
          <h3>暂无鸟种初见</h3>
          <p>
            {year
              ? `${year} 年还没有新鸟种初见。可改「全部」看生涯，或继续记观察。`
              : '记下观察后，每种鸟的第一次遇见会排成这条曲线。'}
          </p>
        </div>
      ) : (
        <SnakeTrail
          items={birdFirsts}
          renderStep={(record, index, key) => (
            <BirdStepCard key={key} record={record} index={index} />
          )}
        />
      )}
    </div>
  );
}
