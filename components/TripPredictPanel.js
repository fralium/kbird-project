'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageState from './PageState';
import { useConfirmDialog } from './ConfirmDialog';
import LocationAutocomplete from './LocationAutocomplete';
import SpeciesHoverChip from './SpeciesHoverChip';
import { useAuth } from './AuthProvider';
import { api } from '../utils/api';
import { parseTripPreviewWorkbooks } from '../utils/tripPreviewWorkbook';
import styles from '../styles/TripPreview.module.css';

const PAGE_TABS = [
  {
    id: 'compare',
    label: '本次预测',
    hint: '上传一份或多份鸟种表（多表会合并同种次数），预测还能加哪些新种；地点备注可选，不会写入观察记录。',
  },
  { id: 'history', label: '预测历史', hint: '回看以前的加新预测，以及后来真正记进名录的种。' },
];

const RESULT_TABS = [
  { id: 'new', label: '可加新', hint: '表里有、预测时你还没记过的种。' },
  { id: 'seen', label: '已见', hint: '预测时判定你已经观察过。' },
  { id: 'unmatched', label: '未对上', hint: '表格有名，本机名录对不上。' },
  { id: 'added', label: '加新回看', hint: '当时算新种，之后写进名录或记录里的。' },
];

const toast = (message, type = 'success') => {
  if (typeof window !== 'undefined' && window.showToast) {
    window.showToast(message, type, 2500);
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN');
};

function chanceClass(chance) {
  if (chance === 'likely') return `${styles.badge} ${styles.badgeLikely}`;
  if (chance === 'possible') return `${styles.badge} ${styles.badgePossible}`;
  return `${styles.badge} ${styles.badgeLongshot}`;
}

function ResultDetails({
  result,
  tab,
  setTab,
  selected,
  toggleSelected,
  adding,
  confirmSelected,
  confirmAllNew,
  showClose = false,
  onClose,
  closeNote = '',
}) {
  const summary = result?.summary;
  const outcome = result?.outcome;
  if (!summary) return null;

  const visibleTabs = RESULT_TABS.filter((item) => item.id !== 'added' || outcome);
  const rows =
    tab === 'seen'
      ? result.seenSpecies || []
      : tab === 'unmatched'
        ? result.unmatched || []
        : tab === 'added'
          ? (result.newSpecies || []).filter((item) => item.nowSeen || item.recordedAfter)
          : result.newSpecies || [];
  const activeHint = visibleTabs.find((item) => item.id === tab)?.hint || '';

  return (
    <div className={styles.resultBody}>
      {showClose ? (
        <div className={styles.resultHead}>
          <p className={styles.resultHeadNote}>{closeNote}</p>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      ) : null}

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>清单</p>
          <p className={styles.statValue}>{summary.listCount}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>当时新种</p>
          <p className={styles.statValue}>{summary.newCount}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>当时已见</p>
          <p className={styles.statValue}>{summary.seenCount}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>{outcome ? '后来加新' : '较易加新'}</p>
          <p className={styles.statValue}>{outcome ? outcome.addedCount : summary.likelyCount}</p>
        </div>
      </div>

      <div className="kb-view-bar">
        <div className="kb-view-seg" role="tablist" aria-label="加新预测结果">
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`kb-view-tab${tab === item.id ? ' is-active' : ''}`}
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.id === 'new' ? ` ${summary.newCount}` : ''}
              {item.id === 'seen' ? ` ${summary.seenCount}` : ''}
              {item.id === 'unmatched' ? ` ${summary.unmatchedCount}` : ''}
              {item.id === 'added' && outcome ? ` ${outcome.addedCount}` : ''}
            </button>
          ))}
        </div>
        <p className="kb-view-hint">{activeHint}</p>
      </div>

      {tab === 'new' ? (
        <div className={styles.toolbar}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={adding || selected.size === 0}
            onClick={confirmSelected}
          >
            {adding
              ? '创建中…'
              : selected.size > 0
                ? `确认已选 ${selected.size} 种为列表`
                : '先勾选要加的新种'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={adding}
            onClick={confirmAllNew}
          >
            全部可加新确认为列表
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <PageState
          type="empty"
          title={tab === 'added' ? '还没有预测后加新' : '这一栏没有鸟种'}
          message={
            tab === 'added'
              ? '之后把记录写进笔记本，这里会对照当时的新种名单。'
              : '换一个页签，或换一份表格再预测。'
          }
        />
      ) : (
        <div className={styles.list}>
          {rows.map((item) => {
            const key = `${item.birdId || item.name}|${item.scientificName}|${item.code}`;
            return (
              <article key={key} className={styles.row}>
                {tab === 'new' ? (
                  <input
                    className={styles.check}
                    type="checkbox"
                    checked={item.birdId ? selected.has(item.birdId) : false}
                    disabled={!item.birdId || item.nowSeen}
                    onChange={() => toggleSelected(item.birdId)}
                    aria-label={`选择 ${item.name}`}
                  />
                ) : (
                  <span />
                )}
                <div>
                  <p className={styles.rowTitle}>
                    <SpeciesHoverChip
                      name={item.catalogName || item.name}
                      href={item.birdId ? `/birds/${item.birdId}` : undefined}
                    />
                  </p>
                  <p className={styles.rowSci}>
                    {item.scientificName || item.catalogScientificName || '—'}
                    {item.catalogName && item.name && item.catalogName !== item.name
                      ? ` · 表内作 ${item.name}`
                      : ''}
                    {(tab === 'added' || item.recordedAfter) && item.firstRecordedAt
                      ? ` · ${formatDate(item.firstRecordedAt)} 记到${
                          item.firstRecordedLocation ? ` · ${item.firstRecordedLocation}` : ''
                        }`
                      : ''}
                  </p>
                </div>
                <div className={styles.rowMeta}>
                  {[item.order, item.family].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className={styles.rowCount}>
                  {item.recordCount} 次
                  {tab === 'seen' && item.personalCount ? ` · 你记过 ${item.personalCount}` : ''}
                </div>
                <div className={styles.rowAction}>
                  {tab === 'seen' ? null : item.nowSeen || item.recordedAfter ? (
                    <span className={`${styles.badge} ${styles.badgeAdded}`}>已加新</span>
                  ) : (
                    <span className={chanceClass(item.chance)}>{item.chanceLabel}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className={styles.ghostNote}>
        {outcome
          ? `加新回看：对照当时的新种里，现已进名录 ${outcome.addedCount} 种；其中 ${outcome.withHistoryCount ?? outcome.recordedAfterCount} 种带有首次日期/地点；对照日之后有记录 ${outcome.recordedAfterCount} 种。`
          : '加新分档按这份表里的记录次数相对高低。预测结果会自动存进历史。'}
      </p>
    </div>
  );
}

export default function TripPredictPanel({ onConfirmedList } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [locationLabel, setLocationLabel] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationPast, setLocationPast] = useState(null);
  const [tripDate, setTripDate] = useState('');
  const [files, setFiles] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [pageTab, setPageTab] = useState('compare');
  const [tab, setTab] = useState('new');
  const [selected, setSelected] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [openingId, setOpeningId] = useState('');
  const skipOpenIdRef = useRef('');
  const historyId = searchParams.get('id') || result?.historyId || '';

    const loadHistoryList = useCallback(async (q = '') => {
    setHistoryLoading(true);
    try {
      const data = await api.personal.listTripPreviewHistory(q ? { q } : {});
      if (data?.success) {
        setHistoryItems(data.data?.items || []);
      }
    } catch {
      /* keep previous list */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    loadHistoryList();
  }, [authLoading, user, loadHistoryList]);

  useEffect(() => {
    const name = locationLabel.trim();
    if (name.length < 2) {
      setLocationPast(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = { name };
        if (locationId) params.locationId = locationId;
        const data = await api.personal.getTripPreviewLocationPast(params);
        if (!cancelled && data?.success) setLocationPast(data.data);
      } catch {
        if (!cancelled) setLocationPast(null);
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationLabel, locationId]);

  const openHistory = useCallback(
    async (id) => {
      if (!id) return;
      setError('');
      try {
        const data = await api.personal.getTripPreviewHistory(id);
        if (!data?.success) throw new Error(data?.message || '读取历史失败');
        setResult(data.data);
        setPageTab('history');
        setTab('new');
        setSelected(new Set());
        router.replace(`/personal/goals?tab=predict&id=${encodeURIComponent(id)}`, { scroll: false });
      } catch (err) {
        setError(err.message || '读取历史失败');
      }
    },
    [router]
  );

  const collapseHistory = useCallback(() => {
    const closedId = result?.historyId || searchParams.get('id') || '';
    if (closedId) skipOpenIdRef.current = closedId;
    setResult(null);
    setSelected(new Set());
    setOpeningId('');
    setPageTab('history');
    router.replace('/personal/goals?tab=predict', { scroll: false });
  }, [result?.historyId, searchParams, router]);

  const toggleHistory = async (id) => {
    if (!id) return;
    if (result?.historyId === id || (searchParams.get('id') === id && result)) {
      collapseHistory();
      return;
    }
    setOpeningId(id);
    await openHistory(id);
    setOpeningId('');
  };

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || authLoading) return;
    if (skipOpenIdRef.current === id) {
      skipOpenIdRef.current = '';
      return;
    }
    if (result?.historyId === id) return;
    openHistory(id);
  }, [searchParams, authLoading, openHistory, result?.historyId]);

  const handleCompare = async () => {
    if (!files.length) {
      setError('请先选择中国观鸟记录中心导出的 Excel（可多选，会合并后预测）');
      return;
    }
    setComparing(true);
    setError('');
    try {
      const parsed = await parseTripPreviewWorkbooks(files);
      const data = await api.personal.compareTripPreview({
        fileName: parsed.fileName,
        locationLabel,
        locationId,
        tripDate,
        species: parsed.species,
      });
      if (!data?.success) {
        throw new Error(data?.message || '预测失败');
      }
      setResult(data.data);
      setPageTab('compare');
      setTab('new');
      setSelected(new Set());
      await loadHistoryList(historyQuery);
      if (data.data?.historyId) {
        router.replace(`/personal/goals?tab=predict&id=${encodeURIComponent(data.data.historyId)}`, {
          scroll: false,
        });
      }
      toast('预测完成，已记入历史');
    } catch (err) {
      setError(err.message || '预测失败');
      setResult(null);
    } finally {
      setComparing(false);
    }
  };

  const closeCurrent = () => {
    const closedId = result?.historyId || searchParams.get('id') || '';
    if (closedId) skipOpenIdRef.current = closedId;
    setResult(null);
    setSelected(new Set());
    setTab('new');
    setError('');
    setFiles([]);
    setFileInputKey((key) => key + 1);
    setPageTab('compare');
    router.replace('/personal/goals?tab=predict', { scroll: false });
    loadHistoryList(historyQuery);
    toast('已收入历史，可以开始下一次预测');
  };

  const toggleSelected = (birdId) => {
    if (!birdId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(birdId)) next.delete(birdId);
      else next.add(birdId);
      return next;
    });
  };

  const confirmAsList = async (birdIds, options = {}) => {
    const ids = [...new Set(birdIds.filter(Boolean))];
    if (!ids.length) {
      toast('请先勾选能对上名录的新种', 'warning');
      return;
    }
    if (options.confirmMessage) {
      const ok = await ask(options.confirmMessage);
      if (!ok) return;
    }
    setAdding(true);
    try {
      const title =
        locationLabel.trim() ||
        result?.locationLabel ||
        result?.fileName ||
        `加新目标 ${new Date().toLocaleDateString('zh-CN')}`;
      const locLabel = locationLabel.trim() || result?.locationLabel || '';
      const saved = await api.personal.createGoalList({
        title,
        // 与标题相同时不重复存地点备注
        locationLabel: locLabel && locLabel !== title ? locLabel : '',
        sourceHistoryId: result?.historyId || '',
        birdIds: ids,
      });
      if (!saved?.success) throw new Error(saved?.message || '创建目标列表失败');
      toast(saved.message || `已创建目标列表，共 ${ids.length} 种`);
      setSelected(new Set());
      if (typeof onConfirmedList === 'function') {
        onConfirmedList(saved.list || null, saved.data || null);
      }
    } catch (err) {
      toast(err.message || '创建目标列表失败', 'error');
    } finally {
      setAdding(false);
    }
  };

  const confirmSelected = () => {
    const ids = [...selected];
    return confirmAsList(ids, {
      confirmMessage: `将已勾选的 ${ids.length} 种确认为目标列表？`,
    });
  };

  const confirmAllNew = async () => {
    const ids = (result?.newSpecies || [])
      .filter((item) => item.birdId && !item.nowSeen)
      .map((item) => item.birdId);
    if (!ids.length) {
      toast('没有可加新的种', 'warning');
      return;
    }
    return confirmAsList(ids, {
      confirmMessage: `将全部可加新的 ${ids.length} 种确认为目标列表？`,
    });
  };

  const handleDeleteHistory = async (event, id) => {
    event.stopPropagation();
    if (!id) return;
    const ok = await ask('删除这条预测历史？不影响已有观察记录。');
    if (!ok) return;
    try {
      const data = await api.personal.deleteTripPreviewHistory(id);
      if (!data?.success) throw new Error(data?.message || '删除失败');
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      if (result?.historyId === id) {
        skipOpenIdRef.current = id;
        setResult(null);
        setPageTab('history');
        router.replace('/personal/goals?tab=predict', { scroll: false });
      }
      toast('已删除预测历史');
    } catch (err) {
      toast(err.message || '删除失败', 'error');
    }
  };

  if (authLoading) {
    return <PageState type="loading" title="加载中..." />;
  }

  const summary = result?.summary;

  const resultPanelProps = {
    result,
    tab,
    setTab,
    selected,
    toggleSelected,
    adding,
    confirmSelected,
    confirmAllNew,
  };

  return (
    <div>
      <div className="kb-view-bar" style={{ marginBottom: 14 }}>
        <div className="kb-view-seg" role="tablist" aria-label="加新预测">
          {PAGE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`kb-view-tab${pageTab === item.id ? ' is-active' : ''}`}
              aria-selected={pageTab === item.id}
              onClick={() => {
                setPageTab(item.id);
                if (item.id === 'history') loadHistoryList(historyQuery);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="kb-view-hint">
          {(PAGE_TABS.find((item) => item.id === pageTab) || PAGE_TABS[0]).hint}
        </p>
      </div>

        {pageTab === 'compare' ? (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>上传鸟种表</h2>
            <p className={styles.panelNote}>
              用中国观鸟记录中心导出的 Excel。可以是具体点位，也可以是「杭州地区」这类范围备注，不必出现在地点词典里。只做加新预测，不会导入成观察记录；结果会自动存进历史。
            </p>
            <div className={styles.formRow}>
              <div>
                <span className={styles.fieldLabel}>范围备注</span>
                <div className={styles.locationWrap}>
                  <LocationAutocomplete
                    value={{ name: locationLabel, _id: locationId || null }}
                    onChange={(location) => {
                      setLocationLabel(location?.name || '');
                      setLocationId(location?._id ? String(location._id) : '');
                    }}
                    placeholder="如：西溪湿地，或杭州地区"
                    showHint={false}
                  />
                </div>
              </div>
              <label>
                <span className={styles.fieldLabel}>预测日期（可选）</span>
                <input
                  className={styles.input}
                  type="date"
                  value={tripDate}
                  onChange={(event) => setTripDate(event.target.value)}
                />
              </label>
            </div>
            {locationPast ? (
              <div className={styles.pastBox}>
                <p className={styles.pastTitle}>
                  {locationPast.inDictionary && locationPast.locationId ? (
                    <Link href={`/locations/${locationPast.locationId}`} className={styles.locationLink}>
                      {locationPast.locationName}
                    </Link>
                  ) : (
                    locationPast.locationName
                  )}
                  {locationPast.inDictionary ? ' · 已匹配地点词典' : ' · 地区备注（未进地点词典）'}
                </p>
                <p className={styles.pastMeta}>
                  {locationPast.visitCount
                    ? `相关记录 ${locationPast.visitCount} 次，${locationPast.speciesCount} 种${
                        locationPast.lastDate ? ` · 最近 ${formatDate(locationPast.lastDate)}` : ''
                      }`
                    : locationPast.inDictionary
                      ? '已匹配地点词典，你还没在这里写过观察记录。'
                      : '按备注预测即可；若以后要关联足迹，再写成具体地点。'}
                </p>
                {locationPast.species?.length ? (
                  <div className={styles.pastChips}>
                    {locationPast.species.map((bird) => (
                      <SpeciesHoverChip
                        key={bird.birdId}
                        name={bird.name}
                        href={bird.birdId ? `/birds/${bird.birdId}` : undefined}
                        className={styles.pastChip}
                      />
                    ))}
                    {locationPast.speciesCount > locationPast.species.length ? (
                      <span className={styles.pastChip}>等 {locationPast.speciesCount} 种</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <label>
              <span className={styles.fieldLabel}>Excel 文件（可多选，同种次数会相加）</span>
              <input
                key={fileInputKey}
                className={styles.fileInput}
                type="file"
                accept=".xls,.xlsx,.xlsm,.csv"
                multiple
                onChange={(event) => {
                  setFiles(Array.from(event.target.files || []));
                  setError('');
                }}
              />
            </label>
            {files.length ? (
              <p className={styles.panelNote}>
                已选 {files.length} 个：{files.map((item) => item.name).join('、')}
              </p>
            ) : null}
            <div className={styles.submitRow}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCompare}
                disabled={comparing || !files.length}
              >
                {comparing
                  ? '预测中…'
                  : files.length > 1
                    ? `合并 ${files.length} 个文件并预测`
                    : '开始预测'}
              </button>
            </div>
            {error && pageTab === 'compare' ? (
              <PageState type="error" title="预测未完成" message={error} />
            ) : null}
          </section>
        ) : (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>预测历史</h2>
            <p className={styles.panelNote}>按范围备注或文件名查找。最多保留最近 40 次。</p>
            <label>
              <span className={styles.fieldLabel}>查找</span>
              <input
                className={styles.input}
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadHistoryList(historyQuery);
                }}
                placeholder="范围备注或文件名"
              />
            </label>
            <div className={styles.toolbar}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => loadHistoryList(historyQuery)}
              >
                查询
              </button>
            </div>
            {historyLoading ? <PageState type="loading" title="读取历史..." /> : null}
            {!historyLoading && historyItems.length === 0 ? (
              <PageState type="empty" title="还没有预测历史" message="先做一次加新预测，结果会自动记在这里。" />
            ) : (
              <div className={styles.historyList}>
                {historyItems.map((item) => {
                  const isOpen = historyId === item.id || openingId === item.id;
                  const isLoaded = result?.historyId === item.id;
                  return (
                    <article
                      key={item.id}
                      className={`${styles.historyCard} ${isOpen ? styles.historyCardOpen : ''}`}
                    >
                      <div className={styles.historyCardHead}>
                      <button
                        type="button"
                        className={styles.historyToggle}
                        aria-expanded={isOpen}
                        onClick={() => toggleHistory(item.id)}
                      >
                        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />
                        <span className={styles.historyToggleMain}>
                          <span className={styles.rowTitle}>{item.locationLabel || '未写备注'}</span>
                          <span className={styles.historyMeta}>
                            {formatDate(item.tripDate || item.comparedAt)}
                            {item.fileName ? ` · ${item.fileName}` : ''}
                          </span>
                        </span>
                        <span className={styles.historyStats}>
                          新种 {item.summary?.newCount || 0}
                          {typeof item.outcome?.addedCount === 'number'
                            ? ` · 后来加新 ${item.outcome.addedCount}`
                            : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        aria-label="删除这条预测历史"
                        onClick={(event) => handleDeleteHistory(event, item.id)}
                      >
                        删除
                      </button>
                      </div>
                      {isOpen ? (
                        <div className={styles.historyBody}>
                          {openingId === item.id && !isLoaded ? (
                            <PageState type="loading" title="打开这条预测..." />
                          ) : null}
                          {isLoaded ? <ResultDetails {...resultPanelProps} /> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {pageTab === 'compare' && summary ? (
          <ResultDetails
            {...resultPanelProps}
            showClose
            onClose={closeCurrent}
            closeNote="预测已记下。关闭后收入历史，即可开始下一次。"
          />
        ) : null}
      {confirmDialog}
    </div>
  );
}
