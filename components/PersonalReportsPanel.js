'use client';

import { useMemo, useState } from 'react';
import { api } from '../utils/api';
import SpeciesHoverChip from './SpeciesHoverChip';
import styles from '../styles/PersonalReports.module.css';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function PersonalReportsPanel() {
  const [mode, setMode] = useState('annual');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState(null);

  const title = useMemo(() => {
    if (!report) return '';
    if (report.month) return `${report.year} 年 ${report.month} 月观鸟报告`;
    return `${report.year} 年度观鸟报告`;
  }, [report]);

  const loadReport = async () => {
    setLoading(true);
    setMessage('');
    setReport(null);
    try {
      const data =
        mode === 'monthly'
          ? await api.personal.getMonthlyReport(year, month)
          : await api.personal.getAnnualReport(year);
      if (!data.success) {
        setMessage(data.message || '生成报告失败');
        return;
      }
      setReport(data.data || null);
    } catch (error) {
      setMessage(error.message || '生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const summary = report?.summary || {};

  return (
    <div>
      <div className={styles.reportConfig}>
        <div className={styles.configSection}>
          <label className={styles.label} htmlFor="reportMode">
            报告类型
          </label>
          <select
            id="reportMode"
            className={styles.select}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setReport(null);
              setMessage('');
            }}
          >
            <option value="annual">年度报告</option>
            <option value="monthly">月度报告</option>
          </select>
        </div>

        <div className={styles.configSection}>
          <label className={styles.label} htmlFor="reportYear">
            年份
          </label>
          <select
            id="reportYear"
            className={styles.select}
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setReport(null);
              setMessage('');
            }}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {mode === 'monthly' && (
          <div className={styles.configSection}>
            <label className={styles.label} htmlFor="reportMonth">
              月份
            </label>
            <select
              id="reportMonth"
              className={styles.select}
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setReport(null);
                setMessage('');
              }}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={loadReport} disabled={loading}>
            {loading ? '生成中…' : '生成报告'}
          </button>
        </div>
      </div>

      {message ? (
        <p className={styles.alert} role="alert">
          {message}
        </p>
      ) : null}

      {!report && !loading && !message ? (
        <p className={styles.fileHint}>选择类型与年月后，点击「生成报告」查看摘要。</p>
      ) : null}

      {report && (
        <div className={styles.reportContent}>
          <div className={styles.reportHeader}>
            <h2>{title}</h2>
            <span className={styles.speciesDate}>
              生成于 {report.generatedAt ? new Date(report.generatedAt).toLocaleString('zh-CN') : '—'}
            </span>
          </div>

          <section className={styles.summarySection}>
            <h3>概览</h3>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryNumber}>{summary.totalRecords ?? 0}</div>
                <div className={styles.summaryLabel}>观察记录</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryNumber}>{summary.totalSpecies ?? 0}</div>
                <div className={styles.summaryLabel}>物种数</div>
              </div>
              {summary.totalBirds != null && (
                <div className={styles.summaryCard}>
                  <div className={styles.summaryNumber}>{summary.totalBirds}</div>
                  <div className={styles.summaryLabel}>鸟只合计</div>
                </div>
              )}
              {summary.newSpecies != null && (
                <div className={styles.summaryCard}>
                  <div className={styles.summaryNumber}>{summary.newSpecies}</div>
                  <div className={styles.summaryLabel}>新发现物种</div>
                </div>
              )}
              {summary.totalPhotos != null && (
                <div className={styles.summaryCard}>
                  <div className={styles.summaryNumber}>{summary.totalPhotos}</div>
                  <div className={styles.summaryLabel}>照片数</div>
                </div>
              )}
            </div>
          </section>

          {Array.isArray(report.topBirds) && report.topBirds.length > 0 && (
            <section className={styles.section}>
              <h3>最常观察</h3>
              <div className={styles.topList}>
                {report.topBirds.slice(0, 10).map((bird, idx) => (
                  <div key={`${bird.name}-${idx}`} className={styles.topItem}>
                    <span className={styles.topRank}>{idx + 1}</span>
                    <SpeciesHoverChip name={bird.name} className={styles.topName}>
                      {bird.name}
                      {bird.count != null ? ` · ${bird.count}` : ''}
                    </SpeciesHoverChip>
                  </div>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(report.topLocations) && report.topLocations.length > 0 && (
            <section className={styles.section}>
              <h3>常去地点</h3>
              <div className={styles.topList}>
                {report.topLocations.slice(0, 10).map((loc, idx) => (
                  <div key={`${loc.name}-${idx}`} className={styles.topItem}>
                    <span className={styles.topRank}>{idx + 1}</span>
                    <span className={styles.topName}>
                      {loc.name}
                      {loc.count != null ? ` · ${loc.count} 次` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(report.newSpecies) && report.newSpecies.length > 0 && (
            <section className={styles.section}>
              <h3>新发现物种</h3>
              <div className={styles.speciesList}>
                {report.newSpecies.slice(0, 12).map((bird, idx) => (
                  <div key={`${bird.name}-${idx}`} className={styles.speciesItem}>
                    <SpeciesHoverChip
                      name={bird.name || ''}
                      className={styles.speciesName}
                    >
                      {bird.name || '—'}
                    </SpeciesHoverChip>
                    {bird.scientificName ? (
                      <div className={styles.speciesScientific}>{bird.scientificName}</div>
                    ) : null}
                    {bird.firstSeenDate ? (
                      <div className={styles.speciesDate}>
                        首次：{new Date(bird.firstSeenDate).toLocaleDateString('zh-CN')}
                        {bird.firstSeenLocation ? ` · ${bird.firstSeenLocation}` : ''}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(report.records) && report.records.length > 0 && (
            <section className={styles.section}>
              <h3>近期记录</h3>
              <div className={styles.topList}>
                {report.records.slice(0, 15).map((rec) => (
                  <div key={rec.id} className={styles.topItem}>
                    <span className={styles.topName}>
                      {rec.date ? new Date(rec.date).toLocaleDateString('zh-CN') : '—'}
                      {' · '}
                      {rec.location || rec.title || '未命名地点'}
                      {Array.isArray(rec.birds) && rec.birds.length > 0
                        ? ` · ${rec.birds
                            .slice(0, 4)
                            .map((b) => b.name)
                            .filter(Boolean)
                            .join('、')}`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
