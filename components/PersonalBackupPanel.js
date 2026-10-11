'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import PageState from './PageState';
import { useConfirmDialog } from './ConfirmDialog';
import { formatDisplayDateTime } from '@/utils/localDate';
import styles from '@/styles/PersonalBackup.module.css';

const HISTORY_KEY = 'kbird_backup_history';
const API_PREFIX = '/api/personal/backup';

function loadHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }
}

function parseFilenameFromDisposition(disposition) {
  const match = /filename="?([^"]+)"?/i.exec(disposition || '');
  return match ? match[1] : `kbird-archive-${new Date().toISOString().slice(0, 10)}.json`;
}

function formatSize(bytes) {
  if (!bytes || !Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractBackupSummary(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { recordsCount: null, checklistCount: null, projectsCount: null, mediaCount: null };
  }
  if (parsed.counts) {
    return {
      recordsCount: parsed.counts.records ?? null,
      checklistCount: parsed.counts.checklistSpecies ?? null,
      projectsCount: parsed.counts.projects ?? null,
      mediaCount: parsed.counts.mediaEmbedded ?? parsed.counts.mediaFiles ?? null,
    };
  }
  return {
    recordsCount: Array.isArray(parsed.records) ? parsed.records.length : 0,
    checklistCount: Array.isArray(parsed?.checklist?.observedBirds)
      ? parsed.checklist.observedBirds.length
      : 0,
    projectsCount: Array.isArray(parsed.projects) ? parsed.projects.length : 0,
    mediaCount: Array.isArray(parsed.media) ? parsed.media.filter((m) => m?.base64).length : 0,
  };
}

export default function PersonalBackupPanel() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [archive, setArchive] = useState(null);
  const [preview, setPreview] = useState(null);
  const [archiveName, setArchiveName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      setLoading(false);
      return;
    }
    if (!user && refreshUser) refreshUser().catch(() => null);
    setHistory(loadHistory());
    setLoading(false);
  }, [authLoading, refreshUser, user]);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const handleExport = async (mediaOverride) => {
    const withMedia = typeof mediaOverride === 'boolean' ? mediaOverride : includeMedia;
    if (typeof mediaOverride === 'boolean') {
      setIncludeMedia(mediaOverride);
    }
    setDownloading(true);
    setMessage('');
    try {
      const qs = withMedia ? '?includeMedia=1' : '';
      const response = await fetch(`${API_PREFIX}/export${qs}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`导出失败（${response.status}）`);

      const rawText = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
      const contentDisposition = response.headers.get('content-disposition');
      const filename = parseFilenameFromDisposition(contentDisposition);
      const summary = extractBackupSummary(parsed);
      const blob = new Blob([rawText], { type: 'application/json;charset=utf-8' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const nextHistory = [
        {
          name: filename,
          size: blob.size,
          downloadedAt: new Date().toISOString(),
          recordsCount: summary.recordsCount,
          checklistCount: summary.checklistCount,
          projectsCount: summary.projectsCount,
          mediaCount: summary.mediaCount,
          includeMedia: withMedia,
        },
        ...history,
      ].slice(0, 30);
      setHistory(nextHistory);
      saveHistory(nextHistory);

      if (summary.recordsCount === null) {
        setMessage('备份已下载，但摘要解析失败。');
      } else {
        const mediaHint = withMedia
          ? `，媒体已嵌入 ${summary.mediaCount ?? 0} 个文件`
          : '（仅结构化数据）';
        setMessage(
          `导出成功：记录 ${summary.recordsCount}，清单 ${summary.checklistCount}，项目 ${summary.projectsCount ?? 0}${mediaHint}。`
        );
      }
    } catch (error) {
      setMessage(error.message || '导出失败');
    } finally {
      setDownloading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handlePickArchive = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setMessage('');
    setPreview(null);
    setArchive(null);
    setArchiveName(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('备份文件格式无效');
      setArchive(parsed);

      const response = await fetch(`${API_PREFIX}/restore/preview`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `预览失败（${response.status}）`);
      }
      setPreview(data.data.preview);
      setMessage(`已加载「${file.name}」，请确认预览后合并到当前账号。`);
    } catch (error) {
      setArchive(null);
      setPreview(null);
      setMessage(error.message || '读取备份失败');
    }
  };

  const handleApplyRestore = async () => {
    if (!archive || !preview) return;
    const addRecords = preview.records?.add ?? 0;
    const addChecklist = preview.checklist?.add ?? 0;
    const addProjects = preview.projects?.add ?? 0;
    const ok = await ask({
      title: '确认合并备份',
      message: `确认合并「${archiveName || '备份文件'}」到当前账号？\n预计新增：记录 ${addRecords}、清单 ${addChecklist}、项目 ${addProjects}。\n重复项会跳过，不会清空现有数据。`,
      confirmLabel: '合并',
      cancelLabel: '取消',
    });
    if (!ok) return;
    setRestoring(true);
    setMessage('');
    try {
      const response = await fetch(`${API_PREFIX}/restore/apply`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(archive),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `恢复失败（${response.status}）`);
      }
      const r = data.data?.result || {};
      setMessage(
        `合并完成：新增记录 ${r.recordsAdded || 0}（跳过 ${r.recordsSkipped || 0}），清单补 ${r.checklistAdded || 0}，项目 ${r.projectsAdded || 0}，媒体 ${r.mediaRestored || 0}。`
      );
      setPreview(data.data?.preview || preview);
    } catch (error) {
      setMessage(error.message || '合并恢复失败');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteHistoryItem = async (index) => {
    const ok = await ask('从这份备份记录列表里删掉这一条？不会删掉已下载的文件。');
    if (!ok) return;
    const next = history.filter((_, idx) => idx !== index);
    setHistory(next);
    saveHistory(next);
  };

  if (authLoading || loading) {
    return <PageState type="loading" title="备份面板加载中..." />;
  }

  if (!user && typeof window !== 'undefined' && !localStorage.getItem('token')) {
    return (
      <PageState
        type="empty"
        title="需要登录"
        message="登录后可导出与恢复个人档案。"
        actionLabel="去登录"
        onAction={() => {
          if (typeof window !== 'undefined') window.location.assign('/login');
        }}
      />
    );
  }

  return (
    <div className={styles.panelRoot}>
      <div className={styles.panelInner}>
        {message ? <div className={styles.message}>{message}</div> : null}

        <div className={styles.fieldBlock}>
          <label className={styles.mediaOption}>
            <input
              type="checkbox"
              checked={includeMedia}
              onChange={(e) => setIncludeMedia(e.target.checked)}
            />
            导出时尽量包含媒体（照片/项目附件，过大时自动降级跳过部分文件）
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleExport()}
              disabled={downloading}
            >
              {downloading ? '导出中…' : '导出个人档案包'}
            </button>
          </div>
        </div>

        <section className={styles.block}>
          <h2>合并恢复</h2>
          <p className={styles.hint}>选择以前导出的 JSON 档案包，先预览将新增/跳过的条数，再合并到当前登录用户。</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className={styles.hiddenFile}
            onChange={handlePickArchive}
          />
          <div className={styles.actions}>
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              选择备份文件
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplyRestore}
              disabled={!archive || !preview || restoring}
            >
              {restoring ? '合并中…' : '确认合并到当前账号'}
            </button>
          </div>
          {archiveName ? <p className={styles.hint}>已选：{archiveName}</p> : null}
          {preview ? (
            <div className={styles.previewGrid}>
              <div>
                记录：新增 {preview.records?.add ?? 0} / 跳过 {preview.records?.skip ?? 0}（共{' '}
                {preview.records?.total ?? 0}）
              </div>
              <div>
                清单：新增 {preview.checklist?.add ?? 0} / 已有 {preview.checklist?.skip ?? 0}
              </div>
              <div>
                项目：新增 {preview.projects?.add ?? 0} / 同名跳过 {preview.projects?.skip ?? 0}
              </div>
              <div>
                媒体：可恢复 {preview.media?.restoreable ?? 0} / 清单 {preview.media?.listed ?? 0}
              </div>
              <div>设置：{preview.settings?.merge ? '将合并缺省字段' : '无'}</div>
            </div>
          ) : null}
        </section>

        <section className={styles.block}>
          <h2>最近导出记录（本机）</h2>
          {history.length === 0 ? (
            <p className={styles.hint}>还没有导出记录。点上方按钮开始第一次备份。</p>
          ) : (
            <div className={styles.backupItems}>
              {history.map((item, index) => (
                <div key={`${item.name}-${item.downloadedAt}-${index}`} className={styles.backupItem}>
                  <div className={styles.backupInfo}>
                    <div className={styles.backupName}>{item.name}</div>
                    <div className={styles.backupMeta}>
                      <span>{formatSize(item.size)}</span>
                      <span>{formatDisplayDateTime(item.downloadedAt)}</span>
                      <span>
                        记录 {item.recordsCount ?? '-'} / 清单 {item.checklistCount ?? '-'} / 项目{' '}
                        {item.projectsCount ?? '-'}
                      </span>
                      <span>{item.includeMedia ? '含媒体' : '仅数据'}</span>
                    </div>
                  </div>
                  <div className={styles.backupActions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleExport(Boolean(item.includeMedia))}
                      disabled={downloading}
                    >
                      按当时选项再导出
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => handleDeleteHistoryItem(index)}>
                      删除记录
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.block}>
          <h2>说明</h2>
          <ul className={styles.notes}>
            <li>档案包含：观鸟记录、清单/目标、个人设置、项目资料；可选嵌入媒体文件。</li>
            <li>恢复采用合并策略：重复记录（同日+同地点+同鸟种集合）会跳过；不会清空当前数据。</li>
            <li>鸟种库与地点词典不在个人包内（本机共享词典）。</li>
            <li>“最近导出记录”只保存在当前浏览器本地。</li>
          </ul>
        </section>
      </div>
      {confirmDialog}
    </div>
  );
}
