'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader, { HeaderPrimaryButton } from '../../../components/SimplePageHeader';
import PageState from '../../../components/PageState';
import { useAuth } from '../../../components/AuthProvider';
import { api } from '../../../utils/api';
import { devError } from '../../../utils/devLogger';
import styles from '../../../styles/AdminObservability.module.css';

const WINDOW_OPTIONS = [15, 30, 60, 120, 240];

function MetricCard({ title, value, hint }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricTitle}>{title}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricHint}>{hint}</div>
    </div>
  );
}

function TinyBar({ value }) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const pct = Math.max(0, Math.min(100, safe));
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminObservabilityPage() {
  const { user, loading: authLoading } = useAuth();
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);

  const isAdmin = user?.role === 'admin';

  const loadMetrics = async (selectedWindowMinutes = windowMinutes) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.admin.getErrorMetrics({ windowMinutes: selectedWindowMinutes });
      if (!data?.success) {
        throw new Error(data?.message || '获取错误率指标失败');
      }
      setMetrics(data.data);
    } catch (requestError) {
      devError('获取错误率指标失败:', requestError);
      setError(requestError?.message || '获取错误率指标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadMetrics(windowMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const top5xxGroups = useMemo(
    () => (metrics?.groups || []).filter((item) => item.errors5xx > 0).slice(0, 5),
    [metrics]
  );

  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="错误率指标加载中..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="error" title="无访问权限" message="该页面仅管理员可访问" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!metrics || error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState
            type="error"
            title="获取指标失败"
            message={error || '请稍后重试'}
            actionLabel="重新加载"
            onAction={() => loadMetrics(windowMinutes)}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="接口错误率"
          description={`近 ${metrics.windowMinutes} 分钟`}
          descriptionVariant="caption"
          actions={
            <HeaderPrimaryButton onClick={() => loadMetrics(windowMinutes)} disabled={loading}>
              {loading ? '刷新中…' : '刷新'}
            </HeaderPrimaryButton>
          }
        />

<div className={styles.toolbar}>
          <label htmlFor="windowMinutes">统计窗口：</label>
          <select
            id="windowMinutes"
            value={windowMinutes}
            onChange={(event) => {
              const value = Number(event.target.value);
              setWindowMinutes(value);
              loadMetrics(value);
            }}
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option} value={option}>
                最近 {option} 分钟
              </option>
            ))}
          </select>
        </div>

        <div className={styles.grid}>
          <MetricCard
            title="窗口期请求总数"
            value={metrics.overall.total}
            hint={`生成时间：${new Date(metrics.generatedAt).toLocaleString()}`}
          />
          <MetricCard title="4xx 错误数" value={metrics.overall.errors4xx} hint="客户端错误" />
          <MetricCard title="5xx 错误数" value={metrics.overall.errors5xx} hint="服务端错误" />
          <MetricCard
            title="综合错误率"
            value={`${metrics.overall.errorRate}%`}
            hint="(4xx + 5xx) / total"
          />
        </div>

        <section className={styles.section}>
          <h3>5xx 风险接口 Top 5</h3>
          {top5xxGroups.length === 0 ? (
            <p className={styles.muted}>当前窗口内没有 5xx。</p>
          ) : (
            <div className={styles.groupList}>
              {top5xxGroups.map((group) => (
                <div key={group.group} className={styles.groupItem}>
                  <div className={styles.groupName}>{group.group}</div>
                  <div className={styles.groupMeta}>
                    <span>总请求 {group.total}</span>
                    <span>5xx {group.errors5xx}</span>
                    <span>错误率 {group.errorRate}%</span>
                  </div>
                  <TinyBar value={group.errorRate} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h3>关键接口错误率明细</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>接口分组</th>
                  <th>请求总数</th>
                  <th>4xx</th>
                  <th>5xx</th>
                  <th>错误率</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.groups || []).map((group) => (
                  <tr key={group.group}>
                    <td>{group.group}</td>
                    <td>{group.total}</td>
                    <td>{group.errors4xx}</td>
                    <td>{group.errors5xx}</td>
                    <td>{group.errorRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
