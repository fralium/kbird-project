'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/localDate';
import PageState from './PageState';
import { useConfirmDialog } from './ConfirmDialog';
import TaxonomyChecklistPanel from './TaxonomyChecklistPanel';
import SpeciesHoverChip from './SpeciesHoverChip';
import { api } from '@/utils/api';
import { devError } from '@/utils/devLogger';
import styles from '@/styles/PersonalGoals.module.css';

const getGoalBirdId = (goal) => {
  if (!goal?.birdId) return null;
  if (typeof goal.birdId === 'object' && goal.birdId?._id) {
    return goal.birdId._id.toString();
  }
  return goal.birdId.toString?.() || String(goal.birdId);
};

const getGoalBirdName = (goal) => {
  if (!goal) return '';
  if (typeof goal.birdId === 'object' && goal.birdId?.name) return String(goal.birdId.name);
  if (goal.birdName) return String(goal.birdName);
  if (goal.catalogName) return String(goal.catalogName);
  return '';
};

const LOOSE_LIST_TITLE = '许愿目标';
const isLooseList = (list) => {
  const title = String(list?.title || '').trim();
  return title === LOOSE_LIST_TITLE || title === '散装目标';
};

const getListId = (list) => {
  if (!list) return '';
  if (list._id) return String(list._id);
  return '';
};

const getListDisplayTitle = (list) => {
  if (!list) return '未命名列表';
  if (isLooseList(list)) return LOOSE_LIST_TITLE;
  return String(list.title || '').trim() || '未命名列表';
};

/** 江西-鄱阳湖地区 → { region: 江西, place: 鄱阳湖地区 } */
const splitLocationLabel = (raw) => {
  const name = String(raw || '').trim();
  if (!name) return { region: '', place: '' };
  const sep = name.match(/^(.+?)[-—–／/·]\s*(.+)$/);
  if (sep) {
    return { region: sep[1].trim(), place: sep[2].trim() };
  }
  const province = name.match(
    /^(北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门)(.*)$/
  );
  if (province && province[2]) {
    return { region: province[1], place: province[2].replace(/^[-—–／/·\s]+/, '') || name };
  }
  return { region: '', place: name };
};

const groupLocationsByRegion = (locations = []) => {
  const groups = new Map();
  locations.forEach((goal, index) => {
    const { region, place } = splitLocationLabel(goal.locationName);
    const key = region || '其他';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ goal, index, place: place || goal.locationName });
  });
  return Array.from(groups.entries()).map(([region, items]) => ({ region, items }));
};

function MiniMonthlyBars({ items, emptyText }) {
  if (!items || items.length === 0) {
    return <div className={styles.challengeEmpty}>{emptyText}</div>;
  }
  const maxValue = Math.max(...items.map((item) => Number(item.count) || 0), 1);
  return (
    <div className={styles.monthlyBars}>
      {items.map((item) => {
        const value = Number(item.count) || 0;
        const monthLabel = String(item.month || '').slice(5) || item.month;
        return (
          <div key={item.month} className={styles.monthlyBarItem}>
            <div className={styles.monthlyBarValue}>{value}</div>
            <div
              className={styles.monthlyBarFill}
              style={{ height: `${Math.max(4, (value / maxValue) * 100)}%` }}
              title={`${item.month}: ${value}`}
            />
            <div className={styles.monthlyBarLabel}>{monthLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function PersonalGoalsPanel({ section = 'lists', focusListId = '' }) {
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [goals, setGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeListId, setActiveListId] = useState(focusListId || '');
  const [editing, setEditing] = useState({
    year: false,
    locations: false,
  });
  const [editData, setEditData] = useState({
    year: { targetSpecies: 0 },
    targetLocations: [],
  });
  const [addingBirdId, setAddingBirdId] = useState('');
  const [listBirdQuery, setListBirdQuery] = useState('');
  const [listBirdResults, setListBirdResults] = useState([]);
  const [searchingListBird, setSearchingListBird] = useState(false);
  const taxonomyMountedRef = useRef(section === 'taxonomy');
  const listDetailRef = useRef(null);
  const listSearchInputRef = useRef(null);
  const listBirdSearchTimerRef = useRef(null);
  const listBirdSearchSeqRef = useRef(0);

  const focusListSearch = () => {
    const input = listSearchInputRef.current;
    if (!input) return;
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    if (section === 'taxonomy') taxonomyMountedRef.current = true;
  }, [section]);

  useEffect(() => {
    if (focusListId) setActiveListId(focusListId);
  }, [focusListId]);

  const applyGoalsPayload = (data) => {
    setGoals(data);
    setEditData({
      year: {
        targetSpecies: data.year?.targetSpecies || 0,
      },
      targetLocations: data.targetLocations || [],
    });
    const lists = data.targetLists || [];
    setActiveListId((prev) => {
      if (focusListId && lists.some((list) => getListId(list) === focusListId)) {
        return focusListId;
      }
      if (prev && lists.some((list) => getListId(list) === prev)) return prev;
      return getListId(lists[0]) || '';
    });
  };

  const fetchGoals = async () => {
    try {
      const data = await api.personal.getGoals();
      if (data.success) {
        applyGoalsPayload(data.data);
      }
    } catch (error) {
      devError('获取目标失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (listBirdSearchTimerRef.current) clearTimeout(listBirdSearchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!focusListId || !listDetailRef.current) return;
    listDetailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusListId, goals]);

  const serializeLists = (lists, mutateListId, mutator) =>
    (lists || []).map((list) => {
      const id = getListId(list);
      const base = {
        _id: list._id,
        title: list.title || '目标列表',
        locationLabel: list.locationLabel || '',
        sourceHistoryId: list.sourceHistoryId || '',
        createdAt: list.createdAt,
        species: (list.species || []).map((goal) => ({
          birdId: getGoalBirdId(goal),
          notes: goal.notes || '',
          completed: Boolean(goal.completed),
          completedDate: goal.completedDate || null,
        })),
      };
      if (id && id === mutateListId) return mutator(base, list);
      return base;
    });

  const markGoalComplete = async (type, id, options = {}) => {
    if (!id) return;
    setSaving(true);
    setMessage('');
    try {
      const data = await api.personal.completeGoal(type, id, options);
      if (data.success) {
        setMessage('已标记为完成');
        if (data.data) {
          applyGoalsPayload(data.data);
        } else {
          await fetchGoals();
        }
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (error) {
      devError('标记完成失败:', error);
      setMessage('操作失败，请重试');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSave = async (type) => {
    setSaving(true);
    setMessage('');

    try {
      const updateData = {};

      if (type === 'year') {
        updateData.year = editData.year;
      } else if (type === 'locations') {
        updateData.targetLocations = editData.targetLocations.filter(
          (target) => target.locationName && target.locationName.trim() !== ''
        );
      }

      const data = await api.personal.updateGoals(updateData);
      if (data.success) {
        setMessage('目标保存成功！');
        setEditing((prev) => ({ ...prev, [type]: false }));
        await fetchGoals();
      } else {
        setMessage(`保存失败：${data.message}`);
      }
    } catch (error) {
      devError('保存目标失败:', error);
      setMessage('保存失败，请重试');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const addLocationGoal = () => {
    setEditData((prev) => ({
      ...prev,
      targetLocations: [
        ...prev.targetLocations,
        { locationName: '', notes: '', completed: false, completedDate: null },
      ],
    }));
  };

  const removeLocationGoal = async (index) => {
    const ok = await ask('从目标里去掉这个地点？保存后才会生效。');
    if (!ok) return;
    setEditData((prev) => ({
      ...prev,
      targetLocations: prev.targetLocations.filter((_, i) => i !== index),
    }));
  };

  const startEditingLocations = (appendEmpty = false) => {
    setEditData((prev) => {
      const existingTargets = (goals.targetLocations || []).map((goal) => ({
        _id: goal._id ? String(goal._id) : undefined,
        locationName: goal.locationName || '',
        notes: goal.notes || '',
        completed: Boolean(goal.completed),
        completedDate: goal.completedDate || null,
      }));
      const targetLocations = appendEmpty
        ? [
            ...existingTargets,
            { locationName: '', notes: '', completed: false, completedDate: null },
          ]
        : existingTargets;
      return {
        ...prev,
        targetLocations,
      };
    });
    setEditing((prev) => ({ ...prev, locations: true }));
  };

  const targetBirdIds = useMemo(() => {
    const lists = goals?.targetLists || [];
    const ids = [];
    lists.forEach((list) => {
      (list.species || []).forEach((goal) => {
        const id = getGoalBirdId(goal);
        if (id) ids.push(id);
      });
    });
    (goals?.targetBirds || []).forEach((goal) => {
      const id = getGoalBirdId(goal);
      if (id) ids.push(id);
    });
    return [...new Set(ids)];
  }, [goals]);

  const ensureLooseList = (lists) => {
    const next = [...(lists || [])];
    const idx = next.findIndex((list) => isLooseList(list));
    let loose;
    if (idx < 0) {
      loose = { title: LOOSE_LIST_TITLE, locationLabel: '', species: [] };
      next.unshift(loose);
    } else {
      loose =
        String(next[idx].title || '') === LOOSE_LIST_TITLE
          ? next[idx]
          : { ...next[idx], title: LOOSE_LIST_TITLE };
      next[idx] = loose;
    }
    return { lists: next, loose, looseId: getListId(loose) };
  };

  const handleAddTargetBird = async (bird, options = {}) => {
    if (!bird?._id || !goals) return;
    const birdId = String(bird._id);
    let lists = [...(goals.targetLists || [])];
    // 名录进度里加入 → 默认进许愿目标；特定目标区则加入当前打开的列表
    let targetListId =
      options.listId || (section === 'taxonomy' ? '' : activeListId) || '';

    if (
      !targetListId ||
      targetListId === '__loose__' ||
      !lists.some((list) => getListId(list) === targetListId)
    ) {
      const ensured = ensureLooseList(lists);
      lists = ensured.lists;
      targetListId = ensured.looseId || '__loose__';
    }

    const targetList =
      targetListId === '__loose__'
        ? lists.find((list) => isLooseList(list))
        : lists.find((list) => getListId(list) === targetListId);
    if (!targetList) {
      setMessage('未找到目标列表');
      setTimeout(() => setMessage(''), 2500);
      return;
    }

    const existingIds = new Set(
      (targetList.species || []).map((goal) => getGoalBirdId(goal)).filter(Boolean)
    );
    if (existingIds.has(birdId)) {
      setMessage('该鸟种已在当前列表中');
      setTimeout(() => setMessage(''), 2500);
      return;
    }

    setAddingBirdId(birdId);
    setMessage('');
    try {
      const nextLists = lists.map((list) => {
        const isTarget =
          list === targetList ||
          (targetListId !== '__loose__' && getListId(list) === targetListId) ||
          (targetListId === '__loose__' && isLooseList(list));
        const species = (list.species || []).map((goal) => ({
          birdId: getGoalBirdId(goal),
          notes: goal.notes || '',
          completed: Boolean(goal.completed),
          completedDate: goal.completedDate || null,
        }));
        if (isTarget) {
          species.push({ birdId, notes: '', completed: false, completedDate: null });
        }
        return {
          _id: list._id,
          title: isLooseList(list) ? LOOSE_LIST_TITLE : list.title || '目标列表',
          locationLabel: list.locationLabel || '',
          sourceHistoryId: list.sourceHistoryId || '',
          createdAt: list.createdAt,
          species: species.filter((item) => item.birdId),
        };
      });

      const data = await api.personal.updateGoals({ targetLists: nextLists });
      if (data.success) {
        const listTitle = getListDisplayTitle(targetList);
        setMessage(`已将「${bird.name}」加入${listTitle}`);
        setListBirdQuery('');
        setListBirdResults([]);
        if (data.data) applyGoalsPayload(data.data);
        else await fetchGoals();
      } else {
        setMessage(data.message || '加入目标失败');
      }
    } catch (error) {
      devError('加入目标失败:', error);
      setMessage('加入目标失败，请重试');
    } finally {
      setAddingBirdId('');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const searchListBird = (term) => {
    if (listBirdSearchTimerRef.current) clearTimeout(listBirdSearchTimerRef.current);
    const q = String(term || '').trim();
    if (!q || q.length < 2) {
      setListBirdResults([]);
      setSearchingListBird(false);
      return;
    }
    setSearchingListBird(true);
    listBirdSearchTimerRef.current = setTimeout(async () => {
      const seq = (listBirdSearchSeqRef.current || 0) + 1;
      listBirdSearchSeqRef.current = seq;
      try {
        const data = await api.birds.getAll({ search: q, limit: '8' });
        if (listBirdSearchSeqRef.current !== seq) return;
        setListBirdResults(data.success ? data.data || [] : []);
      } catch (error) {
        if (listBirdSearchSeqRef.current !== seq) return;
        devError('搜索鸟类失败:', error);
        setListBirdResults([]);
      } finally {
        if (listBirdSearchSeqRef.current === seq) setSearchingListBird(false);
      }
    }, 280);
  };

  const removeSpeciesFromList = async (listId, birdId) => {
    if (!listId || !birdId || !goals) return;
    const ok = await ask('从这份列表里去掉该鸟种？');
    if (!ok) return;
    setSaving(true);
    setMessage('');
    try {
      const nextLists = serializeLists(goals.targetLists, listId, (base) => ({
        ...base,
        species: base.species.filter((item) => item.birdId !== birdId),
      }));
      const data = await api.personal.updateGoals({ targetLists: nextLists });
      if (data.success) {
        setMessage('已从列表去掉该鸟种');
        if (data.data) applyGoalsPayload(data.data);
        else await fetchGoals();
      } else {
        setMessage(data.message || '操作失败');
      }
    } catch (error) {
      devError('从列表去掉鸟种失败:', error);
      setMessage('操作失败，请重试');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const deleteList = async (listId) => {
    if (!listId) return;
    const ok = await ask('删除这份目标列表？列表内鸟种目标会一并去掉。');
    if (!ok) return;
    setSaving(true);
    setMessage('');
    try {
      const data = await api.personal.deleteGoalList(listId);
      if (data.success) {
        setMessage('已删除目标列表');
        if (activeListId === listId) setActiveListId('');
        if (data.data) applyGoalsPayload(data.data);
        else await fetchGoals();
      } else {
        setMessage(data.message || '删除失败');
      }
    } catch (error) {
      devError('删除目标列表失败:', error);
      setMessage('删除失败，请重试');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const locationGroups = useMemo(
    () => groupLocationsByRegion(goals?.targetLocations || []),
    [goals?.targetLocations]
  );

  if (loading) {
    return <PageState type="loading" title="目标加载中..." />;
  }

  if (!goals) {
    return <PageState type="error" title="目标加载失败" actionLabel="重试" onAction={fetchGoals} />;
  }

  const challenge = goals.challenge || {};
  const birdChallenge = challenge.birds || {};
  const locationChallenge = challenge.locations || {};
  const lists = goals.targetLists || [];
  const activeList =
    lists.find((list) => getListId(list) === activeListId) || lists[0] || null;
  const activeListStats = activeList?.stats || {
    total: (activeList?.species || []).length,
    completed: (activeList?.species || []).filter((item) => item.completed).length,
    completionRate: 0,
  };

  return (
    <div className={styles.panelRoot}>
      {message ? (
        <div
          className={`${styles.message} ${
            message.includes('成功') ||
            message.includes('已标记为完成') ||
            message.includes('已将') ||
            message.includes('已在目标') ||
            message.includes('已删除')
              ? styles.success
              : styles.error
          }`}
        >
          {message}
        </div>
      ) : null}

      {section === 'taxonomy' ? (
        <TaxonomyChecklistPanel
          targetBirdIds={targetBirdIds}
          onAddTargetBird={handleAddTargetBird}
          addingBirdId={addingBirdId}
        />
      ) : (
        <>
          <div className={styles.overviewCard}>
            <div className={styles.overviewHeader}>
              <h2>年度概览 ({goals.year?.currentYear || new Date().getFullYear()})</h2>
              {!editing.year ? (
                <button
                  type="button"
                  onClick={() => setEditing((prev) => ({ ...prev, year: true }))}
                  className={styles.editButton}
                >
                  编辑目标种数
                </button>
              ) : null}
            </div>

            {editing.year ? (
              <div className={styles.editForm}>
                <div className={styles.formGroup}>
                  <label>目标观察种类数</label>
                  <input
                    type="number"
                    min="0"
                    value={editData.year.targetSpecies}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        year: { ...prev.year, targetSpecies: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className={styles.input}
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => handleSave('year')}
                    disabled={saving}
                    className={styles.saveButton}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing((prev) => ({ ...prev, year: false }))}
                    className={styles.cancelButton}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.overviewGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>观察种类</div>
                  <div className={styles.statValueRow}>
                    <span className={styles.statValue}>
                      {goals.year?.current?.species || 0}
                      <span className={styles.statTarget}> / {goals.year?.targetSpecies || 0}</span>
                    </span>
                    <span className={styles.statPct}>{goals.year?.progress?.species || 0}%</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${goals.year?.progress?.species || 0}%` }}
                    />
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>列表鸟种</div>
                  <div className={styles.statValueRow}>
                    <span className={styles.statValue}>{birdChallenge.completionRate || 0}%</span>
                    <span className={styles.statMeta}>
                      {birdChallenge.completed || 0}/{birdChallenge.total || 0}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${birdChallenge.completionRate || 0}%` }}
                    />
                  </div>
                  <div className={styles.statSubMeta}>
                    共 {challenge.lists?.total || lists.length || 0} 份列表
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>地点挑战</div>
                  <div className={styles.statValueRow}>
                    <span className={styles.statValue}>{locationChallenge.completionRate || 0}%</span>
                    <span className={styles.statMeta}>
                      {locationChallenge.completed || 0}/{locationChallenge.total || 0}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${locationChallenge.completionRate || 0}%` }}
                    />
                  </div>
                  <div className={styles.statSubMeta}>
                    本年到访 {locationChallenge.visitedThisYear || 0}
                  </div>
                  <MiniMonthlyBars
                    items={locationChallenge.monthlyVisits || []}
                    emptyText="暂无月度到访"
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.goalsSplitGrid}>
            <div className={`${styles.goalCard} ${styles.halfCard}`} ref={listDetailRef}>
              <div className={styles.goalHeader}>
                <div>
                  <h2>特定目标</h2>
                  <p className={styles.sectionHint}>
                    完成 {activeListStats.completed || 0}/
                    {activeListStats.total || (activeList?.species || []).length || 0}
                  </p>
                </div>
                <div className={styles.headerActions}>
                  <button
                    type="button"
                    className={styles.editButton}
                    disabled={!activeList}
                    onClick={focusListSearch}
                  >
                    + 添加
                  </button>
                  <button
                    type="button"
                    className={styles.editButton}
                    disabled={saving || !activeList}
                    onClick={() => deleteList(getListId(activeList))}
                  >
                    删除
                  </button>
                </div>
              </div>

              {lists.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>还没有目标列表</p>
                  <p className={styles.emptyHint}>在「加新预测」里确认新种后，会生成一份列表。</p>
                </div>
              ) : (
                <div className={styles.listsLayout}>
                  <div className={styles.listSidebar} role="listbox" aria-label="目标列表">
                    {lists.map((list) => {
                      const id = getListId(list);
                      const selected = activeList && getListId(activeList) === id;
                      return (
                        <button
                          key={id || list.title}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`${styles.listSideItem}${selected ? ` ${styles.listSideItemActive}` : ''}`}
                          title={getListDisplayTitle(list)}
                          onClick={() => setActiveListId(id)}
                        >
                          <span className={styles.listSideTitle}>{getListDisplayTitle(list)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.listDetail}>
                    {activeList ? (
                      <>
                        {(() => {
                          const title = getListDisplayTitle(activeList);
                          const loc = String(activeList.locationLabel || '').trim();
                          const note = isLooseList(activeList)
                            ? '随时记下想加的种'
                            : loc && loc !== title
                              ? `地点备注：${loc}`
                              : '';
                          return note ? (
                            <p className={styles.listDetailMeta}>{note}</p>
                          ) : null;
                        })()}

                        <div className={styles.listAddRow}>
                          <div className={styles.birdSearchContainer}>
                            <input
                              ref={listSearchInputRef}
                              type="text"
                              className={`${styles.input} ${styles.listAddInput}`}
                              placeholder="搜索鸟种，加入当前列表…"
                              value={listBirdQuery}
                              onChange={(e) => {
                                setListBirdQuery(e.target.value);
                                searchListBird(e.target.value);
                              }}
                            />
                            {listBirdResults.length > 0 ? (
                              <div className={styles.searchResults}>
                                {listBirdResults.map((bird) => (
                                  <div
                                    key={bird._id}
                                    className={styles.searchResultItem}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                      handleAddTargetBird(bird, {
                                        listId: getListId(activeList),
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        handleAddTargetBird(bird, {
                                          listId: getListId(activeList),
                                        });
                                      }
                                    }}
                                  >
                                    {bird.name}
                                    {bird.scientificName ? ` (${bird.scientificName})` : ''}
                                    {searchingListBird || addingBirdId === String(bird._id)
                                      ? '…'
                                      : ''}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {(activeList.species || []).length > 0 ? (
                          <div className={styles.goalsList}>
                            {(activeList.species || []).map((goal, index) => {
                              const birdId = getGoalBirdId(goal);
                              const birdName = getGoalBirdName(goal);
                              const displayName = birdName || '未知鸟类';
                              return (
                                <div
                                  key={birdId || index}
                                  className={`${styles.goalItem} ${goal.completed ? styles.completed : ''}`}
                                >
                                  <div className={styles.goalInfo}>
                                    <span
                                      className={`${styles.goalStatus} ${
                                        goal.completed ? styles.goalStatusDone : styles.goalStatusPending
                                      }`}
                                      aria-label={goal.completed ? '已完成' : '未完成'}
                                      title={goal.completed ? '已完成' : '未完成'}
                                    />
                                    {birdName ? (
                                      <SpeciesHoverChip
                                        name={birdName}
                                        href={birdId ? `/birds/${birdId}` : undefined}
                                        className={styles.goalName}
                                      >
                                        {birdName}
                                      </SpeciesHoverChip>
                                    ) : (
                                      <span className={styles.goalName}>{displayName}</span>
                                    )}
                                    {goal.completed && goal.completedDate ? (
                                      <span className={styles.completedDate}>
                                        完成于:{' '}
                                        {formatDisplayDate(goal.completedDate, 'short')}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className={styles.headerActions}>
                                    {!goal.completed && birdId ? (
                                      <button
                                        type="button"
                                        className={styles.completeButton}
                                        disabled={saving}
                                        onClick={() =>
                                          markGoalComplete('bird', birdId, {
                                            listId: getListId(activeList),
                                          })
                                        }
                                      >
                                        已完成
                                      </button>
                                    ) : null}
                                    {birdId ? (
                                      <button
                                        type="button"
                                        className={styles.deleteListButton}
                                        disabled={saving}
                                        onClick={() =>
                                          removeSpeciesFromList(getListId(activeList), birdId)
                                        }
                                      >
                                        去掉
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.emptyState}>
                            <p>这份列表里还没有鸟种</p>
                            <p className={styles.emptyHint}>在上方搜索鸟种名称即可加入</p>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <aside className={`${styles.goalCard} ${styles.placeCard}`}>
              <div className={styles.goalHeader}>
                <div>
                  <h2>想去的地方</h2>
                  <p className={styles.sectionHint}>
                    完成 {locationChallenge.completed || 0}/{locationChallenge.total || 0}
                  </p>
                </div>
                {!editing.locations ? (
                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      onClick={() => startEditingLocations(true)}
                      className={styles.editButton}
                    >
                      + 添加
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingLocations(false)}
                      className={styles.editButton}
                    >
                      编辑
                    </button>
                  </div>
                ) : null}
              </div>

              {editing.locations ? (
                <div className={styles.editForm}>
                  <button type="button" onClick={addLocationGoal} className={styles.addButton}>
                    + 再添加一个地点
                  </button>
                  {editData.targetLocations.map((goal, index) => (
                    <div key={index} className={styles.goalItem}>
                      <input
                        type="text"
                        placeholder="如：江西-鄱阳湖地区"
                        value={goal.locationName}
                        onChange={(e) => {
                          const newLocations = [...editData.targetLocations];
                          newLocations[index].locationName = e.target.value;
                          setEditData((prev) => ({ ...prev, targetLocations: newLocations }));
                        }}
                        className={styles.input}
                      />
                      <button
                        type="button"
                        onClick={() => removeLocationGoal(index)}
                        className={styles.removeButton}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      onClick={() => handleSave('locations')}
                      disabled={saving}
                      className={styles.saveButton}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing((prev) => ({ ...prev, locations: false }))}
                      className={styles.cancelButton}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.placePanel}>
                  {locationGroups.length > 0 ? (
                    locationGroups.map(({ region, items }) => (
                      <div key={region} className={styles.placeGroup}>
                        {region !== '其他' ? (
                          <p className={styles.placeRegion}>{region}</p>
                        ) : null}
                        <ul className={styles.placeList}>
                          {items.map(({ goal, place }) => (
                            <li
                              key={goal._id || place}
                              className={`${styles.placeRow}${
                                goal.completed ? ` ${styles.placeRowDone}` : ''
                              }`}
                            >
                              <span
                                className={`${styles.goalStatus} ${
                                  goal.completed
                                    ? styles.goalStatusDone
                                    : styles.goalStatusPending
                                }`}
                                aria-hidden="true"
                              />
                              <div className={styles.placeText}>
                                <span className={styles.placeName}>{place}</span>
                                {goal.completed && goal.completedDate ? (
                                  <span className={styles.placeDate}>
                                    {formatDisplayDate(goal.completedDate, 'short')}
                                  </span>
                                ) : null}
                              </div>
                              {!goal.completed && goal._id ? (
                                <button
                                  type="button"
                                  className={styles.placeDoneBtn}
                                  disabled={saving}
                                  onClick={() =>
                                    markGoalComplete('location', goal._id.toString())
                                  }
                                >
                                  到访
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <p>还没有想去的地方</p>
                      <p className={styles.emptyHint}>点「+ 添加」记下想探的区域</p>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
