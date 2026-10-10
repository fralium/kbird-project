'use client';

import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SimplePageHeader from '../../components/SimplePageHeader';
import styles from '../../styles/DesignIndex.module.css';

const LABS = [
  {
    href: '/design/bird-detail',
    title: '鸟种详情 · 图鉴+分页',
    note: '已接到 /birds/[id]。旧版加 ?layout=classic。这页可对照。',
    live: false,
  },
  {
    href: '/design/scrap-cards',
    title: '手账密度草案',
    note: '观察卡片三档密度。未接到真实记录页。',
    live: false,
  },
  {
    href: '/design/template',
    title: '已见鸟种页头草案',
    note: '早期页头试验。真实 /birds 已用 SimplePageHeader，可删。',
    live: false,
  },
];

export default function DesignIndexPage() {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          eyebrow="试验台 · 不进导航"
          title="设计草稿"
          description="只给改版用。定稿接到真页后，整个 /design 目录都可以清掉。"
          descriptionVariant="caption"
        />
        <ul className={styles.list}>
          {LABS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.card}>
                <span className={styles.cardTitle}>{item.title}</span>
                <span className={styles.cardNote}>{item.note}</span>
                <span className={item.live ? styles.live : styles.stale}>
                  {item.live ? '进行中' : '可清'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}
