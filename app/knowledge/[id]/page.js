'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { sanitizeKnowledgeHtml } from '@/utils/sanitizeKnowledgeHtml';
import { knowledgeData } from '@/data/knowledgeData';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import styles from '@/styles/KnowledgeDetail.module.css';

export default function KnowledgeDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const knowledge = useMemo(
    () => knowledgeData.find((item) => item.id === id),
    [id]
  );

  if (!Number.isFinite(id)) {
    return (
      <div className={styles.container}>
        <PageState type="loading" title="加载中..." />
      </div>
    );
  }

  if (!knowledge) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>知识条目未找到</h2>
          <p>请检查链接是否正确</p>
          <Link href="/knowledge" className={styles.backButton}>
            返回知识列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />

      <main>
      <div className={styles.backSection}>
        <Link href="/knowledge" className={styles.backButton}>
          ← 返回知识列表
        </Link>
      </div>

      <article className={styles.article}>
        <SimplePageHeader
          title={knowledge.title}
          description={`${knowledge.category} · ${knowledge.readTime}`}
          descriptionVariant="caption"
        />

        <div className={styles.articleImage}>
          <Image
            src={knowledge.image}
            alt={knowledge.title}
            width={1200}
            height={700}
            unoptimized
            onError={(e) => {
              e.target.src = '/logo.png';
            }}
          />
        </div>

        <div className={styles.articleContent}>
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeKnowledgeHtml(knowledge.content),
            }}
          />
        </div>

        {knowledge.tips ? (
          <div className={styles.tipsSection}>
            <h3 className={styles.tipsTitle}>💡 实用技巧</h3>
            <ul className={styles.tipsList}>
              {knowledge.tips.map((tip, index) => (
                <li key={index} className={styles.tipItem}>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.relatedSection}>
          <h3 className={styles.relatedTitle}>相关推荐</h3>
          <div className={styles.relatedGrid}>
            {knowledgeData
              .filter((item) => item.id !== knowledge.id && item.category === knowledge.category)
              .slice(0, 3)
              .map((item) => (
                <Link key={item.id} href={`/knowledge/${item.id}`} className={styles.relatedCard}>
                  <div className={styles.relatedImage}>
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={520}
                      height={320}
                      unoptimized
                      onError={(e) => {
                        e.target.src = '/logo.png';
                      }}
                    />
                  </div>
                  <div className={styles.relatedContent}>
                    <h4 className={styles.relatedCardTitle}>{item.title}</h4>
                    <p className={styles.relatedCardMeta}>
                      {item.difficulty} • {item.readTime}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </article>
      </main>

      <Footer />
    </div>
  );
}
