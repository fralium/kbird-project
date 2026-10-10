'use client';

import { useEffect, useMemo, useState } from 'react';
import PageState from './PageState';
import SpeciesHoverChip from './SpeciesHoverChip';
import { api } from '../utils/api';
import { getOrderChineseName, getFamilyChineseName } from '../data/taxonomyTranslation';
import { devError } from '../utils/devLogger';
import styles from '../styles/TaxonomyChecklist.module.css';

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
}

function buildTree(species) {
  const orderMap = new Map();
  species.forEach((bird) => {
    const orderKey = bird.order || '未分类';
    const familyKey = bird.family || '未分类';
    if (!orderMap.has(orderKey)) {
      orderMap.set(orderKey, { key: orderKey, families: new Map() });
    }
    const orderNode = orderMap.get(orderKey);
    if (!orderNode.families.has(familyKey)) {
      orderNode.families.set(familyKey, { key: familyKey, birds: [] });
    }
    orderNode.families.get(familyKey).birds.push(bird);
  });

  return Array.from(orderMap.values()).map((orderNode) => {
    const families = Array.from(orderNode.families.values()).map((familyNode) => ({
      ...familyNode,
      total: familyNode.birds.length,
      observed: familyNode.birds.filter((bird) => bird.observed).length,
    }));
    const birds = families.flatMap((family) => family.birds);
    return {
      key: orderNode.key,
      families,
      total: birds.length,
      observed: birds.filter((bird) => bird.observed).length,
    };
  });
}

function progressTone(observed, total) {
  if (!total) return 'empty';
  const pct = observed / total;
  if (pct >= 1) return 'done';
  if (pct > 0) return 'partial';
  return 'empty';
}

export default function TaxonomyChecklistPanel({
  targetBirdIds = [],
  onAddTargetBird,
  addingBirdId = '',
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [species, setSpecies] = useState([]);
  const [observedCount, setObservedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | unseen | seen
  const [expandedOrders, setExpandedOrders] = useState(() => new Set());
  const [expandedFamilies, setExpandedFamilies] = useState(() => new Set());

  const targetIdSet = useMemo(
    () => new Set((targetBirdIds || []).map((id) => String(id)).filter(Boolean)),
    [targetBirdIds]
  );

  const loadTaxonomy = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.personal.getChecklistTaxonomy();
      if (!data?.success) {
        setError(data?.message || '加载名录进度失败');
        setSpecies([]);
        return;
      }
      setSpecies(data.data?.species || []);
      setObservedCount(Number(data.data?.observedCount || 0));
      setTotal(Number(data.data?.total || 0));
    } catch (err) {
      devError('加载名录进度失败:', err);
      setError('加载名录进度失败，请重试');
      setSpecies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxonomy();
  }, []);

  const filteredSpecies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return species.filter((bird) => {
      if (filter === 'unseen' && bird.observed) return false;
      if (filter === 'seen' && !bird.observed) return false;
      if (!q) return true;
      const name = String(bird.name || '').toLowerCase();
      const sci = String(bird.scientificName || '').toLowerCase();
      const orderCn = getOrderChineseName(bird.order).toLowerCase();
      const familyCn = getFamilyChineseName(bird.family).toLowerCase();
      return (
        name.includes(q) ||
        sci.includes(q) ||
        String(bird.order || '')
          .toLowerCase()
          .includes(q) ||
        String(bird.family || '')
          .toLowerCase()
          .includes(q) ||
        orderCn.includes(q) ||
        familyCn.includes(q)
      );
    });
  }, [species, search, filter]);

  const tree = useMemo(() => buildTree(filteredSpecies), [filteredSpecies]);

  // 搜索时自动展开匹配的目/科，方便直接看到结果
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    const nextOrders = new Set();
    const nextFamilies = new Set();
    tree.forEach((orderNode) => {
      nextOrders.add(orderNode.key);
      orderNode.families.forEach((familyNode) => {
        nextFamilies.add(`${orderNode.key}::${familyNode.key}`);
      });
    });
    setExpandedOrders(nextOrders);
    setExpandedFamilies(nextFamilies);
  }, [search, tree]);

  const progressPct = total > 0 ? Math.min(100, Math.round((observedCount / total) * 100)) : 0;

  const toggleOrder = (key) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFamily = (orderKey, familyKey) => {
    const key = `${orderKey}::${familyKey}`;
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return <PageState type="loading" title="名录进度加载中..." />;
  }

  if (error) {
    return <PageState type="error" title={error} actionLabel="重试" onAction={loadTaxonomy} />;
  }

  return (
    <section className={styles.root} id="taxonomy" aria-label="名录进度">
      <div className={styles.toolbar}>
        <div className={styles.summary}>
          <strong>
            已见 {observedCount} / {total}
          </strong>
          <span className={styles.summaryPct}>（{progressPct}%）</span>
        </div>
        <input
          type="search"
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索种名、学名、目、科"
          aria-label="搜索名录"
        />
        <div className={styles.filters} role="group" aria-label="观察状态筛选">
          {[
            { id: 'all', label: '全部' },
            { id: 'unseen', label: '只看未见' },
            { id: 'seen', label: '只看已见' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.filterBtn} ${filter === item.id ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      {tree.length === 0 ? (
        <p className={styles.empty}>没有符合条件的鸟种</p>
      ) : (
        <div className={styles.orderGrid}>
          {tree.map((orderNode) => {
            const orderOpen = expandedOrders.has(orderNode.key);
            const orderLabel = getOrderChineseName(orderNode.key);
            const orderTone = progressTone(orderNode.observed, orderNode.total);
            const orderPct =
              orderNode.total > 0
                ? Math.min(100, Math.round((orderNode.observed / orderNode.total) * 100))
                : 0;

            return (
              <article
                key={orderNode.key}
                className={`${styles.orderCard} ${orderOpen ? styles.orderCardOpen : ''} ${styles[`tone_${orderTone}`]}`}
              >
                <button
                  type="button"
                  className={styles.orderCardHeader}
                  onClick={() => toggleOrder(orderNode.key)}
                  aria-expanded={orderOpen}
                >
                  <div className={styles.cardTitleBlock}>
                    <span className={styles.orderTitle}>{orderLabel}</span>
                    {orderLabel !== orderNode.key ? (
                      <span className={styles.latin}>{orderNode.key}</span>
                    ) : null}
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.countBadge}>
                      {orderNode.observed}/{orderNode.total}
                    </span>
                    <span className={styles.cardPct}>{orderPct}%</span>
                    <span className={styles.chevron} aria-hidden="true">
                      {orderOpen ? '▾' : '▸'}
                    </span>
                  </div>
                  <div className={styles.cardProgress} aria-hidden="true">
                    <div className={styles.cardProgressFill} style={{ width: `${orderPct}%` }} />
                  </div>
                </button>

                {orderOpen ? (
                  <div className={styles.familyGrid}>
                    {orderNode.families.map((familyNode) => {
                      const familyKey = `${orderNode.key}::${familyNode.key}`;
                      const familyOpen = expandedFamilies.has(familyKey);
                      const familyLabel = getFamilyChineseName(familyNode.key);
                      const familyTone = progressTone(familyNode.observed, familyNode.total);
                      const familyPct =
                        familyNode.total > 0
                          ? Math.min(
                              100,
                              Math.round((familyNode.observed / familyNode.total) * 100)
                            )
                          : 0;

                      return (
                        <div
                          key={familyKey}
                          className={`${styles.familyCard} ${familyOpen ? styles.familyCardOpen : ''} ${styles[`tone_${familyTone}`]}`}
                        >
                          <button
                            type="button"
                            className={styles.familyCardHeader}
                            onClick={() => toggleFamily(orderNode.key, familyNode.key)}
                            aria-expanded={familyOpen}
                          >
                            <div className={styles.cardTitleBlock}>
                              <span className={styles.familyTitle}>{familyLabel}</span>
                              {familyLabel !== familyNode.key ? (
                                <span className={styles.latin}>{familyNode.key}</span>
                              ) : null}
                            </div>
                            <div className={styles.cardMeta}>
                              <span className={styles.countBadge}>
                                {familyNode.observed}/{familyNode.total}
                              </span>
                              <span className={styles.chevron} aria-hidden="true">
                                {familyOpen ? '▾' : '▸'}
                              </span>
                            </div>
                            <div className={styles.cardProgress} aria-hidden="true">
                              <div
                                className={styles.cardProgressFill}
                                style={{ width: `${familyPct}%` }}
                              />
                            </div>
                          </button>

                          {familyOpen ? (
                            <ul className={styles.speciesList}>
                              {familyNode.birds.map((bird) => {
                                const birdId = String(bird._id);
                                const inTarget = targetIdSet.has(birdId);
                                const isAdding = addingBirdId === birdId;
                                return (
                                  <li
                                    key={birdId}
                                    className={`${styles.speciesRow} ${
                                      bird.observed ? styles.speciesSeen : styles.speciesUnseen
                                    }`}
                                  >
                                    <div className={styles.speciesMain}>
                                      <span
                                        className={
                                          bird.observed ? styles.statusSeen : styles.statusUnseen
                                        }
                                      >
                                        {bird.observed ? '已见' : '未见'}
                                      </span>
                                      <SpeciesHoverChip
                                        name={bird.name}
                                        href={`/birds/${birdId}`}
                                        className={styles.speciesName}
                                      />
                                      {bird.scientificName ? (
                                        <span className={styles.sciName}>{bird.scientificName}</span>
                                      ) : null}
                                      {!bird.observed ? (
                                        <span className={styles.hintSlot}>
                                          {bird.hint?.summary || '观察建议稍后提供'}
                                        </span>
                                      ) : null}
                                    </div>
                                    {bird.observed ? (
                                      <span className={styles.seenMeta}>
                                        初见 {formatDate(bird.firstSeenDate) || '—'}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        className={styles.addBtn}
                                        disabled={
                                          inTarget ||
                                          isAdding ||
                                          typeof onAddTargetBird !== 'function'
                                        }
                                        onClick={() => onAddTargetBird?.(bird)}
                                      >
                                        {inTarget ? '已在目标' : isAdding ? '添加中…' : '加入目标'}
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
