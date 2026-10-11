'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageIntro from '@/components/PageIntro';
import styles from '@/styles/DesignTemplate.module.css';

const MOCK_BIRDS = [
  {
    name: '白鹭',
    sci: 'Egretta garzetta',
    records: 28,
    last: '最近 2026年9月14日',
    tone: '#dbeafe',
  },
  {
    name: '夜鹭',
    sci: 'Nycticorax nycticorax',
    records: 12,
    last: '最近 2026年9月8日',
    tone: '#e0e7ff',
  },
  {
    name: '普通翠鸟',
    sci: 'Alcedo atthis',
    records: 6,
    last: '最近 2026年8月30日',
    tone: '#ccfbf1',
  },
  {
    name: '红嘴相思鸟',
    sci: 'Leiothrix lutea',
    records: 4,
    last: '最近 2026年8月22日',
    tone: '#ffedd5',
  },
  {
    name: '黄腹山雀',
    sci: 'Pardaliparus venustulus',
    records: 9,
    last: '最近 2026年8月18日',
    tone: '#fef9c3',
  },
  {
    name: '普通鵟',
    sci: 'Buteo japonicus',
    records: 2,
    last: '最近 2026年7月3日',
    tone: '#fce7f3',
  },
];

export default function DesignTemplatePage() {
  const [mode, setMode] = useState('proposed'); // proposed | current

  return (
    <div className={styles.shell}>
      <Navbar />

      <main className={styles.mainWide}>
        <div className={styles.banner}>
          <div>
            <strong>模板预览 · 已见鸟种 `/birds`</strong>
            <span> 卡片保留；页头改轻品牌条。真实页面尚未改动。</span>
          </div>
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={mode === 'proposed' ? styles.chipActive : styles.chip}
              onClick={() => setMode('proposed')}
            >
              提议方案
            </button>
            <button
              type="button"
              className={mode === 'current' ? styles.chipActive : styles.chip}
              onClick={() => setMode('current')}
            >
              现状对照
            </button>
            <Link href="/birds" className={styles.bannerLink}>
              打开真实页面
            </Link>
          </div>
        </div>

        {mode === 'current' ? (
          <>
            <PageIntro
              variant="birdCatalog"
              compact
              title="已见鸟种"
              description="已记录 412 种 · 86 个观测点。按次数与最近观察浏览；完整名录见「鸟种名录」，勾选进度见「个人清单」。"
            />
            <div className={styles.summaryBarHeavy}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryValue}>412</span>
                <span className={styles.summaryLabel}>种</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryItem}>
                <span className={styles.summaryValue}>86</span>
                <span className={styles.summaryLabel}>个观测点</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryItem}>
                <span className={styles.summaryValue}>全部</span>
                <span className={styles.summaryLabel}>年份</span>
              </div>
              <Link href="/personal/checklist" className={styles.summaryLink}>
                我的清单
              </Link>
            </div>
          </>
        ) : (
          <header className={styles.birdsHeader}>
            <div className={styles.birdsHeaderAccent} aria-hidden="true" />
            <div className={styles.birdsHeaderBody}>
              <div className={styles.birdsHeaderTop}>
                <div>
                  <p className={styles.eyebrow}>我的观察</p>
                  <h1 className={styles.pageTitle}>已见鸟种</h1>
                  <p className={styles.pageLede}>
                    已见 <strong>412</strong> 种 · <strong>86</strong> 个观测点 · 全部年份
                  </p>
                </div>
                <div className={styles.pageHeaderActions}>
                  <Link href="/personal/checklist" className={styles.secondaryBtn}>
                    我的清单
                  </Link>
                  <Link href="/birds/catalog" className={styles.secondaryBtn}>
                    完整名录
                  </Link>
                  <Link href="/records/quick" className={styles.primaryBtn}>
                    记一笔
                  </Link>
                </div>
              </div>
            </div>
          </header>
        )}

        <section className={mode === 'proposed' ? styles.toolbarLight : styles.toolbarHeavy}>
          <input className={styles.search} placeholder="搜索已见鸟种名称、学名..." readOnly />
          <select className={styles.select} defaultValue="" aria-label="年份">
            <option value="">年份 · 全部</option>
            <option value="2026">2026</option>
          </select>
          <select className={styles.select} defaultValue="last" aria-label="排序">
            <option value="last">最近观察</option>
            <option value="count">观测次数</option>
          </select>
          {mode === 'proposed' ? (
            <div className={styles.metaInline}>
              <span>6 种示意</span>
              <div className={styles.viewToggle}>
                <span className={styles.viewActive}>简版</span>
                <span>详细版</span>
              </div>
            </div>
          ) : null}
        </section>

        <div className={mode === 'proposed' ? styles.birdGridModern : styles.birdGridCurrent}>
          {MOCK_BIRDS.map((bird) => (
            <article
              key={bird.name}
              className={mode === 'proposed' ? styles.birdCardModern : styles.birdCardCurrent}
            >
              <div className={styles.birdMedia} style={{ background: bird.tone }}>
                <span className={styles.birdMediaName}>{bird.name}</span>
              </div>
              <div className={styles.birdBody}>
                <h3 className={styles.birdName}>{bird.name}</h3>
                <p className={styles.birdSci}>{bird.sci}</p>
                <div className={styles.birdMeta}>
                  <span>{bird.records} 次</span>
                  <span>{bird.last}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className={styles.notes}>
          <h2 className={styles.notesTitle}>本页提议要点</h2>
          <ul>
            <li>
              <strong>页头</strong>：左侧湖色竖条 + 白底内容区，保留品牌感，高度约为现状横幅一半；摘要数字并入说明行，去掉单独 summary
              卡片条。
            </li>
            <li>
              <strong>卡片</strong>：继续图上文下；圆角保留，阴影改细边框/轻阴影，间距略收，更接近小红书式浏览感。
            </li>
            <li>
              <strong>工具条</strong>：搜索与筛选贴在内容区，不再套厚卡片壳。
            </li>
          </ul>
          <p className={styles.notesFoot}>
            满意后，再把这套落到真实 <code>/birds</code>。预览地址：
            <code>/design/template</code>
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
