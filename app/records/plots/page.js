'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader, {
  HeaderPrimaryButton,
} from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import { HABITAT_COVER_SETS, resolvePlotCover, useHabitatCoverSet } from '@/utils/habitatCover';
import styles from '@/styles/PersonalPlots.module.css';

const emptyForm = {
  title: '',
  province: '',
  city: '',
  district: '',
  spot: '',
  notes: '',
};

function scopeLabel(plot) {
  return [plot.province, plot.city, plot.district, plot.spot].filter(Boolean).join(' · ') || '未填范围';
}

export default function PersonalPlotsPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [coverSet, updateCoverSet] = useHabitatCoverSet();
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);

  const showMsg = (text, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const load = useCallback(async () => {
    setLoading(true);
    showMsg('');
    try {
      const data = await api.personal.getPlots();
      if (!data.success) {
        showMsg(data.message || '加载失败', true);
        setPlots([]);
        return;
      }
      setPlots(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      showMsg(error.message || '加载失败', true);
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || !token)) {
      router.push('/login?redirect=/records/plots');
      return;
    }
    if (user && token) load();
  }, [authLoading, user, token, router, load]);

  useEffect(() => {
    if (!showCreate) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById('plot-create-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [showCreate]);

  const openCreate = () => {
    setShowCreate(true);
    showMsg('');
  };

  const closeCreate = () => {
    setShowCreate(false);
    setForm(emptyForm);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      showMsg('请填写名称', true);
      return;
    }
    setSaving(true);
    showMsg('');
    try {
      const data = await api.personal.createPlot(form);
      if (!data.success) {
        showMsg(data.message || '创建失败', true);
        return;
      }
      setForm(emptyForm);
      setShowCreate(false);
      const id = data.data?._id;
      if (id) {
        router.push(`/records/plots/${id}`);
        return;
      }
      await load();
    } catch (error) {
      showMsg(error.message || '创建失败', true);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载中" />
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
          title="自留地"
          description="按地点或城市自己归档鸟种，不跟观察记录自动对上"
          descriptionVariant="caption"
          actions={
            <HeaderPrimaryButton
              onClick={() => (showCreate ? closeCreate() : openCreate())}
            >
              {showCreate ? '收起新建' : '新建自留地'}
            </HeaderPrimaryButton>
          }
        />

        {message ? (
          <div className={`${styles.message} ${messageError ? styles.messageError : ''}`}>
            {message}
          </div>
        ) : null}

        {showCreate ? (
          <section className={styles.editorPanel} id="plot-create-panel">
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>新建自留地</h2>
              <button type="button" className={styles.linkBtn} onClick={closeCreate}>
                关闭
              </button>
            </div>
            <p className={styles.hint}>
              名称必填。省市区和观鸟点方便以后筛，可以先空着。
            </p>
            <form onSubmit={handleCreate}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="plot-title">名称 *</label>
                  <input
                    id="plot-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="如：南湖 / 杭州市"
                    required
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="plot-spot">观鸟点</label>
                  <input
                    id="plot-spot"
                    value={form.spot}
                    onChange={(e) => setForm((f) => ({ ...f, spot: e.target.value }))}
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className={styles.formGrid3} style={{ marginTop: 12 }}>
                <div className={styles.field}>
                  <label htmlFor="plot-province">省</label>
                  <input
                    id="plot-province"
                    value={form.province}
                    onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                    placeholder="可选"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="plot-city">市</label>
                  <input
                    id="plot-city"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="可选"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="plot-district">区县</label>
                  <input
                    id="plot-district"
                    value={form.district}
                    onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className={styles.formGrid} style={{ marginTop: 12 }}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="plot-notes">介绍</label>
                  <textarea
                    id="plot-notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="可选：范围、生境、观鸟要点等"
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '创建中…' : '创建'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeCreate}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className={styles.panel}>
          {loading ? (
            <div className={styles.empty}>加载中…</div>
          ) : plots.length === 0 ? (
            <div className={styles.emptyBlock}>
              <p className={styles.empty}>还没有自留地。建一块后可手动录入或导入鸟类记录中心报告表。</p>
              {!showCreate ? (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  新建自留地
                </button>
              ) : null}
            </div>
          ) : (
            <>
            <div className={styles.listMeta}>
              <div className={styles.listMetaLead}>
                <span className={styles.listMetaCount}>{plots.length} 块</span>
              </div>
              <div className={styles.listMetaTools}>
                <div className="kb-view-seg kb-meta-seg" role="group" aria-label="封面风格">
                  <span className="kb-meta-label">封面</span>
                  {HABITAT_COVER_SETS.map((set) => (
                    <button
                      key={set.id}
                      type="button"
                      className={`kb-view-tab kb-meta-tab${coverSet === set.id ? ' is-active' : ''}`}
                      aria-pressed={coverSet === set.id}
                      onClick={() => updateCoverSet(set.id)}
                    >
                      {set.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.plotGrid}>
              {(() => {
                const usedUrls = new Set();
                return plots.map((plot) => {
                  const cover = resolvePlotCover(plot, usedUrls, coverSet);
                  return (
                    <Link
                      key={plot._id}
                      href={`/records/plots/${plot._id}`}
                      className={styles.plotCard}
                    >
                      <div className={styles.plotMedia}>
                        <Image
                          src={cover.url}
                          alt=""
                          fill
                          sizes="(max-width: 900px) 100vw, 33vw"
                          unoptimized
                          className={styles.plotCoverImage}
                        />
                        <div className={styles.plotShade} aria-hidden="true" />
                        {cover.source === 'bird' && cover.birdName ? (
                          <span className={styles.plotBadge}>
                            {cover.level ? `${cover.level} · ` : ''}
                            {cover.birdName}
                          </span>
                        ) : null}
                        <div className={styles.plotOverlay}>
                          <h3 className={styles.plotCardTitle}>{plot.title}</h3>
                          <div className={styles.plotCardMeta}>{scopeLabel(plot)}</div>
                          <div className={styles.plotCardStats}>
                            鸟种 {plot.statsCache?.speciesCount ?? 0} 种
                            {plot.statsCache?.reportCount
                              ? ` · 报告 ${plot.statsCache.reportCount} 次`
                              : ''}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                });
              })()}
            </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
