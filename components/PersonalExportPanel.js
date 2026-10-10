'use client';

import { useState } from 'react';
import { downloadPersonalRecordsExport } from '../utils/personalExportDownload';
import styles from '../styles/ImportData.module.css';

export default function PersonalExportPanel() {
  const [exportYear, setExportYear] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [message, setMessage] = useState('');

  const runExport = async (format) => {
    setExportBusy(true);
    setMessage('');
    try {
      const result = await downloadPersonalRecordsExport(format, {
        year: exportYear || undefined,
      });
      const label = format === 'cbrc' ? '中国鸟类记录中心 XLSX' : 'eBird CSV';
      setMessage(
        `已导出 ${label}${result.count != null ? `（${result.count} 条记录）` : ''}${
          exportYear ? ` · ${exportYear} 年` : ' · 全部已发布记录'
        }`
      );
    } catch (error) {
      setMessage(error.message || '导出失败');
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <>
      {message ? (
        <div
          className={`${styles.message} ${
            /失败|错误/.test(message) ? styles.messageError : styles.messageSuccess
          }`}
          role="status"
        >
          {message}
        </div>
      ) : null}

      <section className={styles.card}>
        <p className={styles.fileHint}>
          CBRC 为报告表 XLSX；eBird 为 Record Format CSV。不选年份则导出全部已发布记录。
        </p>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="exportYear">年份（可选）</label>
            <select
              id="exportYear"
              value={exportYear}
              onChange={(e) => setExportYear(e.target.value)}
              className={styles.select}
            >
              <option value="">全部年份</option>
              {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => runExport('cbrc')}
            disabled={exportBusy}
          >
            {exportBusy ? '导出中…' : '导出 CBRC XLSX'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => runExport('ebird')}
            disabled={exportBusy}
          >
            导出 eBird CSV
          </button>
        </div>
      </section>
    </>
  );
}
