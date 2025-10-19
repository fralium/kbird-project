import React from 'react';
import Link from 'next/link';
import styles from '../styles/Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.title}>KBird</h3>
            <p className={styles.description}>
              专业的鸟类观察记录平台，帮助您记录、分享和探索鸟类的奇妙世界。
            </p>
          </div>
          
          <div className={styles.section}>
            <h4 className={styles.subtitle}>快速导航</h4>
            <ul className={styles.links}>
              <li><Link href="/birds" className={styles.link}>鸟类图鉴</Link></li>
              <li><Link href="/birds/catalog" className={styles.link}>鸟类名录</Link></li>
              <li><Link href="/records" className={styles.link}>观鸟记录</Link></li>
              <li><Link href="/birds/add" className={styles.link}>添加鸟类</Link></li>
              <li><Link href="/dashboard" className={styles.link}>个人中心</Link></li>
            </ul>
          </div>
          
          <div className={styles.section}>
            <h4 className={styles.subtitle}>功能特色</h4>
            <ul className={styles.links}>
              <li><span className={styles.feature}>智能识别</span></li>
              <li><span className={styles.feature}>分类管理</span></li>
              <li><span className={styles.feature}>观察记录</span></li>
              <li><span className={styles.feature}>社区分享</span></li>
            </ul>
          </div>
          
          <div className={styles.section}>
            <h4 className={styles.subtitle}>联系我们</h4>
            <div className={styles.contact}>
              <p className={styles.contactItem}>
                <span className={styles.icon}>📧</span>
                contact@kbird.com
              </p>
              <p className={styles.contactItem}>
                <span className={styles.icon}>🌐</span>
                www.kbird.com
              </p>
            </div>
          </div>
        </div>
        
        <div className={styles.bottom}>
          <div className={styles.copyright}>
            <p>© {new Date().getFullYear()} KBird - 鸟类收集整理网站</p>
            <p className={styles.motto}>探索自然，记录美好</p>
          </div>
          <div className={styles.social}>
            <span className={styles.socialText}>关注我们：</span>
            <div className={styles.socialLinks}>
              <span className={styles.socialIcon}>🐦</span>
              <span className={styles.socialIcon}>📱</span>
              <span className={styles.socialIcon}>💬</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}






