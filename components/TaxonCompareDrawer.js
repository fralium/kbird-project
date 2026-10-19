'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/utils/api';
import { getFullImageUrl } from '@/utils/imageUtils';
import { getOrderChineseName, getFamilyChineseName } from '@/data/taxonomyTranslation';
import PhenologyMonthBar from '@/components/PhenologyMonthBar';
import BirdNameAutocomplete from '@/components/BirdNameAutocomplete';
import {
  useCompareTray,
  toggleCompareItem,
  writeCompareTray,
  MAX_COMPARE_ITEMS,
} from '@/utils/compareStore';
import styles from '@/styles/TaxonCompareDrawer.module.css';

const COMPARE_ROWS = [
  {
    key: 'taxonomy',
    label: '分类阶元',
    render: (b) =>
      [
        b.order ? getOrderChineseName(b.order) : '',
        b.family ? getFamilyChineseName(b.family) : '',
        b.genus || '',
      ]
        .filter(Boolean)
        .join(' · ') || '—',
  },
  {
    key: 'protection',
    label: '保护等级',
    render: (b) =>
      [
        b.chinaProtectionLevel && b.chinaProtectionLevel !== '未列入'
          ? `中国 ${b.chinaProtectionLevel}`
          : '',
        b.iucnProtectionLevel ? `IUCN ${b.iucnProtectionLevel}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || '一般 / 未列入',
  },
  {
    key: 'identificationTips',
    label: '识别要点',
    highlight: true,
    render: (b) => b.identificationTips || b.description || '—',
  },
  {
    key: 'plumage',
    label: '羽色特征',
    highlight: true,
    render: (b) => b.plumage || '—',
  },
  {
    key: 'sizeAndShape',
    label: '体型 · 喙 · 腿脚',
    render: (b) =>
      [
        b.size ? `体型：${b.size}` : '',
        b.wingspan ? `翼展：${b.wingspan}` : '',
        b.bill ? `喙：${b.bill}` : '',
        b.legs ? `腿脚：${b.legs}` : '',
      ]
        .filter(Boolean)
        .join('\n') || '—',
  },
  {
    key: 'similarSpecies',
    label: '相似种辨析',
    render: (b) => b.similarSpecies || '—',
  },
  {
    key: 'habitat',
    label: '典型生境',
    render: (b) => b.habitat || '—',
  },
  {
    key: 'migration',
    label: '居留与迁徙',
    render: (b) => b.migration || '—',
  },
  {
    key: 'behaviorAndDiet',
    label: '行为与食性',
    render: (b) =>
      [b.behavior ? `行为：${b.behavior}` : '', b.diet ? `食性：${b.diet}` : '']
        .filter(Boolean)
        .join('\n') || '—',
  },
];

export default function TaxonCompareDrawer() {
  const { items, workbenchOpen, setWorkbenchOpen, remove, clear } = useCompareTray();
  const [detailedSpecies, setDetailedSpecies] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [photoIndexes, setPhotoIndexes] = useState({});

  useEffect(() => {
    if (!workbenchOpen || items.length === 0) {
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    Promise.all(
      items.map(async (item) => {
        try {
          const [birdRes, recRes] = await Promise.all([
            api.birds.getById(item._id),
            api.records.getByBird(item._id, { limit: 300, page: 1 }),
          ]);
          const birdData = birdRes?.success ? birdRes.data : item;
          const sightings = recRes?.success && Array.isArray(recRes.data) ? recRes.data : [];
          return { ...birdData, sightings };
        } catch {
          return { ...item, sightings: [] };
        }
      })
    )
      .then((results) => {
        if (!cancelled) setDetailedSpecies(results);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workbenchOpen, items]);

  if (items.length === 0 && !workbenchOpen) {
    return null;
  }

  const handleAddFromAutocomplete = (selectedBird) => {
    if (!selectedBird?._id) return;
    setSearchValue('');
    if (items.some((item) => String(item._id) === String(selectedBird._id))) return;
    if (items.length >= MAX_COMPARE_ITEMS) {
      const next = [...items.slice(1), {
        _id: String(selectedBird._id),
        name: selectedBird.name,
        scientificName: selectedBird.scientificName || '',
        primaryImage: selectedBird.images?.[0]?.url || '',
      }];
      writeCompareTray(next, { openWorkbench: workbenchOpen });
    } else {
      toggleCompareItem(selectedBird);
    }
  };

  return (
    <>
      {items.length > 0 && !workbenchOpen ? (
        <aside className={styles.dock} aria-label="物种对比栏">
          <div className={styles.dockInner}>
            <span className={styles.dockTitle}>
              对比台 ({items.length}/{MAX_COMPARE_ITEMS})
            </span>
            <div className={styles.dockPills}>
              {items.map((item) => (
                <span key={item._id} className={styles.dockPill}>
                  <span className={styles.dockPillName}>{item.name}</span>
                  <button
                    type="button"
                    className={styles.dockPillRemove}
                    onClick={() => remove(item._id)}
                    aria-label={`移除 ${item.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className={styles.dockActions}>
              <button
                type="button"
                className={styles.dockClearBtn}
                onClick={clear}
              >
                清空
              </button>
              <button
                type="button"
                className={styles.dockOpenBtn}
                onClick={() => setWorkbenchOpen(true)}
              >
                同屏对比 →
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {workbenchOpen ? (
        <div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label="相似种同屏对比台"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWorkbenchOpen(false);
          }}
        >
          <div className={styles.modal}>
            <header className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>相似种同屏对比台</h2>
                <p className={styles.modalSub}>
                  最多选 {MAX_COMPARE_ITEMS} 个物种，并排对比主图、1–12月物候期、羽色特征与识别要点
                </p>
              </div>
              <div className={styles.headerControls}>
                {items.length < MAX_COMPARE_ITEMS ? (
                  <div className={styles.adderWrap}>
                    <BirdNameAutocomplete
                      value={searchValue}
                      onChange={setSearchValue}
                      onSelect={handleAddFromAutocomplete}
                      placeholder="+ 搜索添加对比鸟种..."
                      className={styles.adderInput}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setWorkbenchOpen(false)}
                >
                  收起
                </button>
              </div>
            </header>

            <div className={styles.modalBody}>
              {loadingDetails ? (
                <div className={styles.loadingState}>正在加载对比物种档案与物候数据...</div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.compareTable}>
                    <thead>
                      <tr>
                        <th className={styles.labelCol}>对比维度</th>
                        {detailedSpecies.map((sp) => {
                          const allPhotos =
                            Array.isArray(sp.images) && sp.images.length > 0
                              ? sp.images
                                  .map((img) => getFullImageUrl(typeof img === 'string' ? img : img?.url))
                                  .filter(Boolean)
                              : sp.primaryImage
                              ? [getFullImageUrl(sp.primaryImage)]
                              : [];
                          const currentPhotoIdx =
                            allPhotos.length > 0
                              ? (photoIndexes[sp._id] || 0) % allPhotos.length
                              : 0;
                          const imgUrl = allPhotos[currentPhotoIdx] || '';
                          return (
                            <th key={sp._id} className={styles.speciesCol}>
                              <div className={styles.speciesHeaderCard}>
                                <div className={styles.speciesThumbWrap}>
                                  {imgUrl ? (
                                    <Image
                                      src={imgUrl}
                                      alt={sp.name}
                                      fill
                                      unoptimized
                                      className={styles.speciesThumb}
                                    />
                                  ) : (
                                    <div className={styles.noThumb}>{sp.name}</div>
                                  )}
                                  {allPhotos.length > 1 ? (
                                    <div className={styles.photoPager}>
                                      <button
                                        type="button"
                                        className={styles.photoPagerBtn}
                                        onClick={() =>
                                          setPhotoIndexes((prev) => ({
                                            ...prev,
                                            [sp._id]:
                                              ((prev[sp._id] || 0) - 1 + allPhotos.length) %
                                              allPhotos.length,
                                          }))
                                        }
                                        aria-label="上一张照片"
                                        title="上一张照片"
                                      >
                                        ‹
                                      </button>
                                      <span className={styles.photoPagerCount}>
                                        {currentPhotoIdx + 1}/{allPhotos.length}
                                      </span>
                                      <button
                                        type="button"
                                        className={styles.photoPagerBtn}
                                        onClick={() =>
                                          setPhotoIndexes((prev) => ({
                                            ...prev,
                                            [sp._id]: ((prev[sp._id] || 0) + 1) % allPhotos.length,
                                          }))
                                        }
                                        aria-label="下一张照片"
                                        title="下一张照片"
                                      >
                                        ›
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                <div className={styles.speciesHeaderMeta}>
                                  <div className={styles.speciesTitleRow}>
                                    <Link
                                      href={`/birds/${sp._id}`}
                                      className={styles.speciesLink}
                                      onClick={() => setWorkbenchOpen(false)}
                                    >
                                      {sp.name}
                                    </Link>
                                    <button
                                      type="button"
                                      className={styles.removeColBtn}
                                      onClick={() => remove(sp._id)}
                                      title="移出对比"
                                    >
                                      移除
                                    </button>
                                  </div>
                                  {sp.scientificName ? (
                                    <span className={styles.speciesLatin}>{sp.scientificName}</span>
                                  ) : null}
                                  <span className={styles.speciesStats}>
                                    本机记录 {(sp.sightings || []).length} 次 · 图库{' '}
                                    {(sp.images || []).length} 张
                                  </span>
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row" className={styles.rowLabel}>
                          1–12月物候期
                        </th>
                        {detailedSpecies.map((sp) => (
                          <td key={`${sp._id}-pheno`} className={styles.cell}>
                            <PhenologyMonthBar
                              sightings={sp.sightings || []}
                              images={sp.images || []}
                              migrationText={sp.migration || ''}
                              compact
                            />
                          </td>
                        ))}
                      </tr>
                      {COMPARE_ROWS.map((row) => (
                        <tr
                          key={row.key}
                          className={row.highlight ? styles.rowHighlight : undefined}
                        >
                          <th scope="row" className={styles.rowLabel}>
                            {row.label}
                          </th>
                          {detailedSpecies.map((sp) => (
                            <td key={`${sp._id}-${row.key}`} className={styles.cell}>
                              <div className={styles.cellText}>{row.render(sp)}</div>
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <th scope="row" className={styles.rowLabel}>
                          鸣声对比
                        </th>
                        {detailedSpecies.map((sp) => (
                          <td key={`${sp._id}-calls`} className={styles.cell}>
                            {Array.isArray(sp.calls) && sp.calls.length > 0 ? (
                              <audio
                                controls
                                preload="metadata"
                                src={getFullImageUrl(sp.calls[0].url)}
                                className={styles.audioPlayer}
                              />
                            ) : (
                              <span className={styles.muted}>暂无录音</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
