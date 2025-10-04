import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import styles from '../styles/Error.module.css';

// 濒危鸟类数据
const endangeredBirds = [
  {
    name: '朱鹮',
    scientificName: 'Nipponia nippon',
    status: '极危(CR)',
    description: '朱鹮是世界上最濒危的鸟类之一，曾被认为已经灭绝，直到1981年在陕西洋县重新发现。',
    habitat: '湿地、稻田、河流',
    distribution: '中国陕西、河南等地',
    threats: '栖息地破坏、环境污染、人类活动',
    conservation: '国家一级保护动物，建立自然保护区',
    icon: '🦩',
    color: '#e74c3c'
  },
  {
    name: '丹顶鹤',
    scientificName: 'Grus japonensis',
    status: '濒危(EN)',
    description: '丹顶鹤是优雅的大型涉禽，以其美丽的红色头顶和优雅的舞姿而闻名。',
    habitat: '湿地、沼泽、湖泊',
    distribution: '中国东北、日本、韩国',
    threats: '湿地开发、环境污染、气候变化',
    conservation: '国家一级保护动物，国际重要湿地保护',
    icon: '🦩',
    color: '#f39c12'
  },
  {
    name: '白鹤',
    scientificName: 'Grus leucogeranus',
    status: '极危(CR)',
    description: '白鹤是世界上最稀有的鹤类之一，全球数量不足4000只。',
    habitat: '湿地、苔原、河流',
    distribution: '西伯利亚、中国长江流域',
    threats: '栖息地丧失、气候变化、人类干扰',
    conservation: '国家一级保护动物，迁徙路线保护',
    icon: '🦩',
    color: '#9b59b6'
  },
  {
    name: '黑脸琵鹭',
    scientificName: 'Platalea minor',
    status: '濒危(EN)',
    description: '黑脸琵鹭以其独特的黑色面部和勺状喙而著称，是重要的湿地指示物种。',
    habitat: '沿海湿地、红树林、浅水区',
    distribution: '东亚沿海地区',
    threats: '湿地开发、污染、气候变化',
    conservation: '国家二级保护动物，湿地保护',
    icon: '🦩',
    color: '#3498db'
  },
  {
    name: '中华秋沙鸭',
    scientificName: 'Mergus squamatus',
    status: '濒危(EN)',
    description: '中华秋沙鸭是中国的特有物种，以其美丽的羽毛和独特的栖息地要求而闻名。',
    habitat: '清澈的山地河流、森林溪流',
    distribution: '中国东北、西南山区',
    threats: '河流污染、森林砍伐、水坝建设',
    conservation: '国家一级保护动物，河流生态保护',
    icon: '🦆',
    color: '#2ecc71'
  }
];

export default function Error({ statusCode }) {
  const router = useRouter();
  
  // 根据状态码选择不同的濒危鸟类
  const birdIndex = statusCode ? statusCode % endangeredBirds.length : 0;
  const bird = endangeredBirds[birdIndex];
  
  const getErrorMessage = () => {
    switch (statusCode) {
      case 404:
        return {
          title: '页面飞走了',
          subtitle: '就像这只濒危的鸟类一样，这个页面可能已经迁移或不存在了',
          action: '返回首页继续探索'
        };
      case 500:
        return {
          title: '服务器累了',
          subtitle: '服务器需要休息，就像这些濒危鸟类需要保护一样',
          action: '稍后再试'
        };
      default:
        return {
          title: '出现了意外',
          subtitle: '就像这些濒危鸟类的生存环境一样，有时会遇到意想不到的情况',
          action: '返回安全的地方'
        };
    }
  };

  const errorInfo = getErrorMessage();

  return (
    <div className={styles.container}>
      <Head>
        <title>{errorInfo.title} - KBird</title>
        <meta name="description" content="了解濒危鸟类，保护自然生态" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.errorContent}>
          <div className={styles.birdSection}>
            <div className={styles.birdIcon} style={{ color: bird.color }}>
              {bird.icon}
            </div>
            <h1 className={styles.birdName}>{bird.name}</h1>
            <p className={styles.scientificName}>{bird.scientificName}</p>
            <div className={styles.statusBadge} style={{ backgroundColor: bird.color }}>
              {bird.status}
            </div>
          </div>

          <div className={styles.errorSection}>
            <h2 className={styles.errorTitle}>{errorInfo.title}</h2>
            <p className={styles.errorSubtitle}>{errorInfo.subtitle}</p>
            
            <div className={styles.errorCode}>
              错误代码: {statusCode || '未知'}
            </div>

            <div className={styles.actions}>
              <Link href="/" className={styles.primaryButton}>
                🏠 {errorInfo.action}
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
          <h3 className={styles.infoTitle}>🐦 认识这只濒危鸟类</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h4>📝 描述</h4>
              <p>{bird.description}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🏞️ 栖息地</h4>
              <p>{bird.habitat}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🌍 分布</h4>
              <p>{bird.distribution}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>⚠️ 威胁</h4>
              <p>{bird.threats}</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🛡️ 保护措施</h4>
              <p>{bird.conservation}</p>
            </div>
          </div>
        </div>

        <div className={styles.conservationMessage}>
          <h3>🌱 保护濒危鸟类，人人有责</h3>
          <p>
            每一次错误都可能是一次学习的机会。就像保护这些濒危鸟类一样，
            我们需要关注每一个细节，保护我们共同的家园。
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

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};














