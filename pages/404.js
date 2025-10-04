import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import styles from '../styles/Error.module.css';

// 404页面专用的濒危鸟类
const notFoundBird = {
  name: '白鹤',
  scientificName: 'Grus leucogeranus',
  status: '极危(CR)',
  description: '白鹤是世界上最稀有的鹤类之一，全球数量不足4000只。它们就像这个页面一样，很难找到，但一旦发现就会让人印象深刻。',
  habitat: '湿地、苔原、河流',
  distribution: '西伯利亚、中国长江流域',
  threats: '栖息地丧失、气候变化、人类干扰',
  conservation: '国家一级保护动物，迁徙路线保护',
  icon: '🦩',
  color: '#9b59b6'
};

export default function Custom404() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <Head>
        <title>页面飞走了 - KBird</title>
        <meta name="description" content="页面未找到，但发现了一只濒危的白鹤" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.errorContent}>
          <div className={styles.birdSection}>
            <div className={styles.birdIcon} style={{ color: notFoundBird.color }}>
              {notFoundBird.icon}
            </div>
            <h1 className={styles.birdName}>{notFoundBird.name}</h1>
            <p className={styles.scientificName}>{notFoundBird.scientificName}</p>
            <div className={styles.statusBadge} style={{ backgroundColor: notFoundBird.color }}>
              {notFoundBird.status}
            </div>
          </div>

          <div className={styles.errorSection}>
            <h2 className={styles.errorTitle}>页面飞走了</h2>
            <p className={styles.errorSubtitle}>
              就像这只濒危的白鹤一样，这个页面可能已经迁移到其他地方了。
              不过别担心，我们还有很多其他有趣的鸟类等着你去发现！
            </p>
            
            <div className={styles.errorCode}>
              错误代码: 404
            </div>

            <div className={styles.actions}>
              <Link href="/" className={styles.primaryButton}>
                🏠 返回首页
              </Link>
              <Link href="/birds" className={styles.primaryButton}>
                🐦 浏览鸟类图鉴
              </Link>
              <button 
                onClick={() => router.back()} 
                className={styles.secondaryButton}
              >
                ← 返回上页
              </button>
            </div>
          </div>
        </div>

        <div className={styles.birdInfo}>
          <h3 className={styles.infoTitle}>🦩 认识这只濒危的白鹤</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h4>📝 描述</h4>
              <p>{notFoundBird.description}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🏞️ 栖息地</h4>
              <p>{notFoundBird.habitat}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🌍 分布</h4>
              <p>{notFoundBird.distribution}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>⚠️ 威胁</h4>
              <p>{notFoundBird.threats}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🛡️ 保护措施</h4>
              <p>{notFoundBird.conservation}</p>
            </div>
          </div>
        </div>

        <div className={styles.conservationMessage}>
          <h3>🌱 保护濒危鸟类，人人有责</h3>
          <p>
            虽然这个页面没有找到，但我们找到了这只珍贵的白鹤。
            就像保护这些濒危鸟类一样，我们需要关注每一个细节，
            保护我们共同的家园。
          </p>
          <Link href="/birds" className={styles.learnMoreButton}>
            了解更多鸟类知识 →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}














