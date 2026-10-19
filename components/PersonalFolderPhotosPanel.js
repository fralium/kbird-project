'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';
import { saveRecordDraft } from '@/utils/recordDraft';
import styles from '@/styles/FolderPhotos.module.css';

const formatBytes = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const DATE_SOURCE_LABELS = {
  exif: 'EXIF 快门时间',
  filename: '文件名日期',
  mtime: '文件时间',
};

const toast = (message, type = 'success') => {
  if (typeof window !== 'undefined' && window.showToast) {
    window.showToast(message, type, 2800);
  }
};

const folderStatus = (folder, last) => {
  if (last?.failed) {
    return {
      tone: 'fail',
      text: last.uploaded
        ? `本次：成功 ${last.uploaded} 张，失败 ${last.failed} 张`
        : `本次：失败 ${last.failed} 张`,
    };
  }
  if (last?.uploaded) {
    return { tone: 'ok', text: `本次：成功上传 ${last.uploaded} 张` };
  }
  if (folder.newCount > 0) {
    return { tone: 'wait', text: `待上传 ${folder.newCount} 张` };
  }
  if ((folder.totalCount || 0) > 0) {
    return { tone: 'sync', text: '已在图库，无需再传' };
  }
  return { tone: 'empty', text: '文件夹是空的' };
};

export default function PersonalFolderPhotosPanel() {
  const router = useRouter();
  const [rootPath, setRootPath] = useState('');
  const [picking, setPicking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [applyResult, setApplyResult] = useState(null);
  const [showPaste, setShowPaste] = useState(false);
  const [openLarge, setOpenLarge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.personal
      .getSettings({ skipAuthHandling: true })
      .then((data) => {
        if (cancelled || !data?.success) return;
        const saved = String(data.data?.localBirdPhotoRoot || '').trim();
        if (saved) setRootPath(saved);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const lastByFolder = useMemo(() => {
    const map = new Map();
    (applyResult?.folders || []).forEach((item) => {
      map.set(item.folder, item);
    });
    return map;
  }, [applyResult]);

  const totals = useMemo(() => {
    const matched = preview?.matched || [];
    const base = matched.reduce(
      (acc, folder) => {
        acc.species += 1;
        acc.total += folder.totalCount || (folder.photos || []).length;
        acc.fresh += folder.newCount || 0;
        acc.existing += folder.duplicateCount || 0;
        acc.large += folder.largeCount || 0;
        return acc;
      },
      { species: 0, total: 0, fresh: 0, existing: 0, large: 0 }
    );
    return {
      ...base,
      exifCount: Number(preview?.exifCount || applyResult?.exifCount || 0),
      taggedCount: Number(preview?.taggedCount || applyResult?.taggedCount || 0),
      locationMatchedCount: Number(preview?.locationMatchedCount || 0),
    };
  }, [preview, applyResult]);

  const activeDateClusters = useMemo(() => {
    if (Array.isArray(preview?.dateClusters) && preview.dateClusters.length > 0) {
      return preview.dateClusters;
    }
    if (Array.isArray(applyResult?.dateClusters) && applyResult.dateClusters.length > 0) {
      return applyResult.dateClusters;
    }
    return [];
  }, [preview, applyResult]);

  const applyBanner = useMemo(() => {
    if (!applyResult) return null;
    const uploaded = Number(applyResult.uploaded || 0);
    const failed = Number(applyResult.failed || 0);
    const skipped = Number(applyResult.skipped || 0);
    if (uploaded > 0 && failed === 0) {
      const metaBits = [];
      if (applyResult.exifCount > 0) metaBits.push(`EXIF 日期 ${applyResult.exifCount} 张`);
      if (applyResult.taggedCount > 0) metaBits.push(`自动识别标签 ${applyResult.taggedCount} 张`);
      const suffix = metaBits.length ? `（已自动填入 ${metaBits.join('、')}）` : '';
      return { tone: 'ok', text: `上传成功：新进图库 ${uploaded} 张${suffix}。` };
    }
    if (uploaded > 0) {
      return {
        tone: 'warn',
        text: `上传完成：成功 ${uploaded} 张，失败 ${failed} 张，跳过 ${skipped} 张。`,
      };
    }
    if (failed > 0) {
      return { tone: 'fail', text: `没有传进去：失败 ${failed} 张，跳过 ${skipped} 张。` };
    }
    return { tone: 'sync', text: '没有新照片，已全部在图库里。' };
  }, [applyResult]);

  const handleCreateRecordFromCluster = (cluster) => {
    if (!cluster || !Array.isArray(cluster.birds) || cluster.birds.length === 0) return;
    const draft = {
      date: cluster.dateKey,
      location: {
        name: cluster.locationName || '',
        coordinates: Array.isArray(cluster.coordinates) ? cluster.coordinates : [0, 0],
        address: cluster.address || {},
      },
      notes: `由分类照片文件夹自动聚类生成（${cluster.dateKey} · ${cluster.photoCount} 张新照片）`,
      birds: cluster.birds.map((sp) => ({
        bird: {
          _id: sp.birdId,
          name: sp.birdName,
          scientificName: sp.scientificName || '',
        },
        birdId: sp.birdId,
        count: 1,
        behaviorTags: sp.tags?.includes('飞翔') ? ['飞过'] : ['目击'],
        notes: Array.isArray(sp.tags) && sp.tags.length > 0 ? `影像标签：${sp.tags.join('、')}` : '',
        images: [],
      })),
    };
    saveRecordDraft(draft);
    toast(`已生成 ${cluster.dateKey} 观察草稿（${cluster.birds.length} 种）`);
    router.push('/records/add');
  };

  const handlePick = async () => {
    setPicking(true);
    setError('');
    setPreview(null);
    setApplyResult(null);
    try {
      const data = await api.personal.pickFolderPhotos({ rootPath });
      if (!data?.success) throw new Error(data?.message || '选择文件夹失败');
      if (data.data?.cancelled) {
        toast('还没有选文件夹', 'warning');
        return;
      }
      const picked = String(data.data?.rootPath || '').trim();
      if (!picked) throw new Error('没有拿到文件夹路径');
      setRootPath(picked);
      toast('已选中总文件夹，下一步扫描');
    } catch (err) {
      setShowPaste(true);
      setError(err.message || '选择文件夹失败');
    } finally {
      setPicking(false);
    }
  };

  const handleScan = async () => {
    if (!rootPath.trim()) {
      toast('请先选中总文件夹', 'warning');
      return;
    }
    setScanning(true);
    setError('');
    setApplyResult(null);
    try {
      const data = await api.personal.previewFolderPhotos({ rootPath });
      if (!data?.success) throw new Error(data?.message || '扫描失败');
      setPreview(data.data);
      const fresh = (data.data?.matched || []).reduce((sum, folder) => sum + (folder.newCount || 0), 0);
      toast(fresh ? `扫描完成，有 ${fresh} 张新照片` : '扫描完成，没有新照片');
    } catch (err) {
      setPreview(null);
      setError(err.message || '扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    const files = (preview.matched || []).flatMap((folder) =>
      (folder.photos || [])
        .filter((photo) => !photo.duplicate)
        .map((photo) => ({ folder: folder.folder, fileName: photo.fileName }))
    );
    if (!files.length) {
      toast('没有新照片可传', 'warning');
      return;
    }
    setApplying(true);
    setError('');
    try {
      const data = await api.personal.applyFolderPhotos({ rootPath: preview.rootPath, files });
      if (!data?.success) throw new Error(data?.message || '上传失败');
      setApplyResult(data.data);
      if (data.data.failed) {
        toast(`上传完成：成功 ${data.data.uploaded}，失败 ${data.data.failed}`, 'warning');
      } else {
        toast(`上传成功 ${data.data.uploaded} 张`);
      }
      const refreshed = await api.personal.previewFolderPhotos({ rootPath: preview.rootPath });
      if (refreshed?.success) setPreview(refreshed.data);
    } catch (err) {
      setError(err.message || '上传失败');
    } finally {
      setApplying(false);
    }
  };

  const canScan = Boolean(rootPath.trim()) && !picking && !scanning && !applying;
  const canUpload = Boolean(totals.fresh) && !applying && !scanning;
  const step = !rootPath.trim() ? 1 : preview ? 3 : 2;
  const matched = [...(preview?.matched || [])].sort((a, b) => {
    if ((b.newCount || 0) !== (a.newCount || 0)) return (b.newCount || 0) - (a.newCount || 0);
    return String(a.birdName).localeCompare(String(b.birdName), 'zh');
  });

  return (
    <div className={styles.root}>
      <ol className={styles.steps} aria-label="导入步骤">
        <li className={step >= 1 ? styles.stepOn : ''}>选总文件夹</li>
        <li className={step >= 2 ? styles.stepOn : ''}>扫描对照</li>
        <li className={step >= 3 ? styles.stepOn : ''}>上传新照片</li>
      </ol>

      <div className={styles.toolbar}>
        <div className={styles.selected}>
          <span className={styles.fieldLabel}>当前总文件夹</span>
          <p className={styles.path}>{rootPath || '还没选'}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={handlePick} disabled={picking || applying}>
            {picking ? '等待选择窗…' : rootPath ? '重选文件夹' : '选择总文件夹'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleScan} disabled={!canScan}>
            {scanning ? '扫描中…' : preview ? '重新扫描' : '扫描对照'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply} disabled={!canUpload}>
            {applying ? '上传中…' : totals.fresh ? `上传 ${totals.fresh} 张新照片` : '没有新照片'}
          </button>
        </div>
        <button type="button" className={styles.pasteToggle} onClick={() => setShowPaste((open) => !open)}>
          {showPaste ? '收起路径粘贴' : '或粘贴路径'}
        </button>
        {showPaste ? (
          <label>
            <span className={styles.fieldLabel}>本机分类照片文件夹</span>
            <input
              className={styles.input}
              value={rootPath}
              onChange={(event) => {
                setRootPath(event.target.value);
                setPreview(null);
                setApplyResult(null);
              }}
              placeholder="例如 C:\path\to\bird-photos"
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <div className={`${styles.banner} ${styles.banner_fail}`} role="alert">
          {error}
        </div>
      ) : null}

      {applyBanner ? (
        <div className={`${styles.banner} ${styles[`banner_${applyBanner.tone}`]}`} role="status">
          {applyBanner.text}
          {applyResult?.failures?.length ? (
            <ul className={styles.failList}>
              {applyResult.failures.slice(0, 8).map((item) => (
                <li key={`${item.folder}-${item.fileName}`}>
                  {item.folder} · {item.fileName}：{item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className={styles.summary} aria-label="扫描汇总">
          <div>
            <strong>{totals.species}</strong>
            <span>对照上的鸟种</span>
          </div>
          <div>
            <strong>{totals.total}</strong>
            <span>目录里的照片</span>
          </div>
          <div className={totals.fresh ? styles.summaryFresh : ''}>
            <strong>{totals.fresh}</strong>
            <span>待上传</span>
          </div>
          <div>
            <strong>{totals.existing}</strong>
            <span>已在图库</span>
          </div>
          {totals.exifCount > 0 ? (
            <div>
              <strong>{totals.exifCount}</strong>
              <span>EXIF 真实日期</span>
            </div>
          ) : null}
          {totals.taggedCount > 0 ? (
            <div>
              <strong>{totals.taggedCount}</strong>
              <span>自动识别标签</span>
            </div>
          ) : null}
          {preview.unmatched?.length ? (
            <div>
              <strong>{preview.unmatched.length}</strong>
              <span>没对上名录</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className={styles.note}>
          选好总文件夹后扫描。可以是鸟种直接放根下，也可以是 目 / 科 / 鸟种 三层。扫描会自动提取照片 EXIF 拍摄时间、GPS 与文件名里的特征标签（如雄鸟/雌鸟/亚成/繁殖羽/飞版），并支持按拍摄日期一键生成观察记录草稿。
        </p>
      )}

      {activeDateClusters.length > 0 ? (
        <section className={styles.clusterBox} aria-label="按拍摄日期生成观察记录">
          <div className={styles.clusterHead}>
            <div>
              <h3 className={styles.clusterTitle}>顺手生成当日观察记录</h3>
              <p className={styles.clusterSub}>
                已按快门日期将本次新照片聚合成 {activeDateClusters.length} 个观鸟日，点击可一键带入鸟种与日期去建单
              </p>
            </div>
          </div>
          <div className={styles.clusterList}>
            {activeDateClusters.slice(0, 6).map((cluster) => (
              <div key={cluster.dateKey} className={styles.clusterItem}>
                <div className={styles.clusterMeta}>
                  <div className={styles.clusterDateRow}>
                    <strong className={styles.clusterDate}>{cluster.dateKey}</strong>
                    <span className={styles.clusterBadge}>
                      {DATE_SOURCE_LABELS[cluster.dateSource] || '文件时间'}
                    </span>
                    {cluster.locationName ? (
                      <span className={styles.clusterLoc}>📍 {cluster.locationName}</span>
                    ) : null}
                  </div>
                  <p className={styles.clusterSpecies}>
                    共 <b>{cluster.speciesCount}</b> 种（{cluster.photoCount} 张新图）：
                    {cluster.birds
                      .slice(0, 8)
                      .map((b) => b.birdName)
                      .join('、')}
                    {cluster.birds.length > 8 ? ` 等` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.clusterActionBtn}
                  onClick={() => handleCreateRecordFromCluster(cluster)}
                >
                  生成该日记录草稿 →
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {preview?.largeFiles?.length ? (
        <div className={styles.warn}>
          <button type="button" className={styles.warnToggle} onClick={() => setOpenLarge((open) => !open)}>
            {preview.largeFiles.length} 张大于 5MB，上传会占较多空间
            {openLarge ? ' · 收起' : ' · 查看名单'}
          </button>
          {openLarge ? (
            <ul className={styles.warnList}>
              {preview.largeFiles.slice(0, 20).map((item) => (
                <li key={`${item.folder}-${item.fileName}`}>
                  {item.birdName} · {item.fileName} · {formatBytes(item.bytes)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {matched.length ? (
        <div className={styles.list}>
          <div className={styles.listHead} aria-hidden="true">
            <span>鸟种 / 文件夹</span>
            <span>目录</span>
            <span>待上传</span>
            <span>已在图库</span>
            <span>状态</span>
          </div>
          {matched.map((folder) => {
            const last = lastByFolder.get(folder.folder);
            const status = folderStatus(folder, last);
            const total = folder.totalCount || (folder.photos || []).length;
            return (
              <article key={folder.folder} className={styles.row}>
                <div className={styles.rowName}>
                  <Link href={`/birds/${folder.birdId}`} className={styles.link}>
                    {folder.birdName}
                  </Link>
                  {folder.folder !== folder.birdName ? (
                    <span className={styles.folderAlias}>{folder.folder}</span>
                  ) : null}
                  {Array.isArray(folder.inferredTags) && folder.inferredTags.length > 0 ? (
                    <div className={styles.folderTagRow}>
                      {folder.inferredTags.map((tag) => (
                        <span key={tag} className={styles.folderTagChip}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={styles.stat}>
                  <b>{total}</b>
                  <span className={styles.statLabel}>张</span>
                </div>
                <div className={`${styles.stat} ${folder.newCount ? styles.statFresh : ''}`}>
                  <b>{folder.newCount}</b>
                  <span className={styles.statLabel}>张</span>
                </div>
                <div className={styles.stat}>
                  <b>{folder.duplicateCount}</b>
                  <span className={styles.statLabel}>张</span>
                </div>
                <p className={`${styles.status} ${styles[`status_${status.tone}`]}`}>{status.text}</p>
              </article>
            );
          })}
        </div>
      ) : null}

      {preview?.unmatched?.length ? (
        <div className={styles.unmatched}>
          <p className={styles.unmatchedTitle}>没对上名录的文件夹（{preview.unmatched.length}）</p>
          <p className={styles.unmatchedBody}>
            {preview.unmatched
              .slice(0, 16)
              .map((item) => `${item.folder}（${item.fileCount} 张）`)
              .join('、')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
