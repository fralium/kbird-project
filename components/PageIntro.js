/**
 * 统一介绍页头部：高度、宽度、风格、文字一致，无图标
 * 用于：鸟类图鉴、观鸟记录、成就榜、AI识别、鸟类名录、地点名录、鸟类知识、快速记录、添加观鸟记录
 */
import styles from '@/styles/PageIntro.module.css';

export default function PageIntro({ title, description, variant = 'default', compact = false }) {
  const variantClassMap = {
    birdCatalog: styles.introBirdCatalog,
    records: styles.introRecords,
    locations: styles.introLocations,
    knowledge: styles.introKnowledge,
    ai: styles.introAI,
    achievement: styles.introAchievement,
  };
  const variantClass = variantClassMap[variant] || '';
  const introClassBase = variantClass ? `${styles.intro} ${variantClass}` : styles.intro;
  const introClass = compact ? `${introClassBase} ${styles.compact}` : introClassBase;
  const titleClass = compact ? `${styles.title} ${styles.titleCompact}` : styles.title;
  const descriptionClass = compact
    ? `${styles.description} ${styles.descriptionCompact}`
    : styles.description;

  return (
    <div className={introClass}>
      <h1 className={titleClass}>{title}</h1>
      {description && <p className={descriptionClass}>{description}</p>}
    </div>
  );
}
