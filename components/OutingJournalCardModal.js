'use client';
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from 'react';
import { getFamilyChineseName } from '@/data/taxonomyTranslation';
import { formatDisplayDate } from '@/utils/localDate';
import styles from '@/styles/OutingJournalCardModal.module.css';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getWeekdayLabel(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()] || '';
}

export default function OutingJournalCardModal({
  isOpen,
  onClose,
  record,
  effortLine = '',
}) {
  const cardRef = useRef(null);
  const [theme, setTheme] = useState('parchment');
  const [exporting, setExporting] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const summary = useMemo(() => {
    if (!record) return null;
    const birds = Array.isArray(record.birds) ? record.birds : [];
    const totalCount = birds.reduce((sum, item) => sum + (Number(item?.count) || 1), 0);
    const families = new Set();
    const highlights = [];
    const photos = [];
    const locationName =
      typeof record.location === 'object'
        ? record.location?.name || '未命名地点'
        : record.location || '未命名地点';

    birds.forEach((entry) => {
      const b =
        (entry?.birdId && typeof entry.birdId === 'object' ? entry.birdId : null) ||
        (entry?.bird && typeof entry.bird === 'object' ? entry.bird : null);
      const name = b?.name || entry?.name || '未知鸟种';
      if (b?.family) {
        families.add(getFamilyChineseName(b.family) || b.family);
      }
      const prot = b?.protectionLevel || '';
      if (prot.includes('一级') || prot.includes('二级') || prot.includes('I')) {
        highlights.push({ name, badge: prot });
      }
      const entryImgUrl = entry?.images?.[0]?.url || '';
      const birdImgUrl = b?.images?.[0]?.url || b?.imageUrl || '';
      const imgUrl = entryImgUrl || birdImgUrl;
      if (imgUrl && photos.length < 4 && !photos.some((p) => p.url === imgUrl)) {
        photos.push({ url: imgUrl, caption: entry?.images?.[0]?.caption || name });
      }
    });

    const recordImages = record.images || record.habitatImages || [];
    recordImages.forEach((img) => {
      const url = typeof img === 'string' ? img : img?.url;
      if (url && photos.length < 4 && !photos.some((p) => p.url === url)) {
        photos.push({ url, caption: img?.caption || '生境实拍' });
      }
    });

    return {
      birds,
      locationName,
      speciesCount: birds.length,
      totalCount,
      familyCount: families.size,
      highlights: highlights.slice(0, 6),
      photos: photos.slice(0, 4),
    };
  }, [record]);

  if (!isOpen || !record || !summary) return null;

  const dateText = formatDisplayDate(record.date, 'long');
  const weekday = getWeekdayLabel(record.date);

  const handleExportPng = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const el = cardRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: theme === 'slate' ? '#10232a' : '#fbf8f1',
        width: el.offsetWidth,
        height: el.scrollHeight,
        windowWidth: el.offsetWidth + 80,
        windowHeight: el.scrollHeight + 120,
        scrollY: 0,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeTitle = String(record.title || summary.locationName || '观鸟手账')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 36);
      link.download = `KBird_${safeTitle}_${formatDisplayDate(record.date, 'short')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('导出博物手账卡失败:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyTextReport = async () => {
    const lines = [
      `【${record.title || `${summary.locationName}观鸟手账`}】`,
      `📅 日期：${dateText} ${weekday}`,
      `📍 地点：${summary.locationName}${record.region ? ` (${record.region})` : ''}`,
      effortLine ? `🧭 努力量：${effortLine}` : null,
      record.weather ? `⛅ 天气：${record.weather}` : null,
      `🐦 统计：共记录 ${summary.speciesCount} 种 · ${summary.totalCount} 只${
        summary.familyCount ? `（涉 ${summary.familyCount} 科）` : ''
      }`,
      '',
      '📋 鸟种名录：',
      ...summary.birds.map((item, idx) => {
        const b =
          (item?.birdId && typeof item.birdId === 'object' ? item.birdId : null) ||
          (item?.bird && typeof item.bird === 'object' ? item.bird : null);
        const name = b?.name || item?.name || '未知鸟种';
        const tags = Array.isArray(item?.behaviorTags) && item.behaviorTags.length > 0
          ? ` [${item.behaviorTags.join('/')}]`
          : '';
        return `${idx + 1}. ${name} ×${item.count || 1}${tags}${item.notes ? ` — ${item.notes}` : ''}`;
      }),
      record.notes ? `\n📝 手记：${record.notes}` : null,
    ].filter((line) => line !== null);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2200);
    } catch (err) {
      console.error('复制文字战报失败:', err);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="野外博物手账卡预览与导出"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <h2 className={styles.toolbarTitle}>野外博物手账卡</h2>
            <div className={styles.themeTabs} role="group" aria-label="手账纸张风格">
              <button
                type="button"
                className={`${styles.themeBtn} ${theme === 'parchment' ? styles.themeBtnActive : ''}`}
                onClick={() => setTheme('parchment')}
              >
                宣纸米白
              </button>
              <button
                type="button"
                className={`${styles.themeBtn} ${theme === 'slate' ? styles.themeBtnActive : ''}`}
                onClick={() => setTheme('slate')}
              >
                深林墨绿
              </button>
            </div>
          </div>
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleCopyTextReport}
            >
              {copiedText ? '✓ 已复制文字战报' : '复制文字战报'}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleExportPng}
              disabled={exporting}
            >
              {exporting ? '正在渲染 PNG…' : '保存高清手账长图 (PNG)'}
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              关闭
            </button>
          </div>
        </header>

        <div className={styles.previewScroll}>
          <article
            ref={cardRef}
            className={`${styles.journalCard} ${
              theme === 'slate' ? styles.journalCardSlate : styles.journalCardParchment
            }`}
          >
            <div className={styles.cardTopStamp}>
              <span>KBIRD FIELD NOTEBOOK · 观鸟博物手账</span>
              <span>
                {dateText} {weekday}
              </span>
            </div>

            <h1 className={styles.cardTitle}>
              {record.title || `${summary.locationName}观察记录`}
            </h1>

            <div className={styles.cardMetaLine}>
              <span>📍 {summary.locationName}</span>
              {record.region ? <span>· {record.region}</span> : null}
              {record.weather ? <span>· ⛅ {record.weather}</span> : null}
              {effortLine ? <span>· 🧭 {effortLine}</span> : null}
            </div>

            <div className={styles.kpiRow}>
              <div className={styles.kpiBox}>
                <span className={styles.kpiVal}>{summary.speciesCount}</span>
                <span className={styles.kpiLabel}>记录鸟种</span>
              </div>
              <div className={styles.kpiBox}>
                <span className={styles.kpiVal}>{summary.totalCount}</span>
                <span className={styles.kpiLabel}>个体总数</span>
              </div>
              <div className={styles.kpiBox}>
                <span className={styles.kpiVal}>{summary.familyCount || '—'}</span>
                <span className={styles.kpiLabel}>涉及科数</span>
              </div>
              <div className={styles.kpiBox}>
                <span className={styles.kpiVal}>{summary.highlights.length}</span>
                <span className={styles.kpiLabel}>重点保护种</span>
              </div>
            </div>

            {summary.highlights.length > 0 ? (
              <div className={styles.highlightBox}>
                <span className={styles.highlightTag}>★ 重点关注</span>
                <div className={styles.highlightList}>
                  {summary.highlights.map((h, i) => (
                    <span key={i} className={styles.highlightChip}>
                      {h.name} <em>({h.badge})</em>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {summary.photos.length > 0 ? (
              <div
                className={`${styles.photoGrid} ${
                  summary.photos.length === 1 ? styles.photoGridSingle : ''
                }`}
              >
                {summary.photos.map((photo, idx) => (
                  <figure key={idx} className={styles.photoItem}>
                    <img src={photo.url} alt={photo.caption} crossOrigin="anonymous" />
                    <figcaption>{photo.caption}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}

            <div className={styles.speciesSection}>
              <div className={styles.sectionDivider}>
                <span>物种名录 ({summary.speciesCount} 种)</span>
              </div>
              <div className={styles.speciesGrid}>
                {summary.birds.map((item, idx) => {
                  const b =
                    (item?.birdId && typeof item.birdId === 'object' ? item.birdId : null) ||
                    (item?.bird && typeof item.bird === 'object' ? item.bird : null);
                  const name = b?.name || item?.name || '未知鸟种';
                  const tags = Array.isArray(item?.behaviorTags) ? item.behaviorTags : [];
                  return (
                    <div key={idx} className={styles.speciesCell}>
                      <div className={styles.speciesCellMain}>
                        <span className={styles.speciesIdx}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className={styles.speciesName}>{name}</span>
                        {tags.length > 0 ? (
                          <span className={styles.speciesTags}>
                            {tags.slice(0, 2).join('·')}
                          </span>
                        ) : null}
                      </div>
                      <span className={styles.speciesCount}>×{item.count || 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {record.notes ? (
              <blockquote className={styles.notesBlock}>
                <div className={styles.notesTitle}>野外手记 · Field Notes</div>
                <p>{record.notes}</p>
              </blockquote>
            ) : null}

            <footer className={styles.cardFooter}>
              <span>KBird 观鸟笔记本 · 个人本地博物志</span>
              <span>记录编号 #{String(record._id || '').slice(-6).toUpperCase()}</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
