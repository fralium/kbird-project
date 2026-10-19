import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/styles/Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.accent} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={`${styles.section} ${styles.brandSection}`}>
            <Link href="/" className={styles.brandLink}>
              <span className={styles.brandMark} aria-hidden="true">
                <Image
                  src="/logo-wetland.png"
                  alt=""
                  width={36}
                  height={36}
                  className={styles.brandLogo}
                />
              </span>
              <h3 className={styles.title}>KBird</h3>
            </Link>
            <p className={styles.description}>把野外的遇见，收进自己的记录。</p>
          </div>

          <div className={styles.section}>
            <h4 className={styles.subtitle}>记录</h4>
            <ul className={styles.links}>
              <li>
                <Link href="/records" className={styles.link}>
                  观察记录
                </Link>
              </li>
              <li>
                <Link href="/birds" className={styles.link}>
                  已见鸟种
                </Link>
              </li>
              <li>
                <Link href="/records/plots" className={styles.link}>
                  自留地
                </Link>
              </li>
              <li>
                <Link href="/personal/goals" className={styles.link}>
                  加新之旅
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.subtitle}>数据库</h4>
            <ul className={styles.links}>
              <li>
                <Link href="/locations" className={styles.link}>
                  地点词典
                </Link>
              </li>
              <li>
                <Link href="/birds/catalog" className={styles.link}>
                  鸟种名录
                </Link>
              </li>
              <li>
                <Link href="/birds/regions" className={styles.link}>
                  各地鸟种
                </Link>
              </li>
              <li>
                <Link href="/personal/photos" className={styles.link}>
                  照片库
                </Link>
              </li>
              <li>
                <Link href="/knowledge" className={styles.link}>
                  鸟类知识
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.subtitle}>工具</h4>
            <ul className={styles.links}>
              <li>
                <Link href="/ai" className={styles.link}>
                  观鸟助手
                </Link>
              </li>
              <li>
                <Link href="/search" className={styles.link}>
                  搜索
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.subtitle}>记一笔</h4>
            <ul className={styles.links}>
              <li>
                <Link href="/records/quick" className={styles.link}>
                  快速记录
                </Link>
              </li>
              <li>
                <Link href="/records/add" className={styles.link}>
                  详细记录
                </Link>
              </li>
              <li>
                <Link href="/records/draft" className={styles.link}>
                  文字草稿
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.subtitle}>我的</h4>
            <ul className={styles.links}>
              <li>
                <Link href="/personal/stats" className={styles.link}>
                  个人统计
                </Link>
              </li>
              <li>
                <Link href="/personal/projects" className={styles.link}>
                  探索 Demo
                </Link>
              </li>
              <li>
                <Link href="/personal/notepad" className={styles.link}>
                  我的便签
                </Link>
              </li>
              <li>
                <Link href="/personal/manage" className={styles.link}>
                  数据管理
                </Link>
              </li>
              <li>
                <Link href="/personal/settings" className={styles.link}>
                  个人设置
                </Link>
              </li>
              <li>
                <Link href="/personal/guide" className={styles.link}>
                  功能指南
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} KBird · 观鸟笔记本
          </p>
        </div>
      </div>
    </footer>
  );
}
