'use client';
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from './AuthProvider';
import RequestNewBirdButton from './RequestNewBirdButton';
import PageState from './PageState';
import { api } from '../utils/api';
import styles from '../styles/ImportData.module.css';

export default function PersonalImportPanel() {
  const { user, token, loading: authLoading } = useAuth();
  const [format, setFormat] = useState('json');
  const [strategy, setStrategy] = useState('skip');
  const [content, setContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [cbrcRows, setCbrcRows] = useState(null);
  const [preview, setPreview] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [applyFeedback, setApplyFeedback] = useState(null);
  const [message, setMessage] = useState('');
  const cbrcMode = Array.isArray(cbrcRows) && cbrcRows.length > 0;
  const isCbrcFormat = format === 'cbrc';
  const formatApplyFeedback = (result) => {
    const created = Number(result?.created || 0);
    const merged = Number(result?.merged || 0);
    const overwritten = Number(result?.overwritten || 0);
    const skipped = Number(result?.skipped || 0);
    const failed = Number(result?.failed || 0);
    const imported = created + merged + overwritten;

    if (imported > 0 && skipped === 0 && failed === 0) {
      return { level: 'success', text: `导入成功：共写入 ${imported} 条记录。` };
    }
    if (imported > 0) {
      return { level: 'warning', text: `导入完成：写入 ${imported} 条，跳过 ${skipped} 条，失败 ${failed} 条。` };
    }
    return { level: failed > 0 ? 'error' : 'warning', text: `未写入新记录：跳过 ${skipped} 条，失败 ${failed} 条。` };
  };

  const statusLabel = (status) => {
    if (status === 'ready') return '可导入';
    if (status === 'warning') return '需注意';
    if (status === 'invalid') return '无效';
    return status || '—';
  };

  const [resolvedUnmatchedNames, setResolvedUnmatchedNames] = useState(() => new Set());

  const unmatchedBirdNames = useMemo(() => {
    const names = new Set();
    const rows = Array.isArray(preview?.rows) ? preview.rows : [];
    rows.forEach((row) => {
      const list = [
        ...(Array.isArray(row.unresolvedBirds) ? row.unresolvedBirds : []),
        ...(Array.isArray(row.skippedNames) ? row.skippedNames : []),
      ];
      list.forEach((item) => {
        const name = typeof item === 'string' ? item : item?.chineseName || item?.name || '';
        const trimmed = String(name).trim();
        if (trimmed) names.add(trimmed);
      });
    });
    if (Array.isArray(applyResult?.skippedBirdSamples)) {
      applyResult.skippedBirdSamples.forEach((item) => {
        const raw = String(item || '').trim();
        if (!raw) return;
        const cn = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (cn) names.add(cn);
      });
    }
    return Array.from(names)
      .filter((name) => !resolvedUnmatchedNames.has(name))
      .slice(0, 40);
  }, [preview, applyResult, resolvedUnmatchedNames]);

  const fillSampleTemplate = () => {
    if (format === 'json') {
      setContent(`[
  {
    "date": "2026-05-01",
    "locationName": "午潮山国家森林公园",
    "birds": "白鹭:2;麻雀:5",
    "notes": "晨间巡山"
  },
  {
    "date": "2026-05-02",
    "locationName": "西溪湿地",
    "birds": "夜鹭:1;苍鹭:2",
    "weather": "阴",
    "temperature": 22
  }
]`);
      return;
    }

    setContent(
      'date,locationName,birds,notes,weather,temperature\n' +
        '2026-05-01,午潮山国家森林公园,"白鹭:2;麻雀:5",晨间巡山,晴,24\n' +
        '2026-05-02,西溪湿地,"夜鹭:1;苍鹭:2",傍晚观察,阴,22'
    );
  };

  const downloadTemplate = () => {
    const fileName = format === 'json' ? 'kbird-import-template.json' : 'kbird-import-template.csv';
    const fileContent =
      format === 'json'
        ? `[
  {
    "date": "2026-05-01",
    "locationName": "午潮山国家森林公园",
    "birds": "白鹭:2;麻雀:5",
    "notes": "晨间巡山",
    "weather": "晴",
    "temperature": 24,
    "humidity": 62,
    "wind": "微风"
  }
]`
        : 'date,locationName,birds,notes,weather,temperature,humidity,wind\n' +
          '2026-05-01,午潮山国家森林公园,"白鹭:2;麻雀:5",晨间巡山,晴,24,62,微风';

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = String(file.name || '');
    const extension = fileName.toLowerCase().split('.').pop();
    if (!['json', 'csv', 'xls', 'xlsx'].includes(extension)) {
      setMessage('仅支持 .json / .csv / .xls / .xlsx 文件');
      return;
    }

    setLoadingFile(true);
    setMessage('');
    setPreview(null);
    setApplyResult(null);
    setApplyFeedback(null);

    try {
      if (extension === 'xls' || extension === 'xlsx') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames?.[0];
        if (!firstSheetName) {
          throw new Error('Excel 文件中没有可用工作表');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        if (!Array.isArray(rows) || rows.length < 2) {
          throw new Error('Excel 内容不足，至少需要表头 + 1 行数据');
        }

        setCbrcRows(rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : [])));
        setContent('');
        setFormat('cbrc');
        setMessage(`已读取表格：${fileName}（中国鸟类记录中心模式）`);
      } else {
        const text = await file.text();
        setContent(text);
        setCbrcRows(null);
        setFormat(extension === 'json' ? 'json' : 'csv');
        setMessage(`已读取文件：${fileName}`);
      }

      setSelectedFileName(fileName);
    } catch (error) {
      setMessage(error.message || '文件读取失败');
    } finally {
      setLoadingFile(false);
    }
  };

  if (authLoading) {
    return <PageState type="loading" title="导入面板加载中..." />;
  }
  if (!user || !token) {
    return (
      <PageState
        type="empty"
        title="需要登录"
        message="登录后可导入观察记录。"
        actionLabel="去登录"
        onAction={() => {
          if (typeof window !== 'undefined') window.location.assign('/login');
        }}
      />
    );
  }

  const runPreview = async () => {
    if (isCbrcFormat || cbrcMode) {
      if (!cbrcMode) {
        setMessage('请先上传中国鸟类记录中心 XLS/XLSX 文件');
        return;
      }
      setLoadingPreview(true);
      setMessage('');
      setApplyResult(null);
      setApplyFeedback(null);
      try {
        const data = await api.personal.importCbrcPreview({ rows: cbrcRows });
        if (!data.success) {
          setMessage(data.message || '预览失败');
          setPreview(null);
          return;
        }
        const summary = data.data?.summary || {};
        const sessions = Array.isArray(data.data?.sessions) ? data.data.sessions : [];
        const mappedRows = sessions.map((item) => {
          const hasDuplicate = !!(item.duplicateByReportId || item.duplicateOfExisting || item.duplicateInBatch || item.duplicateInBatchByReportId);
          const hasSkippedBirds = Array.isArray(item.skippedNames) && item.skippedNames.length > 0;
          const status = item.status !== 'ok' ? 'invalid' : hasDuplicate || hasSkippedBirds ? 'warning' : 'ready';
          const issues = [];
          if (item.status !== 'ok') issues.push('行数据无效');
          if (hasDuplicate) issues.push('存在潜在重复记录');
          if (hasSkippedBirds) issues.push(`未匹配鸟类：${item.skippedNames.slice(0, 3).join('、')}`);
          const birdsResolved = Array.isArray(item.birdsResolved) ? item.birdsResolved : [];
          const birdPreviewNames = birdsResolved
            .slice(0, 6)
            .map((bird) => `${bird.chineseName}${bird.count > 1 ? ` x${bird.count}` : ''}`)
            .join('、');
          const matchedCount = birdsResolved.filter((bird) => bird.matched).length;
          return {
            rowIndex: Number(item.index) + 1,
            status,
            issues,
            skippedNames: hasSkippedBirds ? item.skippedNames : [],
            unresolvedBirds: hasSkippedBirds ? item.skippedNames : [],
            potentialConflict: item.duplicateByReportId || item.duplicateOfExisting || null,
            preview: {
              dateDisplay: item.dateDisplay || '—',
              locationName: item.locationDisplay || '—',
              birdsResolved: matchedCount,
              birdsRaw: birdsResolved.length,
              birdNames: birdPreviewNames || '—',
            },
          };
        });
        setPreview({
          summary: {
            total: Number(summary.sessionCount || 0),
            ready: Number(summary.wouldImportIfSkipDup || 0),
            warning: Number(summary.duplicateWithExisting || 0) + Number(summary.duplicateWithinUpload || 0),
            invalid: Number(summary.invalidSessions || 0),
            potentialConflicts: Number(summary.duplicateWithExisting || 0),
          },
          rows: mappedRows,
        });
        setResolvedUnmatchedNames(new Set());
        setMessage('预览成功，请确认后执行导入');
      } catch (error) {
        setMessage(error.message || '预览失败');
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
      return;
    }

    if (!content.trim()) {
      setMessage('请先粘贴导入内容');
      return;
    }
    setLoadingPreview(true);
    setMessage('');
    setApplyResult(null);
    setApplyFeedback(null);
    try {
      const data = await api.personal.importPreview({
        format,
        content,
      });
      if (!data.success) {
        setMessage(data.message || '预览失败');
        setPreview(null);
        return;
      }
      setPreview(data.data);
      setResolvedUnmatchedNames(new Set());
      setMessage('预览成功，请确认后执行导入');
    } catch (error) {
      setMessage(error.message || '预览失败');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runApply = async () => {
    if (!preview) {
      setMessage('请先执行预览');
      return;
    }

    if (isCbrcFormat || cbrcMode) {
      if (!cbrcMode) {
        setMessage('请先上传中国鸟类记录中心 XLS/XLSX 文件');
        return;
      }
      setLoadingApply(true);
      setMessage('');
      try {
        const data = await api.personal.importCbrcApply({
          rows: cbrcRows,
          skipDuplicates: true,
        });
        if (!data.success) {
          setMessage('');
          setApplyFeedback({ level: 'error', text: data.message || '导入失败' });
          return;
        }
        const applyData = data.data || {};
        const normalizedResult = {
          created: Number(applyData.created || 0),
          merged: 0,
          overwritten: 0,
          skipped: Number(applyData.skippedDuplicate || 0),
          failed: Array.isArray(applyData.errors) ? applyData.errors.length : 0,
          details: [],
          skippedBirdSamples: Array.isArray(applyData.skippedBirdSamples)
            ? applyData.skippedBirdSamples
            : [],
          errorSamples: Array.isArray(applyData.errors)
            ? applyData.errors.slice(0, 5).map((item) => `第 ${Number(item.index) + 1} 行：${item.message || '导入失败'}`)
            : [],
        };
        setApplyResult(normalizedResult);
        setApplyFeedback(formatApplyFeedback(normalizedResult));
        setMessage('');
      } catch (error) {
        setMessage('');
        setApplyFeedback({ level: 'error', text: error.message || '导入失败' });
      } finally {
        setLoadingApply(false);
      }
      return;
    }

    setLoadingApply(true);
    setMessage('');
    try {
      const data = await api.personal.importApply({
        format,
        content,
        strategy,
      });
      if (!data.success) {
        setMessage('');
        setApplyFeedback({ level: 'error', text: data.message || '导入失败' });
        return;
      }
      const applyData = data.data || {};
      const normalizedResult = {
        ...applyData,
        errorSamples: Array.isArray(applyData.details)
          ? applyData.details
              .filter((item) => item.status === 'failed')
              .slice(0, 5)
              .map((item) => `第 ${item.rowIndex} 行：${item.reason || '导入失败'}`)
          : [],
      };
      setApplyResult(normalizedResult);
      setApplyFeedback(formatApplyFeedback(normalizedResult));
      setMessage('');
    } catch (error) {
      setMessage('');
      setApplyFeedback({ level: 'error', text: error.message || '导入失败' });
    } finally {
      setLoadingApply(false);
    }
  };

  const statusTone =
    applyFeedback?.level ||
    (message && /失败|错误|仅支持|请先/.test(message) ? 'error' : message ? 'info' : '');

  const inner = (
    <>
        {(applyFeedback?.text || message) && (
          <div
            className={`${styles.message} ${
              statusTone === 'success'
                ? styles.messageSuccess
                : statusTone === 'warning'
                  ? styles.messageWarning
                  : statusTone === 'error'
                    ? styles.messageError
                    : ''
            }`}
            role="status"
          >
            {applyFeedback?.text || message}
          </div>
        )}

        <section className={styles.card}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="format">导入格式</label>
              <select
                id="format"
                value={format}
                onChange={(e) => {
                  const nextFormat = e.target.value;
                  setFormat(nextFormat);
                  setPreview(null);
                  setApplyResult(null);
                  setApplyFeedback(null);
                  setMessage('');
                  setSelectedFileName('');
                  if (nextFormat === 'cbrc') {
                    setContent('');
                    setMessage('已切换到中国鸟类记录中心模式，请先上传 XLS/XLSX 文件');
                  } else {
                    setCbrcRows(null);
                  }
                }}
                className={styles.select}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="cbrc">中国鸟类记录中心（XLS/XLSX）</option>
              </select>
            </div>
            {!isCbrcFormat && !cbrcMode ? (
              <div className={styles.field}>
                <label htmlFor="strategy">冲突策略</label>
                <select
                  id="strategy"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className={styles.select}
                >
                  <option value="skip">跳过重复</option>
                  <option value="merge">合并到已有记录</option>
                  <option value="overwrite">覆盖已有记录</option>
                </select>
              </div>
            ) : (
              <div className={styles.field}>
                <span className={styles.fieldLabelStatic}>冲突策略</span>
                <p className={styles.fileHint}>表格导入仅支持跳过重复。</p>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="importFile">导入文件（可选）</label>
            <input
              id="importFile"
              type="file"
              accept=".json,.csv,.xls,.xlsx,application/json,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onClick={(e) => {
                e.currentTarget.value = '';
              }}
              onChange={handleFileUpload}
              className={styles.fileInput}
              disabled={loadingFile}
            />
            {selectedFileName ? (
              <p className={styles.fileName}>已选：{selectedFileName}</p>
            ) : null}
            <p className={styles.fileHint}>
              {loadingFile
                ? '文件读取中…'
                : isCbrcFormat
                  ? '当前为中国鸟类记录中心模式：请上传 XLS/XLSX 文件后再预览导入'
                  : '支持 JSON / CSV / XLS / XLSX，读取后会自动识别导入模式'}
            </p>
          </div>

          {!(isCbrcFormat || cbrcMode) ? (
            <div className={styles.field}>
              <label htmlFor="importContent">导入内容</label>
              <textarea
                id="importContent"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                }}
                className={styles.textarea}
                placeholder={
                  format === 'json'
                    ? '[{"date":"2026-05-01","locationName":"午潮山","birds":"白鹭:2,麻雀:5","notes":"示例"}]'
                    : 'date,locationName,birds,notes\n2026-05-01,午潮山,白鹭:2;麻雀:5,示例'
                }
              />
            </div>
          ) : null}

          <div className={styles.actions}>
            <button type="button" onClick={runPreview} disabled={loadingPreview} className="btn btn-secondary">
              {loadingPreview ? '预览中…' : '生成预览'}
            </button>
            <button type="button" onClick={runApply} disabled={loadingApply || !preview} className="btn btn-primary">
              {loadingApply ? '导入中…' : '执行导入'}
            </button>
            {!(isCbrcFormat || cbrcMode) ? (
              <>
                <button type="button" onClick={fillSampleTemplate} className="btn btn-ghost">
                  填充示例模板
                </button>
                <button type="button" onClick={downloadTemplate} className="btn btn-ghost">
                  下载模板
                </button>
              </>
            ) : null}
          </div>
          <p className={styles.fileHint}>建议先生成预览检查数据，再执行导入。</p>
        </section>

        {preview && (
          <section className={styles.card}>
            <h3>预览结果</h3>
            <div className={styles.summary}>
              <span>总行数：{preview.summary.total}</span>
              <span>可导入：{preview.summary.ready}</span>
              <span>警告：{preview.summary.warning}</span>
              <span>无效：{preview.summary.invalid}</span>
              <span>潜在冲突：{preview.summary.potentialConflicts}</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>行</th>
                    <th>状态</th>
                    <th>详情</th>
                    <th>问题</th>
                    <th>潜在冲突</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 100).map((row) => (
                    <tr key={row.rowIndex}>
                      <td>{row.rowIndex}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            row.status === 'ready'
                              ? styles.statusReady
                              : row.status === 'warning'
                                ? styles.statusWarning
                                : styles.statusInvalid
                          }`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td>
                        {row.preview
                          ? `${row.preview.dateDisplay || '—'}｜${row.preview.locationName || '—'}｜鸟类 ${row.preview.birdsResolved ?? 0}/${row.preview.birdsRaw ?? 0}｜${row.preview.birdNames || '—'}`
                          : '—'}
                      </td>
                      <td>{(row.issues || []).join('；') || '—'}</td>
                      <td>{row.potentialConflict ? row.potentialConflict.title || row.potentialConflict.recordId : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmatchedBirdNames.length > 0 && (
              <div className={styles.unmatchedPanel}>
                <h4 className={styles.unmatchedTitle}>未匹配鸟类（可申请入库）</h4>
                <p className={styles.fileHint}>
                  以下名称在鸟种库中未找到。申请入库后，请重新预览/导入，或在记笔时搜索选用。
                </p>
                <ul className={styles.unmatchedList}>
                  {unmatchedBirdNames.map((name) => (
                    <li key={name} className={styles.unmatchedItem}>
                      <span>{name}</span>
                      <RequestNewBirdButton
                        name={name}
                        compact
                        className={styles.requestLink}
                        onCreated={() => {
                          setResolvedUnmatchedNames((prev) => {
                            const next = new Set(prev);
                            next.add(name);
                            return next;
                          });
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {applyResult && (
          <section className={styles.card}>
            <h3>导入执行结果</h3>
            <div className={styles.summary}>
              <span>创建：{applyResult.created}</span>
              <span>合并：{applyResult.merged}</span>
              <span>覆盖：{applyResult.overwritten}</span>
              <span>跳过：{applyResult.skipped}</span>
              <span>失败：{applyResult.failed}</span>
            </div>
            {Array.isArray(applyResult.errorSamples) && applyResult.errorSamples.length > 0 && (
              <div className={styles.field}>
                <label>失败样例（最多 5 条）</label>
                <ul>
                  {applyResult.errorSamples.map((item, idx) => (
                    <li key={`${idx}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
    </>
  );

  return (
    <div className={styles.panelRoot}>
      <div className={styles.panelInner}>{inner}</div>
    </div>
  );
}
