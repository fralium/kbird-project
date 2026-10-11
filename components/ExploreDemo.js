'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import SimplePageHeader, { HeaderTextLink } from './SimplePageHeader';
import PageState from './PageState';
import data from '@/data/exploreDemo/leping';
import speciesOrders from '@/data/exploreDemo/speciesOrders';
import { getExploreProject } from '@/data/exploreDemo/projects';
import { getOrderChineseName } from '@/data/taxonomyTranslation';
import ExploreLedgerPanel, {
  ExploreLedgerSummaryCard,
  PlotHabitatGallery,
  useLinkedPlot,
} from './ExploreLedgerPanel';
import {
  buildLiveSpecies,
  monthsWithReports,
  seasonCoverage,
  matchPlotKeyFromText,
  checklistStorageKey,
  planFoldStorageKey,
  recordedStatusLabel,
} from './exploreLive';
import SpeciesHoverChip from './SpeciesHoverChip';
import BirdSearchField from './BirdSearchField';
import OrderBrowseGrid from './OrderBrowseGrid';
import { speciesMatchesSearch } from '@/utils/clientPinyinMatch';
import { BIRD_SEARCH_PLACEHOLDER_TAXON } from '@/utils/birdSearchUi';
import styles from '@/styles/ExploreDemo.module.css';

const TABS = [
  { id: 'overview', label: '总览' },
  { id: 'targets', label: '目标名录' },
  { id: 'plots', label: '样区档案' },
  { id: 'seasons', label: '季节与样线' },
  { id: 'plan', label: '计划与攻关' },
  { id: 'ledger', label: '实地档案' },
];

const LEVEL_FILTERS = [
  { id: 'all', label: '全部等级' },
  { id: '重点目标', label: '重点目标' },
  { id: '少见', label: '少见' },
  { id: '中等', label: '中等' },
  { id: '常见', label: '常见' },
  { id: '探索', label: '探索' },
];

const STATUS_FILTERS = [
  { id: 'all', label: '全部状态' },
  { id: 'pending', label: '待发现' },
  { id: 'recorded', label: '已记录' },
];

const RESIDENCE_FILTERS = [
  { id: 'all', label: '全部居留' },
  { id: '留鸟', label: '留鸟' },
  { id: '夏候鸟', label: '夏候鸟' },
  { id: '冬候鸟', label: '冬候鸟' },
  { id: '旅鸟', label: '旅鸟' },
];

const PLOT_FIELD_ORDER = [
  '样区名称',
  '位置/范围',
  '中心坐标/海拔',
  '面积估计',
  '生境介绍',
  '关键微生境',
  '到达方式',
  '调查历史',
  '累计鸟种数',
  '过往重要记录',
  '代表鸟种(稳定)',
  '高光/保护鸟种',
  '可能存在鸟种(预测)',
  '季节使用建议',
  '威胁与干扰',
  '保护管理建议',
  '备注',
];

function levelBadgeClass(level) {
  if (level === '重点目标') return styles.badgeKey;
  if (level === '少见') return styles.badgeRare;
  if (level === '探索') return styles.badgePending;
  if (level === '中等') return styles.badgeMid;
  if (level === '常见') return styles.badgeCommon;
  return styles.badgeCommon;
}

function protectionBadgeClass(protection) {
  if (protection === '国一') return styles.badgeProtectI;
  return styles.badgeProtect;
}

function MonthDots({ months }) {
  return (
    <span className={styles.monthDots} title="1–12 月出现概率">
      {(months || []).map((m, i) => {
        const cls =
          m === '●'
            ? `${styles.monthDot} ${styles.monthDotOn}`
            : m === '○'
              ? `${styles.monthDot} ${styles.monthDotEdge}`
              : styles.monthDot;
        return <span key={i} className={cls} />;
      })}
    </span>
  );
}

function speciesOrderKey(bird) {
  const map = speciesOrders?.default || speciesOrders || {};
  return map[bird.name] || 'Unclassified';
}

function orderLabel(orderKey) {
  if (!orderKey || orderKey === 'Unclassified') return '未分类';
  return getOrderChineseName(orderKey) || orderKey;
}

function filterSpeciesByBrowse(filterId, list = data.species) {
  switch (filterId) {
    case 'total':
      return list;
    case 'recorded':
      return list.filter((s) => s.recorded);
    case 'pending':
      return list.filter((s) => !s.recorded);
    case 'keyTargets':
      return list.filter((s) => s.targetLevel === '重点目标');
    case 'keyConfirmed':
      return list.filter((s) => s.targetLevel === '重点目标' && s.recorded);
    case 'keyPending':
      return list.filter((s) => s.targetLevel === '重点目标' && !s.recorded);
    case 'waterbirds':
      return list.filter((s) => s.group === '水鸟');
    case 'forestFarm':
      return list.filter((s) => s.group === '林鸟/农田');
    case 'raptors':
      return list.filter((s) => s.group === '猛禽');
    case 'resident':
      return list.filter((s) => s.residence === '留鸟');
    case 'summer':
      return list.filter((s) => s.residence === '夏候鸟');
    case 'winter':
      return list.filter((s) => s.residence === '冬候鸟');
    case 'passage':
      return list.filter((s) => s.residence === '旅鸟');
    case 'national':
      return list.filter(
        (s) => s.protection === '国一' || s.protection === '国二',
      );
    default:
      return [];
  }
}

function groupByOrder(speciesList) {
  const map = new Map();
  for (const bird of speciesList) {
    const key = speciesOrderKey(bird);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(bird);
  }
  return Array.from(map.entries())
    .map(([order, birds]) => ({
      order,
      label: orderLabel(order),
      latin: order === 'Unclassified' ? '' : order,
      birds: birds.slice().sort((a, b) => (a.no || 0) - (b.no || 0)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh'));
}

function SpeciesBrowsePanel({ browse, onClose, speciesList = data.species }) {
  const [q, setQ] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');

  useEffect(() => {
    setQ('');
    setSelectedOrder('');
  }, [browse?.id]);

  const groups = useMemo(() => {
    if (!browse) return [];
    const query = q.trim().toLowerCase();
    const base = filterSpeciesByBrowse(browse.id, speciesList).filter((s) => {
      if (!query) return true;
      return speciesMatchesSearch(s, query, {
        orderLabel: orderLabel(speciesOrderKey(s)),
      });
    });
    return groupByOrder(base).map((g) => {
      const recorded = g.birds.filter((b) => b.recorded).length;
      const total = g.birds.length;
      const pct = total ? Math.round((recorded / total) * 100) : 0;
      return {
        ...g,
        recorded,
        total,
        pct,
        complete: total > 0 && recorded === total,
      };
    });
  }, [browse, q, speciesList]);

  const selectedGroup = groups.find((g) => g.order === selectedOrder) || null;
  const totalShown = groups.reduce((n, g) => n + g.total, 0);

  if (!browse) return null;

  const toggleOrder = (order) => {
    setSelectedOrder((prev) => (prev === order ? '' : order));
  };

  return (
    <div className={styles.browsePanel} aria-live="polite">
      <div className={styles.browsePanelHead}>
        <div>
          <h3 className={styles.browseTitle}>{browse.title}</h3>
          <p className={styles.browseMeta}>
            {totalShown} 种 · {groups.length} 个目
            {browse.hint ? ` · ${browse.hint}` : ''}
          </p>
        </div>
        <button type="button" className={styles.browseClose} onClick={onClose}>
          收起
        </button>
      </div>

      <div className={styles.browseToolbar}>
        <BirdSearchField
          className={styles.search}
          placeholder={BIRD_SEARCH_PLACEHOLDER_TAXON}
          value={q}
          onChange={setQ}
          size="sm"
          roundedRect
        />
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>没有匹配的鸟种</p>
      ) : (
        <>
          <OrderBrowseGrid
            cards={groups.map((g) => ({
              key: g.order,
              label: g.label,
              latin: g.latin,
              stat: `${g.recorded}/${g.total} ${g.pct}%`,
              pct: g.pct,
              done: g.complete,
              active: selectedOrder === g.order,
            }))}
            emptyText="没有匹配的鸟种"
            emptyClassName={styles.empty}
            onSelect={(card) => toggleOrder(card.key)}
          />

          {selectedGroup ? (
            <div className={styles.orderDetail}>
              <div className={styles.orderDetailHead}>
                <div>
                  <strong>{selectedGroup.label}</strong>
                  {selectedGroup.latin ? (
                    <em className={styles.orderCardLatin}> {selectedGroup.latin}</em>
                  ) : null}
                  <span className={styles.browseMeta}>
                    {' '}
                    · {selectedGroup.recorded}/{selectedGroup.total} 已记录
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.browseClose}
                  onClick={() => setSelectedOrder('')}
                >
                  收起本目
                </button>
              </div>
              <div className={styles.speciesGrid}>
                {selectedGroup.birds.map((bird) => (
                  <article
                    key={bird.no}
                    className={`${styles.speciesCard} ${
                      bird.recorded ? styles.speciesCardRecorded : styles.speciesCardPending
                    }`}
                  >
                    <div className={styles.speciesCardTop}>
                      <span className={styles.speciesName}>{bird.name}</span>
                      {bird.recorded ? (
                        <span className={`${styles.badge} ${styles.badgeOk}`}>
                          {recordedStatusLabel(bird)}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgePending}`}>
                          {recordedStatusLabel(bird)}
                        </span>
                      )}
                    </div>
                    {bird.scientific ? (
                      <em className={styles.speciesSci}>{bird.scientific}</em>
                    ) : null}
                    <div className={styles.speciesMeta}>
                      {bird.residence ? (
                        <span className={`${styles.metaChip} ${styles.chipResidence}`}>
                          {bird.residence}
                        </span>
                      ) : null}
                      {bird.targetLevel ? (
                        <span
                          className={`${styles.badge} ${levelBadgeClass(bird.targetLevel)}`}
                        >
                          {bird.targetLevel}
                        </span>
                      ) : null}
                      {bird.protection ? (
                        <span
                          className={`${styles.badge} ${protectionBadgeClass(bird.protection)}`}
                        >
                          {bird.protection}
                        </span>
                      ) : null}
                    </div>
                    {bird.zone ? <p className={styles.speciesZone}>{bird.zone}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.browseHint}>点击上方目卡片，展开该目鸟种</p>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  value,
  label,
  detail = '',
  onClick,
  clickable = true,
  active = false,
}) {
  if (!clickable) {
    return (
      <div className={`${styles.metric} ${styles.metricStatic}`}>
        <span className={styles.metricValue}>{value}</span>
        <span className={styles.metricLabel}>{label}</span>
        {detail ? <span className={styles.metricDetail}>{detail}</span> : null}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.metric} ${styles.metricClickable} ${
        active ? styles.metricActive : ''
      }`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
      {detail ? <span className={styles.metricDetail}>{detail}</span> : null}
      <span className={styles.metricHint}>{active ? '点击收起' : '点击展开'}</span>
    </button>
  );
}

function OverviewPanel({ project, live }) {
  const m = data.metrics;
  const speciesList = live?.species || data.species;
  const recorded = live?.recorded ?? speciesList.filter((s) => s.recorded).length;
  const keyConfirmed =
    live?.keyConfirmed ??
    speciesList.filter((s) => s.targetLevel === '重点目标' && s.recorded)
      .length;
  const keyTargets = live?.keyTargets ?? m.keyTargets;
  const filledPlots = data.plots.filter((p) => p['样区名称']).length;
  const [browse, setBrowse] = useState(null);

  const toggleBrowse = (id, title, hint = '') => {
    setBrowse((prev) => (prev?.id === id ? null : { id, title, hint }));
  };

  return (
    <>
      {project?.linkedPlotId || project?.linkedPlotTitle ? (
        <ExploreLedgerSummaryCard
          linkedPlotId={project.linkedPlotId}
          linkedPlotTitle={project.linkedPlotTitle}
        />
      ) : null}

      <section className={`${styles.panel} ${styles.panelCentered}`}>
        <h2 className={styles.panelTitle}>调研进度</h2>
        <p className={styles.panelHint}>
          {data.meta.region} · 点卡片展开目级进度
          {live?.hasLivePlot
            ? '；已记录已与自留地对消'
            : '；自留地未连通时用名录基线'}
        </p>
        <div className={styles.metricGrid}>
          <MetricCard
            value={m.total}
            label="收录鸟种"
            active={browse?.id === 'total'}
            onClick={() => toggleBrowse('total', '收录鸟种', '全境名录')}
          />
          <MetricCard
            value={recorded}
            label="已记录（名录∪自留地）"
            active={browse?.id === 'recorded'}
            onClick={() => toggleBrowse('recorded', '已记录鸟种')}
          />
          <MetricCard
            value={m.total - recorded}
            label="待发现"
            active={browse?.id === 'pending'}
            onClick={() => toggleBrowse('pending', '待发现鸟种')}
          />
          <MetricCard
            value={`${keyConfirmed}/${keyTargets}`}
            label="重点目标"
            active={browse?.id === 'keyTargets'}
            onClick={() => toggleBrowse('keyTargets', '重点目标')}
          />
          <MetricCard
            value={`${filledPlots}/${data.plots.length}`}
            label="样区档案已填"
            clickable={false}
          />
        </div>
        {browse &&
        ['total', 'recorded', 'pending', 'keyTargets'].includes(browse.id) ? (
          <SpeciesBrowsePanel
            browse={browse}
            onClose={() => setBrowse(null)}
            speciesList={speciesList}
          />
        ) : null}
      </section>

      <section className={`${styles.panel} ${styles.panelCentered}`}>
        <h2 className={styles.panelTitle}>类群与居留速览</h2>
        <p className={styles.panelHint}>点击卡片展开目级进度卡，再点某一目查看鸟种</p>
        <div className={styles.metricGrid}>
          <MetricCard
            value={m.waterbirds}
            label="水鸟"
            active={browse?.id === 'waterbirds'}
            onClick={() => toggleBrowse('waterbirds', '水鸟')}
          />
          <MetricCard
            value={m.forestFarm}
            label="林鸟 / 农田"
            active={browse?.id === 'forestFarm'}
            onClick={() => toggleBrowse('forestFarm', '林鸟 / 农田')}
          />
          <MetricCard
            value={m.raptors}
            label="猛禽"
            active={browse?.id === 'raptors'}
            onClick={() => toggleBrowse('raptors', '猛禽')}
          />
          <MetricCard
            value={m.resident}
            label="留鸟"
            active={browse?.id === 'resident'}
            onClick={() => toggleBrowse('resident', '留鸟')}
          />
          <MetricCard
            value={m.summer}
            label="夏候鸟"
            active={browse?.id === 'summer'}
            onClick={() => toggleBrowse('summer', '夏候鸟')}
          />
          <MetricCard
            value={m.winter}
            label="冬候鸟"
            active={browse?.id === 'winter'}
            onClick={() => toggleBrowse('winter', '冬候鸟')}
          />
          <MetricCard
            value={m.passage}
            label="旅鸟"
            active={browse?.id === 'passage'}
            onClick={() => toggleBrowse('passage', '旅鸟')}
          />
          <MetricCard
            value={`${m.national1}+${m.national2}`}
            label="国一 / 国二"
            active={browse?.id === 'national'}
            onClick={() => toggleBrowse('national', '国家重点保护鸟种', '国一与国二')}
          />
        </div>
        {browse &&
        [
          'waterbirds',
          'forestFarm',
          'raptors',
          'resident',
          'summer',
          'winter',
          'passage',
          'national',
        ].includes(browse.id) ? (
          <SpeciesBrowsePanel
            browse={browse}
            onClose={() => setBrowse(null)}
            speciesList={speciesList}
          />
        ) : null}
      </section>
    </>
  );
}

function TargetsPanel({
  speciesList = data.species,
  initialQ = '',
  linkedPlot = null,
  onOpenBird,
}) {
  const [q, setQ] = useState(initialQ || '');
  const [level, setLevel] = useState('all');
  const [status, setStatus] = useState('all');
  const [residence, setResidence] = useState('all');
  const [group, setGroup] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState('');

  useEffect(() => {
    if (initialQ) setQ(initialQ);
  }, [initialQ]);

  const groups = useMemo(() => {
    const set = new Set(speciesList.map((s) => s.group).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [speciesList]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return speciesList.filter((s) => {
      if (level !== 'all' && s.targetLevel !== level) return false;
      if (status === 'recorded' && !s.recorded) return false;
      if (status === 'pending' && s.recorded) return false;
      if (residence !== 'all' && s.residence !== residence) return false;
      if (group !== 'all' && s.group !== group) return false;
      if (!query) return true;
      return speciesMatchesSearch(s, query, {
        orderLabel: orderLabel(speciesOrderKey(s)),
      });
    });
  }, [q, level, status, residence, group, speciesList]);

  const orderGroups = useMemo(
    () =>
      groupByOrder(filtered).map((g) => {
        const recorded = g.birds.filter((b) => b.recorded).length;
        const total = g.birds.length;
        const pct = total ? Math.round((recorded / total) * 100) : 0;
        return {
          ...g,
          recorded,
          total,
          pct,
          complete: total > 0 && recorded === total,
        };
      }),
    [filtered]
  );

  useEffect(() => {
    if (!selectedOrder) return;
    if (!orderGroups.some((g) => g.order === selectedOrder)) {
      setSelectedOrder('');
    }
  }, [orderGroups, selectedOrder]);

  const selectedGroup = orderGroups.find((g) => g.order === selectedOrder) || null;

  return (
    <div className={styles.seasonsModule}>
      <PlotHabitatGallery plot={linkedPlot} />
      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            一
          </span>
          <div className={styles.checkHeadMain}>
            <div>
              <h2 className={styles.smTitle}>按目浏览</h2>
              <p className={styles.smHint}>
                筛重点 / 待发现；已记录 #N = 自留地种级表按最早发现排序
              </p>
            </div>
            <p className={styles.listMeta}>
              {filtered.length}/{speciesList.length} 种 · {orderGroups.length}{' '}
              目
            </p>
          </div>
        </header>

        <div className={styles.filterBar}>
          <BirdSearchField
            className={styles.search}
            placeholder={BIRD_SEARCH_PLACEHOLDER_TAXON}
            value={q}
            onChange={setQ}
            size="sm"
            roundedRect
          />
          <select
            className={styles.select}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label="类群"
          >
            {groups.map((g) => (
              <option key={g} value={g}>
                {g === 'all' ? '全部类群' : g}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterStrip}>
          <div className={`${styles.filterGroup} ${styles.filterGroupLevel}`}>
            <span className={styles.filterLabel}>等级</span>
            <div className={styles.chipRow} role="group" aria-label="目标等级">
              {LEVEL_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.chip} ${
                    level === f.id ? styles.chipActive : ''
                  }`}
                  onClick={() => setLevel(f.id)}
                >
                  {f.label.replace('全部等级', '全部')}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`${styles.filterGroup} ${styles.filterGroupResidence}`}
          >
            <span className={styles.filterLabel}>居留</span>
            <div className={styles.chipRow} role="group" aria-label="居留型">
              {RESIDENCE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.chip} ${
                    residence === f.id ? styles.chipActive : ''
                  }`}
                  onClick={() => setResidence(f.id)}
                >
                  {f.label.replace('全部居留', '全部')}
                </button>
              ))}
            </div>
          </div>
          <div className={`${styles.filterGroup} ${styles.filterGroupStatus}`}>
            <span className={styles.filterLabel}>状态</span>
            <div className={styles.chipRow} role="group" aria-label="记录状态">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.chip} ${
                    status === f.id ? styles.chipActive : ''
                  }`}
                  onClick={() => setStatus(f.id)}
                >
                  {f.label.replace('全部状态', '全部')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {orderGroups.length === 0 ? (
          <p className={styles.empty}>没有匹配的鸟种</p>
        ) : (
          <>
            <OrderBrowseGrid
              cards={orderGroups.map((g, i) => ({
                key: g.order,
                label: g.label,
                latin: g.latin,
                mark: String(i + 1).padStart(2, '0'),
                stat: `${g.recorded}/${g.total} ${g.pct}%`,
                pct: g.pct,
                done: g.complete,
                active: selectedOrder === g.order,
              }))}
              emptyText="没有匹配的鸟种"
              emptyClassName={styles.empty}
              onSelect={(card) =>
                setSelectedOrder((prev) => (prev === card.key ? '' : card.key))
              }
            />

            {selectedGroup ? (
              <div className={styles.orderDetail}>
                <div className={styles.orderDetailHead}>
                  <div>
                    <strong>{selectedGroup.label}</strong>
                    {selectedGroup.latin ? (
                      <em className={styles.orderCardLatin}>
                        {' '}
                        {selectedGroup.latin}
                      </em>
                    ) : null}
                    <span className={styles.browseMeta}>
                      {' '}
                      · {selectedGroup.recorded}/{selectedGroup.total} 已记录
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.browseClose}
                    onClick={() => setSelectedOrder('')}
                  >
                    收起本目
                  </button>
                </div>
                <div className={styles.speciesGrid}>
                  {selectedGroup.birds.map((bird) => (
                    <article
                      key={bird.no}
                      className={`${styles.speciesCard} ${
                        bird.recorded
                          ? styles.speciesCardRecorded
                          : styles.speciesCardPending
                      }`}
                    >
                      <div className={styles.speciesCardTop}>
                        {onOpenBird ? (
                          <button
                            type="button"
                            className={styles.speciesNameBtn}
                            onClick={() => onOpenBird(bird.name)}
                          >
                            {bird.name}
                          </button>
                        ) : (
                          <span className={styles.speciesName}>{bird.name}</span>
                        )}
                        {bird.recorded ? (
                          <span
                            className={`${styles.badge} ${styles.badgeOk}`}
                          >
                            {recordedStatusLabel(bird)}
                          </span>
                        ) : (
                          <span
                            className={`${styles.badge} ${styles.badgePending}`}
                          >
                            {recordedStatusLabel(bird)}
                          </span>
                        )}
                      </div>
                      {bird.scientific ? (
                        <em className={styles.speciesSci}>{bird.scientific}</em>
                      ) : null}
                      <div className={styles.speciesMeta}>
                        {bird.residence ? (
                          <span className={`${styles.metaChip} ${styles.chipResidence}`}>
                            {bird.residence}
                          </span>
                        ) : null}
                        {bird.targetLevel ? (
                          <span
                            className={`${styles.badge} ${levelBadgeClass(
                              bird.targetLevel,
                            )}`}
                          >
                            {bird.targetLevel}
                          </span>
                        ) : null}
                        {bird.protection ? (
                          <span
                            className={`${styles.badge} ${protectionBadgeClass(
                              bird.protection,
                            )}`}
                          >
                            {bird.protection}
                          </span>
                        ) : null}
                      </div>
                      {bird.zone ? (
                        <p className={styles.speciesZone}>{bird.zone}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.browseHint}>
                点击目卡片展开该目鸟种；下方明细表含居留型与月份
              </p>
            )}
          </>
        )}
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            二
          </span>
          <div>
            <h2 className={styles.smTitle}>名录明细表</h2>
            <p className={styles.smHint}>
              居留 · 月份 · 目标 · 保护 · 状态 · 分区（当前筛选{' '}
              {filtered.length} 种）
            </p>
          </div>
        </header>
        {filtered.length === 0 ? (
          <p className={styles.empty}>没有匹配的鸟种</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>鸟种</th>
                  <th>学名</th>
                  <th>居留</th>
                  <th>月份</th>
                  <th>目标</th>
                  <th>保护</th>
                  <th>状态</th>
                  <th>优势分区</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.no}>
                    <td>{s.no}</td>
                    <td className={styles.nameCell}>
                      {onOpenBird ? (
                        <button
                          type="button"
                          className={styles.speciesNameBtn}
                          onClick={() => onOpenBird(s.name)}
                        >
                          {s.name}
                        </button>
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className={styles.sciCell}>
                      <em>{s.scientific || '—'}</em>
                    </td>
                    <td>{s.residence || '—'}</td>
                    <td>
                      <MonthDots months={s.months} />
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${levelBadgeClass(
                          s.targetLevel,
                        )}`}
                      >
                        {s.targetLevel || '—'}
                      </span>
                    </td>
                    <td>
                      {s.protection ? (
                        <span
                          className={`${styles.badge} ${protectionBadgeClass(
                            s.protection,
                          )}`}
                        >
                          {s.protection}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {s.recorded ? (
                        <span
                          className={`${styles.badge} ${styles.badgeOk}`}
                        >
                          {recordedStatusLabel(s)}
                        </span>
                      ) : (
                        <span
                          className={`${styles.badge} ${styles.badgePending}`}
                        >
                          {recordedStatusLabel(s)}
                        </span>
                      )}
                    </td>
                    <td>{s.zone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const PLOT_FIELD_GROUPS = [
  {
    id: 'basic',
    title: '基本概况',
    fields: ['样区名称', '位置/范围', '中心坐标/海拔', '面积估计', '到达方式'],
  },
  {
    id: 'habitat',
    title: '生境与微生境',
    fields: ['生境介绍', '关键微生境', '季节使用建议'],
  },
  {
    id: 'manage',
    title: '威胁与管理',
    fields: ['威胁与干扰', '保护管理建议'],
  },
  {
    id: 'birds',
    title: '调查与记录',
    fields: ['调查历史', '累计鸟种数', '过往重要记录', '备注'],
  },
];

function splitNames(text) {
  return String(text || '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/白喉林鹟已有基础上加/g, '白喉林鹟、')
    .split(/[、,，;；/／|｜]+/)
    .map((s) =>
      s
        .trim()
        .replace(/^[\s·•\-—–]+|[\s·•\-—–]+$/g, '')
        .replace(/等$/g, ''),
    )
    .filter((s) => {
      if (!s || s.length > 14) return false;
      if (s.length < 2 && s !== '鹗') return false;
      if (/[0-9]/.test(s)) return false;
      if (
        /(灌丛|草坡|竹林|林缘|库面|沙洲|石林|崖壁|稻田|山地|清单|验证|基础上|注意|区分|名录|待补)/.test(
          s,
        )
      )
        return false;
      return /^[\u4e00-\u9fff䴙䴘鹟鹀鹬鸮雉鹎鹨鸥鹭雁鸭雕鹰隼䳭鴷䴕]+$/.test(s);
    });
}

function highlightChips(text) {
  return splitNames(text).slice(0, 12);
}

/** Clickable bird name chip — jumps via onOpenBird or plain span; hover shows photo. */
function BirdNameChip({
  name,
  tone = 'default',
  recorded = null,
  onOpenBird,
}) {
  const toneClass =
    tone === 'stable'
      ? styles.birdChipStable
      : tone === 'key'
        ? styles.birdChipKey
        : tone === 'predict'
          ? styles.birdChipPredict
          : styles.targetChip;
  const recordedClass =
    recorded === true
      ? styles.birdChipRecorded
      : recorded === false
        ? styles.birdChipUnrecorded
        : '';
  const className = onOpenBird
    ? `${toneClass} ${styles.birdChipBtn} ${recordedClass}`
    : `${toneClass} ${recordedClass}`;
  return (
    <SpeciesHoverChip
      name={name}
      className={className}
      title={onOpenBird ? `查看「${name}」` : name}
      onClick={onOpenBird ? () => onOpenBird(name) : undefined}
    />
  );
}

function PlotLinkChip({ label, plotKey, onOpenPlot }) {
  if (onOpenPlot && plotKey) {
    return (
      <button
        type="button"
        className={`${styles.metaChip} ${styles.birdChipBtn}`}
        onClick={() => onOpenPlot(plotKey)}
        title={`打开样区「${label}」`}
      >
        {label}
      </button>
    );
  }
  return <span className={styles.metaChip}>{label}</span>;
}

function isPlotPlaceholder(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  // Strip fill-in / annotation brackets; keep real content (e.g. 约估坐标、面积〔待核实〕)
  const core = v
    .replace(/〔填[^〕]*〕/g, '')
    .replace(/〔待[^〕]*〕/g, '')
    .replace(/^[/\s—–-]+|[/\s—–-]+$/g, '')
    .trim();
  if (!core) return true;
  if (
    /^(待补|待填|未填|待建|待核|尚无或待核|待踏勘)$/.test(core) ||
    (/^(待补|待填|未填|待建|待核|待踏勘)/.test(core) && core.length <= 10)
  ) {
    return true;
  }
  return false;
}

function splitPlotClauses(text) {
  return String(text || '')
    .split(/[；;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function PlotFact({ label, value }) {
  const empty = isPlotPlaceholder(value);
  return (
    <div className={`${styles.plotFact} ${empty ? styles.plotFactEmpty : ''}`}>
      <span className={styles.plotFactLabel}>{label}</span>
      <p className={styles.plotFactValue}>{empty ? '待补' : value}</p>
    </div>
  );
}

function PlotDossier({ plot, linkedPlotId = '' }) {
  const microItems = splitPlotClauses(plot['关键微生境']);
  const recordItems = splitPlotClauses(plot['过往重要记录']).filter(
    (item) => !isPlotPlaceholder(item),
  );
  const linkedReports = Array.isArray(plot.关联报告) ? plot.关联报告 : [];
  const habitatEmpty = isPlotPlaceholder(plot['生境介绍']);
  const seasonEmpty = isPlotPlaceholder(plot['季节使用建议']);
  const threatEmpty = isPlotPlaceholder(plot['威胁与干扰']);
  const manageEmpty = isPlotPlaceholder(plot['保护管理建议']);
  const historyEmpty = isPlotPlaceholder(plot['调查历史']);
  const countEmpty = isPlotPlaceholder(plot['累计鸟种数']);
  const noteEmpty = isPlotPlaceholder(plot['备注']);

  return (
    <>
      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            二
          </span>
          <div>
            <h2 className={styles.smTitle}>基本概况</h2>
            <p className={styles.smHint}>
              坐标 · 面积 · 到达（名称与位置已在上方）
            </p>
          </div>
        </header>
        <div className={styles.plotFactRow}>
          <PlotFact label="中心坐标 / 海拔" value={plot['中心坐标/海拔']} />
          <PlotFact label="面积估计" value={plot['面积估计']} />
          <PlotFact label="到达方式" value={plot['到达方式']} />
        </div>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            三
          </span>
          <div>
            <h2 className={styles.smTitle}>生境与季节</h2>
            <p className={styles.smHint}>先读生境，再按微生境与季节窗口出工</p>
          </div>
        </header>
        <div className={styles.dossierStack}>
          <div className={styles.dossierProseBlock}>
            <span className={styles.smLabel}>生境介绍</span>
            <p className={habitatEmpty ? styles.fieldEmpty : styles.dossierProse}>
              {habitatEmpty ? '待踏勘补写' : plot['生境介绍']}
            </p>
          </div>
          {microItems.length > 0 ? (
            <div>
              <span className={styles.smLabel}>关键微生境</span>
              <ul className={styles.microList}>
                {microItems.map((item) => {
                  const m = item.match(/^(.+?)[（(](.+?)[）)]$/);
                  return (
                    <li key={item} className={styles.microItem}>
                      <span className={styles.microPlace}>
                        {m ? m[1].trim() : item}
                      </span>
                      {m ? (
                        <span className={styles.microBirds}>{m[2].trim()}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div
            className={`${styles.seasonCallout} ${
              seasonEmpty ? styles.seasonCalloutEmpty : ''
            }`}
          >
            <span className={styles.smLabel}>季节使用建议</span>
            <p>{seasonEmpty ? '待补季节窗口' : plot['季节使用建议']}</p>
          </div>
        </div>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            四
          </span>
          <div>
            <h2 className={styles.smTitle}>威胁与管理</h2>
            <p className={styles.smHint}>干扰源与保护动作对照</p>
          </div>
        </header>
        <div className={styles.dossierTwin}>
          <article
            className={`${styles.dossierSide} ${
              threatEmpty ? styles.dossierSidePending : styles.dossierSideWarn
            }`}
          >
            <div className={styles.dossierSideTop}>
              <span className={styles.smLabel}>威胁与干扰</span>
              <span className={styles.dossierStatus}>
                {threatEmpty ? '待填' : '已记'}
              </span>
            </div>
            <p>
              {threatEmpty
                ? '采砂 / 钓鱼 / 放牧 / 施工 / 游人…'
                : plot['威胁与干扰']}
            </p>
          </article>
          <article
            className={`${styles.dossierSide} ${
              manageEmpty ? styles.dossierSidePending : styles.dossierSideOk
            }`}
          >
            <div className={styles.dossierSideTop}>
              <span className={styles.smLabel}>保护管理建议</span>
              <span className={styles.dossierStatus}>
                {manageEmpty ? '待填' : '已记'}
              </span>
            </div>
            <p>{manageEmpty ? '待补现场管理建议' : plot['保护管理建议']}</p>
          </article>
        </div>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            五
          </span>
          <div>
            <h2 className={styles.smTitle}>调查与记录</h2>
            <p className={styles.smHint}>
              {linkedReports.length > 0
                ? '对照表归口报告；点编号打开自留地对应报告'
                : '出工基线与高光凭证'}
            </p>
          </div>
        </header>

        <div className={styles.plotSurveyStats}>
          <div className={styles.plotSurveyStat}>
            <strong>{linkedReports.length}</strong>
            <span>归口报告</span>
          </div>
          <div className={styles.plotSurveyStat}>
            <strong>
              {linkedReports.length > 0
                ? Math.max(...linkedReports.map((r) => r.speciesCount || 0)) ||
                  '—'
                : '—'}
            </strong>
            <span>单次最高种数</span>
          </div>
          <div className={styles.plotSurveyStat}>
            <strong className={styles.plotSurveyStatWide}>
              {countEmpty ? '待建点' : plot['累计鸟种数'] || '—'}
            </strong>
            <span>累计 / 基线</span>
          </div>
        </div>

        {linkedReports.length > 0 ? (
          <div className={styles.plotReportTableWrap}>
            <table className={styles.plotReportTable}>
              <thead>
                <tr>
                  <th>报告</th>
                  <th>时间</th>
                  <th>地点</th>
                  <th>种数</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {linkedReports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {linkedPlotId ? (
                        <Link
                          href={`/records/plots/${linkedPlotId}/reports/${encodeURIComponent(r.id)}`}
                          className={styles.ledgerLink}
                        >
                          #{r.id}
                        </Link>
                      ) : (
                        <span className={styles.ledgerLink}>#{r.id}</span>
                      )}
                    </td>
                    <td>{r.time || '—'}</td>
                    <td>{r.location || '—'}</td>
                    <td>{r.speciesCount ? `${r.speciesCount}` : '—'}</td>
                    <td className={styles.plotReportNote}>
                      {[r.observer, r.note].filter(Boolean).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.dossierStack}>
            <p className={historyEmpty ? styles.fieldEmpty : styles.dossierProse}>
              {historyEmpty ? '尚无对照表归口报告' : plot['调查历史']}
            </p>
            {recordItems.filter((item) => !/^#\d{10,}/.test(item)).length >
            0 ? (
              <div>
                <span className={styles.smLabel}>过往重要记录</span>
                <ul className={styles.recordList}>
                  {recordItems
                    .filter((item) => !/^#\d{10,}/.test(item))
                    .map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {!noteEmpty ? (
          <div className={styles.dossierNote}>
            <span className={styles.smLabel}>备注</span>
            <p className={styles.dossierProse}>{plot['备注']}</p>
          </div>
        ) : null}
      </section>
    </>
  );
}

function PlotsPanel({
  linkedPlotId = '',
  initialPlotKey = '',
  speciesList = data.species,
  onOpenBird,
  onPlotChange,
}) {
  const filledCount = data.plots.filter((p) => p['样区名称']).length;
  const filledIdx = data.plots.findIndex((p) => p['样区名称']);
  const initialIdx = (() => {
    if (!initialPlotKey) return filledIdx >= 0 ? filledIdx : 0;
    const byKey = data.plots.findIndex(
      (p) =>
        p.key === initialPlotKey ||
        String(p['样区名称'] || '').includes(initialPlotKey) ||
        p.key.includes(initialPlotKey),
    );
    return byKey >= 0 ? byKey : filledIdx >= 0 ? filledIdx : 0;
  })();
  const [idx, setIdx] = useState(initialIdx);
  const plot = data.plots[idx] || data.plots[0];
  const filled = Boolean(plot?.['样区名称']);
  const predicted = splitNames(plot?.['可能存在鸟种(预测)']);
  const highlights = splitNames(plot?.['高光/保护鸟种']);
  const stables = splitNames(plot?.['代表鸟种(稳定)']);
  const mapExtra = splitNames(plot?.['地图判读新增预测']).filter(
    (n) => !predicted.includes(n),
  );
  const predictedAll = [...predicted, ...mapExtra];
  const recordedMap = useMemo(() => {
    const m = new Map();
    for (const s of speciesList) m.set(s.name, Boolean(s.recorded));
    return m;
  }, [speciesList]);

  useEffect(() => {
    if (!initialPlotKey) return;
    const byKey = data.plots.findIndex(
      (p) =>
        p.key === initialPlotKey ||
        String(p['样区名称'] || '').includes(initialPlotKey) ||
        p.key.includes(initialPlotKey),
    );
    if (byKey >= 0) setIdx(byKey);
  }, [initialPlotKey]);

  const selectPlot = (i) => {
    setIdx(i);
    const p = data.plots[i];
    if (p?.key && onPlotChange) onPlotChange(p.key);
  };

  return (
    <div className={styles.seasonsModule}>
      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            选
          </span>
          <div className={styles.checkHeadMain}>
            <div>
              <h2 className={styles.smTitle}>样区切换</h2>
              <p className={styles.smHint}>
                旗舰先填透，再扩其余点位；鸟种芯片可跳名录
              </p>
            </div>
            <p className={styles.listMeta}>
              已填 {filledCount}/{data.plots.length}
            </p>
          </div>
        </header>
        <div className={styles.plotPicker}>
          {data.plots.map((p, i) => {
            const ok = Boolean(p['样区名称']);
            return (
              <button
                key={p.key}
                type="button"
                className={`${styles.plotBtn} ${
                  idx === i ? styles.plotBtnActive : ''
                } ${ok ? '' : styles.plotBtnEmpty}`}
                onClick={() => selectPlot(i)}
              >
                <span className={styles.itemMark}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{p.key.replace('(样例)', '')}</span>
                <span
                  className={ok ? styles.plotBadgeOk : styles.plotBadgeEmpty}
                >
                  {ok ? '已建档' : '待填'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {!filled ? (
        <section className={styles.smBlock}>
          <div className={styles.emptyPlotBox}>
            <p className={styles.emptyPlotTitle}>「{plot.key}」档案尚未填写</p>
            <p className={styles.empty}>
              建议按旗舰样区字段补齐：位置范围、生境、调查历史、代表种、高光种、可能存在种、季节建议。
            </p>
            <div className={styles.emptyPlotChecklist}>
              {PLOT_FIELD_GROUPS.map((g) => (
                <div key={g.id} className={styles.emptyPlotGroup}>
                  <strong>{g.title}</strong>
                  <span>{g.fields.join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className={styles.plotHero}>
            <div>
              <h3 className={styles.plotHeroTitle}>{plot['样区名称']}</h3>
              <p className={styles.plotHeroMeta}>{plot['位置/范围']}</p>
            </div>
            <div className={styles.plotHeroStats}>
              <div>
                <strong>
                  {plot['累计鸟种数']?.replace(/种.*/, '') || '—'}
                </strong>
                <span>累计种数</span>
              </div>
              <div>
                <strong>{predictedAll.length || '—'}</strong>
                <span>预测种</span>
              </div>
              <div>
                <strong>{highlights.length || '—'}</strong>
                <span>高光/保护</span>
              </div>
            </div>
          </div>

          {(stables.length > 0 ||
            highlights.length > 0 ||
            predictedAll.length > 0) && (
            <section className={styles.smBlock}>
              <header className={styles.smHead}>
                <span className={styles.sectionMark} aria-hidden="true">
                  一
                </span>
                <div>
                  <h2 className={styles.smTitle}>鸟种</h2>
                  <p className={styles.smHint}>
                    蓝=代表 · 橙=高光/保护（已记或攻关目标）· 绿=可能存在（预测）·
                    点击跳名录
                  </p>
                </div>
              </header>
              <div className={styles.plotBirdStrip}>
                {stables.length > 0 ? (
                  <div>
                    <span className={styles.smLabel}>
                      代表种 · {stables.length}
                    </span>
                    <div className={styles.targetChips}>
                      {stables.map((name) => (
                        <BirdNameChip
                          key={name}
                          name={name}
                          tone="stable"
                          recorded={recordedMap.has(name) ? recordedMap.get(name) : null}
                          onOpenBird={onOpenBird}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {highlights.length > 0 ? (
                  <div>
                    <span className={styles.smLabel}>
                      高光/保护 · {highlights.length}
                    </span>
                    <p className={styles.plotBirdSubHint}>
                      含已确认保护种，也含尚未记到的攻关目标（档案卡「目标」口径）
                    </p>
                    <div className={styles.targetChips}>
                      {highlights.map((name) => (
                        <BirdNameChip
                          key={name}
                          name={name}
                          tone="key"
                          recorded={recordedMap.has(name) ? recordedMap.get(name) : null}
                          onOpenBird={onOpenBird}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {predictedAll.length > 0 ? (
                  <div>
                    <span className={styles.smLabel}>
                      可能存在（预测）· {predictedAll.length}
                    </span>
                    <div className={styles.targetChips}>
                      {predictedAll.map((name) => (
                        <BirdNameChip
                          key={name}
                          name={name}
                          tone="predict"
                          recorded={recordedMap.has(name) ? recordedMap.get(name) : null}
                          onOpenBird={onOpenBird}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          <PlotDossier plot={plot} linkedPlotId={linkedPlotId} />
        </>
      )}
    </div>
  );
}

function SeasonsPanel({
  coverage = null,
  speciesList = data.species,
  onOpenBird,
  onOpenPlot,
}) {
  const seasonTone = [
    styles.seasonToneSpring,
    styles.seasonToneBreed,
    styles.seasonToneAutumn,
    styles.seasonToneWinter,
  ];
  const recordedMap = useMemo(() => {
    const m = new Map();
    for (const s of speciesList) m.set(s.name, Boolean(s.recorded));
    return m;
  }, [speciesList]);

  return (
    <div className={styles.seasonsModule}>
      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            一
          </span>
          <div>
            <h2 className={styles.smTitle}>季节日历</h2>
            <p className={styles.smHint}>
              先对时段，再对样线
              {coverage
                ? '；徽章表示该季已有关联报告出工'
                : '：春迁补空白 → 繁殖攻关 → 秋迁数猛 → 越冬双周监测'}
            </p>
          </div>
        </header>
        <div className={styles.seasonGrid}>
          {data.seasons.map((s, i) => {
            const covered = coverage ? Boolean(coverage[s.period]) : false;
            return (
              <article
                key={s.period}
                className={`${styles.seasonCard} ${seasonTone[i] || ''} ${
                  covered ? styles.seasonCardCovered : ''
                }`}
              >
                <div className={styles.seasonCardTop}>
                  <span className={styles.seasonStep}>第 {i + 1} 季</span>
                  <span className={styles.seasonMonths}>{s.months}</span>
                  {covered ? (
                    <span className={styles.coverageBadge}>已出工</span>
                  ) : coverage ? (
                    <span className={styles.coverageBadgeEmpty}>待出工</span>
                  ) : null}
                </div>
                <h3 className={styles.seasonName}>{s.period}</h3>
                <p className={styles.seasonFocus}>{s.focus}</p>
                {s.routes ? (
                  <div className={styles.seasonRouteRow}>
                    <span className={styles.smLabel}>主走</span>
                    <div className={styles.targetChips}>
                      {String(s.routes)
                        .split(/[、,，]/)
                        .map((r) => r.trim())
                        .filter(Boolean)
                        .map((r) => {
                          const plotKey = matchPlotKeyFromText(r, data.plots);
                          return (
                            <PlotLinkChip
                              key={r}
                              label={r}
                              plotKey={plotKey}
                              onOpenPlot={onOpenPlot}
                            />
                          );
                        })}
                    </div>
                  </div>
                ) : null}
                <div className={styles.seasonHighlights}>
                  <span className={styles.smLabel}>高光目标</span>
                  <div className={styles.targetChips}>
                    {splitNames(s.highlights).map((name) => (
                      <BirdNameChip
                        key={name}
                        name={name}
                        recorded={
                          recordedMap.has(name) ? recordedMap.get(name) : null
                        }
                        onOpenBird={onOpenBird}
                      />
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            二
          </span>
          <div>
            <h2 className={styles.smTitle}>全境主样线</h2>
            <p className={styles.smHint}>
              七条线挂接十一个样区：西线 · 干流 · 鸣山 · 东北 · 东线 · 南线 · 临港；城区公园可作短线补点
            </p>
          </div>
        </header>
        <div className={styles.transectGrid}>
          {data.transects.map((t, i) => (
            <article key={t.name} className={styles.transectCard}>
              <div className={styles.transectHead}>
                <span className={styles.itemMark}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className={styles.transectTitleWrap}>
                  <h3 className={styles.transectName}>{t.name}</h3>
                  <span className={styles.transectSeason}>{t.bestSeason}</span>
                </div>
              </div>
              <p className={styles.transectArea}>{t.area}</p>
              {t.plots ? (
                <div className={styles.transectPlots}>
                  <span className={styles.smLabel}>挂接样区</span>
                  <div className={styles.targetChips}>
                    {String(t.plots)
                      .split(/[、,，]/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((p) => {
                        const plotKey = matchPlotKeyFromText(p, data.plots);
                        return (
                          <PlotLinkChip
                            key={p}
                            label={p}
                            plotKey={plotKey}
                            onOpenPlot={onOpenPlot}
                          />
                        );
                      })}
                  </div>
                </div>
              ) : null}
              <div className={styles.seasonHighlights}>
                <span className={styles.smLabel}>核心目标</span>
                <div className={styles.targetChips}>
                  {splitNames(t.targets).map((name) => (
                    <BirdNameChip
                      key={name}
                      name={name}
                      recorded={
                        recordedMap.has(name) ? recordedMap.get(name) : null
                      }
                      onOpenBird={onOpenBird}
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            三
          </span>
          <div>
            <h2 className={styles.smTitle}>专项监测点</h2>
            <p className={styles.smHint}>
              高频刚需：白鹳定点 · 河口数猛 · 干流鸻鹬 · 库湾鸳鸯/仙八色鸫
            </p>
          </div>
        </header>
        <div className={styles.specialGrid}>
          {data.specialSites.map((s, i) => {
            const plotKey = matchPlotKeyFromText(s.name, data.plots);
            return (
              <article key={s.name} className={styles.specialCard}>
                <div className={styles.specialTop}>
                  <span className={styles.itemMark}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {onOpenPlot && plotKey ? (
                    <button
                      type="button"
                      className={styles.specialNameBtn}
                      onClick={() => onOpenPlot(plotKey)}
                    >
                      {s.name}
                    </button>
                  ) : (
                    <h3 className={styles.specialName}>{s.name}</h3>
                  )}
                </div>
                <div className={styles.specialMeta}>
                  <span className={styles.specialBadge}>{s.method}</span>
                  <span className={styles.specialFreq}>{s.frequency}</span>
                </div>
                <p className={styles.specialBody}>{s.content}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            四
          </span>
          <div>
            <h2 className={styles.smTitle}>生境分区</h2>
            <p className={styles.smHint}>
              出工前先生境、再目标种；喀斯特与石林为新增单元
            </p>
          </div>
        </header>
        <div className={styles.zoneGrid}>
          {data.zones.map((z) => (
            <article key={z.name} className={styles.zoneCard}>
              <h3 className={styles.zoneName}>{z.name}</h3>
              <p className={styles.zoneRange}>{z.range}</p>
              <p className={styles.zoneValue}>{z.value}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanFoldSection({
  mark,
  title,
  hint,
  meta,
  open,
  onToggle,
  children,
}) {
  return (
    <section
      className={`${styles.smBlock} ${open ? '' : styles.smBlockFolded}`}
    >
      <button
        type="button"
        className={styles.smFoldHead}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className={styles.sectionMark} aria-hidden="true">
          {mark}
        </span>
        <div className={styles.smFoldMain}>
          <div>
            <h2 className={styles.smTitle}>{title}</h2>
            {hint ? <p className={styles.smHint}>{hint}</p> : null}
          </div>
          {meta ? <p className={styles.listMeta}>{meta}</p> : null}
        </div>
        <span className={styles.smFoldChevron} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div className={styles.smFoldBody}>{children}</div> : null}
    </section>
  );
}

function PlanPanel({
  projectId = 'leping',
  speciesList = data.species,
  coveredMonths = null,
  onOpenBird,
  onOpenPlot,
  linkedPlotId = '',
}) {
  const storageKey = checklistStorageKey(projectId);
  const foldKey = planFoldStorageKey(projectId);
  const [checks, setChecks] = useState({});
  const [checksReady, setChecksReady] = useState(false);
  const nowMonth = new Date().getMonth() + 1;
  const defaultFolds = useMemo(
    () => ({
      gaps: false,
      monthly: true,
      fixed: false,
      campaigns: true,
      checklist: false,
    }),
    [],
  );
  const [folds, setFolds] = useState(defaultFolds);
  const [foldsReady, setFoldsReady] = useState(false);
  const [openMonth, setOpenMonth] = useState(`${nowMonth}月`);
  const checkedCount = Object.values(checks).filter(Boolean).length;
  const checkTotal = data.checklist.reduce(
    (n, s) => n + (s.items?.length || 0),
    0,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setChecks(parsed);
      }
    } catch {
      /* ignore */
    }
    setChecksReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!checksReady) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(checks));
    } catch {
      /* ignore */
    }
  }, [checks, checksReady, storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(foldKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setFolds((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      /* ignore */
    }
    setFoldsReady(true);
  }, [foldKey]);

  useEffect(() => {
    if (!foldsReady) return;
    try {
      localStorage.setItem(foldKey, JSON.stringify(folds));
    } catch {
      /* ignore */
    }
  }, [folds, foldsReady, foldKey]);

  const toggleFold = (id) => {
    setFolds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const speciesByName = useMemo(() => {
    const m = new Map();
    for (const s of speciesList) m.set(s.name, s);
    return m;
  }, [speciesList]);

  const openCampaigns = useMemo(() => {
    const list = data.campaigns.filter((c) => {
      const sp = speciesByName.get(c.species);
      if (sp?.recorded) return false;
      if (c.tier === '扩展') return true;
      return sp && sp.targetLevel === '重点目标';
    });
    const month = new Date().getMonth() + 1;
    const seasonScore = (when = '') => {
      const raw = String(when);
      if (month >= 12 || month <= 2) return /12|1月|2月|冬|越冬/.test(raw) ? 0 : 2;
      if (month >= 3 && month <= 5) return /3|4|5|春|繁殖/.test(raw) ? 0 : 2;
      if (month >= 6 && month <= 8) return /6|7|8|夏|育雏/.test(raw) ? 0 : 2;
      return /9|10|11|秋/.test(raw) ? 0 : 2;
    };
    return [...list].sort((a, b) => {
      const ta = a.tier === '扩展' ? 1 : 0;
      const tb = b.tier === '扩展' ? 1 : 0;
      return ta - tb || seasonScore(a.when) - seasonScore(b.when);
    });
  }, [speciesByName]);

  const recordHref = (name) => {
    const sp = speciesByName.get(name);
    const params = new URLSearchParams();
    params.set('birdName', name);
    if (sp?.birdId) params.set('birdId', String(sp.birdId));
    if (linkedPlotId) params.set('plotId', String(linkedPlotId));
    return `/records/add?${params.toString()}`;
  };

  return (
    <div className={styles.seasonsModule}>
      <p className={styles.planFoldTip}>
        大模块可点标题开合；默认展开「逐月计划」与「攻关卡」，本机记住开合状态
      </p>

      <PlanFoldSection
        mark="一"
        title="缺口诊断"
        hint="季节 / 类群 / 空间 / 目标四类缺口，先补薄弱面再铺开"
        open={Boolean(folds.gaps)}
        onToggle={() => toggleFold('gaps')}
      >
        <div className={styles.gapGrid}>
          {data.gaps.map((g, i) => (
            <article key={g.type} className={styles.gapCard}>
              <div className={styles.gapTop}>
                <span className={styles.itemMark}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className={styles.gapTitle}>{g.type}</h3>
              </div>
              <div className={styles.gapBlock}>
                <span className={styles.smLabel}>现状</span>
                <p className={styles.gapText}>{g.status}</p>
              </div>
              <div className={styles.gapBlock}>
                <span className={styles.smLabel}>对策</span>
                <p className={styles.gapActionText}>{g.action}</p>
              </div>
            </article>
          ))}
        </div>
      </PlanFoldSection>

      <PlanFoldSection
        mark="二"
        title="逐月计划"
        hint={`每月可再点开合，默认展开本月；区域可点进样区档案${
          coveredMonths ? '；「已出工」来自关联报告月份' : ''
        }`}
        open={Boolean(folds.monthly)}
        onToggle={() => toggleFold('monthly')}
      >
        <div className={styles.monthList}>
          {data.monthly.map((row) => {
            const monthNum = Number.parseInt(String(row.month), 10);
            const isNow = monthNum === nowMonth;
            const worked = coveredMonths ? coveredMonths.has(monthNum) : false;
            const expanded = openMonth === row.month;
            const areas = Array.isArray(row.areas)
              ? row.areas
              : String(row.sites || '')
                  .split(/[+＋]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((label) => ({
                    plot: matchPlotKeyFromText(label, data.plots) || label,
                    role: '',
                    note: label,
                  }));
            return (
              <article
                key={row.month}
                className={`${styles.monthRow} ${
                  isNow ? styles.monthRowNow : ''
                } ${worked ? styles.monthRowCovered : ''} ${
                  expanded ? '' : styles.monthRowFolded
                }`}
              >
                <button
                  type="button"
                  className={styles.monthRowHeadBtn}
                  onClick={() =>
                    setOpenMonth((prev) =>
                      prev === row.month ? '' : row.month,
                    )
                  }
                  aria-expanded={expanded}
                >
                  <div className={styles.monthRowTitle}>
                    <strong className={styles.monthName}>{row.month}</strong>
                    <span className={styles.monthTheme}>{row.theme}</span>
                    {!expanded && row.focus ? (
                      <span className={styles.monthFocusCompact}>
                        {row.focus}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.monthBadgeRow}>
                    {isNow ? <span className={styles.badgeOk}>本月</span> : null}
                    {worked ? (
                      <span className={styles.coverageBadge}>已出工</span>
                    ) : coveredMonths ? (
                      <span className={styles.coverageBadgeEmpty}>待出工</span>
                    ) : null}
                    <span className={styles.smFoldChevron} aria-hidden="true">
                      {expanded ? '▾' : '▸'}
                    </span>
                  </span>
                </button>

                {expanded ? (
                  <>
                    {row.focus ? (
                      <p className={styles.monthFocus}>{row.focus}</p>
                    ) : null}

                    <div className={styles.monthBody}>
                      <div className={styles.monthCol}>
                        <span className={styles.smLabel}>主攻区域</span>
                        <ul className={styles.monthAreaList}>
                          {areas.map((a, idx) => {
                            const plotKey =
                              matchPlotKeyFromText(a.plot, data.plots) ||
                              matchPlotKeyFromText(a.note || '', data.plots);
                            return (
                              <li
                                key={`${a.plot}-${idx}`}
                                className={styles.monthAreaItem}
                              >
                                {onOpenPlot && plotKey ? (
                                  <button
                                    type="button"
                                    className={styles.monthAreaPlot}
                                    onClick={() => onOpenPlot(plotKey)}
                                  >
                                    {a.plot}
                                  </button>
                                ) : (
                                  <strong className={styles.monthAreaPlotText}>
                                    {a.plot}
                                  </strong>
                                )}
                                {a.role ? (
                                  <span className={styles.monthAreaRole}>
                                    {a.role}
                                  </span>
                                ) : null}
                                {a.note ? (
                                  <span className={styles.monthAreaNote}>
                                    {a.note}
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div className={styles.monthCol}>
                        <span className={styles.smLabel}>目标种</span>
                        <div className={styles.targetChips}>
                          {splitNames(row.targets).map((name) => {
                            const sp = speciesByName.get(name);
                            return (
                              <BirdNameChip
                                key={name}
                                name={name}
                                recorded={sp ? Boolean(sp.recorded) : null}
                                onOpenBird={onOpenBird}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={styles.monthMetaRow}>
                      {row.rhythm ? (
                        <p className={styles.monthMeta}>
                          <span className={styles.smLabel}>节奏</span>
                          {row.rhythm}
                        </p>
                      ) : null}
                      {row.method ? (
                        <p className={styles.monthMeta}>
                          <span className={styles.smLabel}>怎么走</span>
                          {row.method}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      </PlanFoldSection>

      {(data.fixedSites || []).length > 0 ? (
        <PlanFoldSection
          mark="三"
          title="固定样点制度"
          hint="可比、可重复是半严肃调查的核心"
          meta={`${data.fixedSites.length} 个`}
          open={Boolean(folds.fixed)}
          onToggle={() => toggleFold('fixed')}
        >
          <div className={styles.fixedGrid}>
            {data.fixedSites.map((s, i) => {
              const plotKey = matchPlotKeyFromText(s.name, data.plots);
              return (
                <article key={s.name} className={styles.fixedCard}>
                  <div className={styles.fixedTop}>
                    <span className={styles.itemMark}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {onOpenPlot && plotKey ? (
                      <button
                        type="button"
                        className={styles.fixedNameBtn}
                        onClick={() => onOpenPlot(plotKey)}
                      >
                        {s.name}
                      </button>
                    ) : (
                      <h3 className={styles.fixedName}>{s.name}</h3>
                    )}
                  </div>
                  <span className={styles.fixedFreq}>{s.frequency}</span>
                  <p className={styles.fixedRole}>{s.role}</p>
                  <div className={styles.gapBlock}>
                    <span className={styles.smLabel}>基线</span>
                    <p className={styles.fixedBase}>{s.baseline}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </PlanFoldSection>
      ) : null}

      <PlanFoldSection
        mark="四"
        title="未确认重点 · 攻关卡"
        hint={`${openCampaigns.length} 张 · 重点未记种为主，白腿小隼为扩展；当前季靠前`}
        open={Boolean(folds.campaigns)}
        onToggle={() => toggleFold('campaigns')}
      >
        {openCampaigns.length === 0 ? (
          <p className={styles.empty}>重点目标均已对消，暂无攻关卡。</p>
        ) : (
          <div className={styles.campaignGrid}>
            {openCampaigns.map((c, i) => {
              const plotKey =
                matchPlotKeyFromText(c.plot || '', data.plots) ||
                matchPlotKeyFromText(c.where, data.plots);
              return (
                <article key={c.species} className={styles.campaignCard}>
                  <div className={styles.campaignTop}>
                    <span className={styles.itemMark}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className={styles.campaignNameBtn}
                      onClick={() => onOpenBird?.(c.species)}
                    >
                      {c.species}
                    </button>
                    <span
                      className={
                        c.tier === '扩展'
                          ? styles.campaignTierExt
                          : styles.campaignTierKey
                      }
                    >
                      {c.tier === '扩展' ? '扩展' : '重点'}
                    </span>
                  </div>
                  <div className={styles.campaignChips}>
                    <span className={styles.campaignChip}>{c.when}</span>
                    {onOpenPlot && plotKey ? (
                      <button
                        type="button"
                        className={styles.campaignChipBtn}
                        onClick={() => onOpenPlot(plotKey)}
                      >
                        {c.plot || plotKey}
                      </button>
                    ) : (
                      <span className={styles.campaignChipMuted}>
                        {c.plot || c.where}
                      </span>
                    )}
                  </div>
                  <p className={styles.campaignWhere}>{c.where}</p>
                  <p className={styles.campaignHow}>
                    <span className={styles.smLabel}>方法</span>
                    {c.how}
                  </p>
                  {c.cue ? (
                    <p className={styles.campaignCue}>
                      <span className={styles.smLabel}>要点</span>
                      {c.cue}
                    </p>
                  ) : null}
                  <div className={styles.campaignActions}>
                    {onOpenBird ? (
                      <button
                        type="button"
                        className={styles.campaignAction}
                        onClick={() => onOpenBird(c.species)}
                      >
                        看名录
                      </button>
                    ) : null}
                    {onOpenPlot && plotKey ? (
                      <button
                        type="button"
                        className={styles.campaignAction}
                        onClick={() => onOpenPlot(plotKey)}
                      >
                        去样区
                      </button>
                    ) : null}
                    <Link
                      href={recordHref(c.species)}
                      className={styles.campaignAction}
                    >
                      记一条
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PlanFoldSection>

      <PlanFoldSection
        mark="五"
        title="出门前检查"
        hint="六张卡片：案头 → 到点 → 生境速查 → 时间窗 → 物候 → 离场（本机记住勾选）"
        meta={`${checkedCount}/${checkTotal}`}
        open={Boolean(folds.checklist)}
        onToggle={() => toggleFold('checklist')}
      >
        <div className={styles.checkCardGrid}>
          {data.checklist.map((section, i) => {
            const done = section.items.filter(
              (item) => checks[`${section.title}::${item}`],
            ).length;
            const allDone =
              section.items.length > 0 && done === section.items.length;
            const title = section.title.replace(/^[一二三四五六]、/, '');
            return (
              <article
                key={section.title}
                className={`${styles.checkCard} ${
                  allDone ? styles.checkCardDone : ''
                }`}
              >
                <header className={styles.checkCardHead}>
                  <div className={styles.checkCardTitleRow}>
                    <span className={styles.itemMark}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className={styles.checkCardTitle}>{title}</h3>
                  </div>
                  <span
                    className={`${styles.checkCardProgress} ${
                      allDone ? styles.checkCardProgressDone : ''
                    }`}
                  >
                    {done}/{section.items.length}
                  </span>
                </header>
                <ul className={styles.checkCardList}>
                  {section.items.map((item) => {
                    const key = `${section.title}::${item}`;
                    const checked = Boolean(checks[key]);
                    return (
                      <li key={key}>
                        <label
                          className={`${styles.checkCardItem} ${
                            checked ? styles.checkCardItemDone : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setChecks((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{item}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </PlanFoldSection>
    </div>
  );
}


function ExploreDemoClient({ projectId = 'leping', listPath = '/personal/projects' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const project = getExploreProject(projectId);
  const basePath = `${listPath}/${projectId}`;
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';
  const plotParam = searchParams.get('plot') || '';
  const qParam = searchParams.get('q') || '';
  const ledgerSection = searchParams.get('section') || 'species';

  const { plot: linkedPlot } = useLinkedPlot(
    project?.linkedPlotId,
    project?.linkedPlotTitle,
  );

  const live = useMemo(
    () => buildLiveSpecies(data.species, linkedPlot),
    [linkedPlot],
  );

  const coveredMonths = useMemo(
    () => monthsWithReports(data.plots, linkedPlot?.reports || []),
    [linkedPlot],
  );

  const coverage = useMemo(
    () => seasonCoverage(coveredMonths),
    [coveredMonths],
  );

  const setNav = (opts = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextTab = opts.tab !== undefined ? opts.tab : tab;

    if (!nextTab || nextTab === 'overview') params.delete('tab');
    else params.set('tab', nextTab);

    if (opts.plot !== undefined) {
      if (opts.plot) params.set('plot', opts.plot);
      else params.delete('plot');
    } else if (nextTab !== 'plots') {
      params.delete('plot');
    }

    if (opts.q !== undefined) {
      if (opts.q) params.set('q', opts.q);
      else params.delete('q');
    } else if (nextTab !== 'targets') {
      params.delete('q');
    }

    if (nextTab === 'ledger' && opts.section) {
      params.set('section', opts.section);
    } else if (nextTab !== 'ledger') {
      params.delete('section');
    }

    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  const setTab = (id, section) => {
    setNav({ tab: id, section: section || undefined });
  };

  const openBird = (name) => {
    const sp = live.species.find((s) => s.name === name);
    if (sp?.birdId) {
      router.push(`/birds/${sp.birdId}`);
      return;
    }
    setNav({ tab: 'targets', q: name, plot: '' });
  };

  const openPlot = (plotKey) => {
    if (!plotKey) return;
    setNav({ tab: 'plots', plot: plotKey, q: '' });
  };

  const title = project?.title || data.meta.title;

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          eyebrow="探索 · 调查项目"
          title={title}
          actions={<HeaderTextLink href={listPath}>我的调查</HeaderTextLink>}
        />

        <nav className={styles.tabs} aria-label="调查子模块">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <OverviewPanel project={project} live={live} />
        ) : null}
        {tab === 'targets' ? (
          <TargetsPanel
            speciesList={live.species}
            initialQ={qParam}
            linkedPlot={linkedPlot}
            onOpenBird={openBird}
          />
        ) : null}
        {tab === 'plots' ? (
          <PlotsPanel
            linkedPlotId={project?.linkedPlotId || ''}
            initialPlotKey={plotParam}
            speciesList={live.species}
            onOpenBird={openBird}
            onPlotChange={(key) => setNav({ tab: 'plots', plot: key })}
          />
        ) : null}
        {tab === 'ledger' ? (
          <ExploreLedgerPanel
            linkedPlotId={project?.linkedPlotId}
            linkedPlotTitle={project?.linkedPlotTitle}
            initialSection={ledgerSection}
            onSectionChange={(sectionId) => setTab('ledger', sectionId)}
          />
        ) : null}
        {tab === 'seasons' ? (
          <SeasonsPanel
            coverage={coverage}
            speciesList={live.species}
            onOpenBird={openBird}
            onOpenPlot={openPlot}
          />
        ) : null}
        {tab === 'plan' ? (
          <PlanPanel
            projectId={projectId}
            speciesList={live.species}
            coveredMonths={coveredMonths}
            onOpenBird={openBird}
            onOpenPlot={openPlot}
            linkedPlotId={project?.linkedPlotId || ''}
          />
        ) : null}

        <p className={styles.pageNote}>
          <span className={styles.pageNoteLabel}>备注</span>
          已记录 #N = 自留地种级表按最早发现排序；名录基线有、自留地尚无则显示「已记录」不带号
          {live.hasLivePlot
            ? `（自留地 ${live.liveSpeciesCount} 种）`
            : '；自留地未连通时用名录基线'}
          。出门前检查勾选保存在本机。
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default function ExploreDemo({
  projectId = 'leping',
  listPath = '/personal/projects',
}) {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="加载调查项目..." />
          </main>
          <Footer />
        </div>
      }
    >
      <ExploreDemoClient projectId={projectId} listPath={listPath} />
    </Suspense>
  );
}
