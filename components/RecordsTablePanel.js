'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PageState from './PageState';
import { useAuth } from './AuthProvider';
import { api } from '../utils/api';
import { sortRecordBirdsByImportance, getRecordBirdHighlight } from '../data/protectionLevels';
import { getRecordPhotoUrl } from '../utils/habitatCover';
import SpeciesHoverChip from './SpeciesHoverChip';
import styles from '../styles/RecordsTable.module.css';

const CURRENT_YEAR = new Date().getFullYear();
const PAGE_SIZE = 100;

const SORTABLE_COLUMNS = [
  { key: 'date', label: '日期', className: 'colDate', type: 'date' },
  { key: 'location', label: '地点', className: 'colLocation', type: 'text' },
  { key: 'species', label: '种数', className: 'colSpecies', type: 'number' },
  { key: 'count', label: '数量', className: 'colCount', type: 'number' },
  { key: 'birds', label: '鸟种', className: 'colBirds', type: 'text' },
  { key: 'observer', label: '观察者', className: 'colObserver', type: 'text' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function getBirdCount(record) {
  return Array.isArray(record?.birds) ? record.birds.length : 0;
}

function getTotalIndividuals(record) {
  if (!Array.isArray(record?.birds)) return 0;
  return record.birds.reduce((sum, item) => sum + (Number(item.count) > 0 ? Number(item.count) : 1), 0);
}

function getBirdPreview(record, max = 4) {
  const birds = sortRecordBirdsByImportance(
    Array.isArray(record?.birds) ? record.birds : []
  );
  const names = birds
    .map((item) => {
      const name = item?.birdId?.name || item?.name || '';
      if (!name) return '';
      const highlight = getRecordBirdHighlight(item);
      return highlight.shortLabel ? `${name}(${highlight.shortLabel})` : name;
    })
    .filter(Boolean);
  if (names.length === 0) return '—';
  const shown = names.slice(0, max).join('、');
  return names.length > max ? `${shown} 等${names.length}种` : shown;
}

function getBirdChips(record, max = 5) {
  const birds = sortRecordBirdsByImportance(
    Array.isArray(record?.birds) ? record.birds : []
  );
  const chips = [];
  birds.forEach((item) => {
    if (chips.length >= max) return;
    const name = item?.birdId?.name || item?.name || '';
    if (!name) return;
    const highlight = getRecordBirdHighlight(item);
    chips.push({
      name,
      shortLabel: highlight.shortLabel || '',
      elevated: Boolean(highlight.chinaElevated || highlight.iucnElevated),
      chinaTop: highlight.china === '国家一级' || highlight.china === '国家二级',
    });
  });
  return { chips, extra: Math.max(0, birds.length - chips.length) };
}

function formatDateShort(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

function placeMonogram(name) {
  const text = String(name || '地').trim();
  return text.slice(0, 2) || '地';
}

function getSortValue(record, key) {
  switch (key) {
    case 'date':
      return record?.date ? new Date(record.date).getTime() : 0;
    case 'location':
      return String(record?.location?.name || '');
    case 'species':
      return getBirdCount(record);
    case 'count':
      return getTotalIndividuals(record);
    case 'birds':
      return getBirdPreview(record, 99);
    case 'observer':
      return String(record?.observer?.name || '');
    default:
      return '';
  }
}

function compareSortValues(a, b, type) {
  if (type === 'number' || type === 'date') {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b), 'zh-CN');
}

export default function RecordsTablePanel() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const currentUserId = String(user?._id || user?.id || '');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    if (currentUserId) {
      setScopeFilter('mine');
    }
  }, [currentUserId]);

  const fetchAllRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const params = {
          page: String(page),
          limit: String(PAGE_SIZE),
          sort: 'date_desc',
        };
        if (scopeFilter === 'mine' && currentUserId) {
          params.observer = currentUserId;
        }
        if (yearFilter) params.year = yearFilter;

        const data = await api.records.getAll(params);
        if (!data.success) {
          throw new Error(data.message || '获取记录失败');
        }

        all.push(...(data.data || []));
        totalPages = data.pagination?.totalPages || 1;
        page += 1;
        if (page > 1) setLoadingMore(true);
      }

      setRecords(all);
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError.message || '获取记录失败');
      setRecords([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUserId, scopeFilter, yearFilter]);

  useEffect(() => {
    if (authLoading) return;
    fetchAllRecords();
  }, [authLoading, fetchAllRecords]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'species' || key === 'count' || key === 'date' ? 'desc' : 'asc');
  };

  const filteredRecords = useMemo(() => {
    const keyword = searchTerm.toLowerCase();
    const column = SORTABLE_COLUMNS.find((item) => item.key === sortKey);
    const type = column?.type || 'text';

    const filtered = !keyword
      ? [...records]
      : records.filter((record) => {
          const title = String(record.title || '').toLowerCase();
          const location = String(record.location?.name || '').toLowerCase();
          const observer = String(record.observer?.name || '').toLowerCase();
          const notes = String(record.notes || '').toLowerCase();
          const birds = (record.birds || [])
            .map((item) => item?.birdId?.name || '')
            .join(' ')
            .toLowerCase();
          return (
            title.includes(keyword) ||
            location.includes(keyword) ||
            observer.includes(keyword) ||
            notes.includes(keyword) ||
            birds.includes(keyword)
          );
        });

    filtered.sort((left, right) => {
      const cmp = compareSortValues(
        getSortValue(left, sortKey),
        getSortValue(right, sortKey),
        type
      );
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      return new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime();
    });

    return filtered;
  }, [records, searchTerm, sortKey, sortDir]);

  const openRecord = (id) => {
    if (!id) return;
    router.push(`/records/${id}`);
  };

  const renderSortHeader = (column) => {
    const active = sortKey === column.key;
    const indicator = !active ? '↕' : sortDir === 'asc' ? '↑' : '↓';
    return (
      <th key={column.key} className={styles[column.className]} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={`${styles.sortButton} ${active ? styles.sortButtonActive : ''}`}
          onClick={() => handleSort(column.key)}
          title={`按${column.label}排序`}
        >
          <span>{column.label}</span>
          <span className={styles.sortIndicator} aria-hidden="true">
            {indicator}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className={styles.panelRoot}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="搜索地点、鸟种、观察者…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="搜索记录"
          />
          <select
            className={styles.select}
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            aria-label="年份筛选"
          >
            <option value="">全部年份</option>
            {Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i).map((year) => (
              <option key={year} value={String(year)}>
                {year} 年
              </option>
            ))}
          </select>
          {currentUserId ? (
            <select
              className={styles.select}
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              aria-label="记录范围"
            >
              <option value="mine">我的记录</option>
              <option value="all">本机全部</option>
            </select>
          ) : null}
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.countLabel}>
            {loading ? '加载中…' : `${filteredRecords.length} 条`}
            {loadingMore ? '（继续拉取…）' : ''}
          </span>
          <div className="kb-view-seg kb-meta-seg" role="group" aria-label="记录显示">
            <span className="kb-meta-label">显示</span>
            <button
              type="button"
              className={`kb-view-tab kb-meta-tab${viewMode === 'table' ? ' is-active' : ''}`}
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
            >
              表格
            </button>
            <button
              type="button"
              className={`kb-view-tab kb-meta-tab${viewMode === 'cards' ? ' is-active' : ''}`}
              aria-pressed={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
            >
              卡片
            </button>
          </div>
        </div>
      </div>

      {loading && records.length === 0 ? (
        <PageState type="loading" title="正在加载全部记录..." message="稍候，正在拉取本机观鸟流水。" />
      ) : error ? (
        <PageState type="error" title="加载失败" message={error} actionLabel="重试" onAction={fetchAllRecords} />
      ) : filteredRecords.length === 0 ? (
        <PageState
          type="empty"
          title={searchTerm || yearFilter ? '没有匹配的记录' : '还没有观察记录'}
          message={
            searchTerm || yearFilter
              ? '换个关键词或年份试试。'
              : '记一笔，或导入中国鸟类记录中心表格。'
          }
          actionLabel={searchTerm || yearFilter ? undefined : '记一笔'}
          onAction={
            searchTerm || yearFilter
              ? undefined
              : () => {
                  if (typeof window !== 'undefined') {
                    window.location.assign('/records/add');
                  }
                }
          }
          secondaryActionLabel={searchTerm || yearFilter ? undefined : '导入'}
          onSecondaryAction={
            searchTerm || yearFilter
              ? undefined
              : () => {
                  if (typeof window !== 'undefined') {
                    window.location.assign('/personal/manage?tab=import');
                  }
                }
          }
        />
      ) : viewMode === 'cards' ? (
        <div className={styles.cardGrid}>
          {filteredRecords.map((record) => {
            const species = getBirdCount(record);
            const individuals = getTotalIndividuals(record);
            const locationName = record.location?.name || '地点未知';
            const coverUrl = getRecordPhotoUrl(record, { allowSpeciesImages: true });
            const { chips, extra } = getBirdChips(record, 5);
            return (
              <button
                key={record._id}
                type="button"
                className={styles.recordCard}
                onClick={() => openRecord(record._id)}
              >
                <div className={styles.recordCardMedia} aria-hidden="true">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 280px"
                      unoptimized
                      className={styles.recordCardImg}
                    />
                  ) : (
                    <div className={styles.recordCardFallback}>{placeMonogram(locationName)}</div>
                  )}
                  <div className={styles.recordCardShade} />
                  <span className={styles.recordCardStamp}>{formatDateShort(record.date)}</span>
                  <span className={styles.recordCardCount}>
                    {species > 0 ? `${species} 种` : '—'}
                    {individuals > 0 ? ` · ${individuals} 只` : ''}
                  </span>
                </div>
                <div className={styles.recordCardBody}>
                  <span className={styles.recordCardPlace}>{locationName}</span>
                  <span className={styles.recordCardMeta}>
                    {formatDate(record.date)}
                    {record.observer?.name ? ` · ${record.observer.name}` : ''}
                  </span>
                  {chips.length > 0 ? (
                    <span className={styles.recordCardChips} title={getBirdPreview(record, 99)}>
                      {chips.map((chip) => (
                        <SpeciesHoverChip
                          key={`${record._id}-${chip.name}`}
                          name={chip.name}
                          focusable={false}
                          className={`${styles.recordChip}${
                            chip.chinaTop
                              ? ` ${styles.recordChipDanger}`
                              : chip.elevated
                                ? ` ${styles.recordChipWarn}`
                                : ''
                          }`}
                        >
                          {chip.name}
                          {chip.shortLabel ? (
                            <em className={styles.recordChipTag}>{chip.shortLabel}</em>
                          ) : null}
                        </SpeciesHoverChip>
                      ))}
                      {extra > 0 ? (
                        <span className={styles.recordChipMore}>+{extra}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className={styles.recordCardBirds}>暂无鸟种</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>{SORTABLE_COLUMNS.map(renderSortHeader)}</tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record._id}
                  className={styles.row}
                  onClick={() => openRecord(record._id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openRecord(record._id);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`打开记录 ${record.location?.name || record.title || record._id}`}
                >
                  <td className={styles.colDate}>{formatDate(record.date)}</td>
                  <td className={styles.colLocation}>{record.location?.name || '—'}</td>
                  <td className={styles.colSpecies}>{getBirdCount(record)}</td>
                  <td className={styles.colCount}>{getTotalIndividuals(record)}</td>
                  <td className={styles.colBirds} title={getBirdPreview(record, 99)}>
                    {getBirdPreview(record)}
                  </td>
                  <td className={styles.colObserver}>{record.observer?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
