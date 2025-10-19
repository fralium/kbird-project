import React from 'react';
import { getCategoryLabels } from '../utils/formatCategory';
import styles from '../styles/CategoryDisplay.module.css';

export default function CategoryDisplay({ category, variant = 'default', bird = null }) {
  if (!category) return null;

  const labels = getCategoryLabels(category);

  if (variant === 'compact') {
    // 紧凑模式：两行布局，第一行显示目，第二行显示科
    // 支持中文/拉丁文对照显示
    const orderLabel = labels.find(label => label.level === '目');
    const familyLabel = labels.find(label => label.level === '科');
    
    // 获取拉丁文分类信息
    const getLatinName = (chineseName, type) => {
      if (!bird) return null;
      
      if (type === 'order') {
        return bird.order && bird.order !== chineseName ? bird.order : null;
      } else if (type === 'family') {
        return bird.family && bird.family !== chineseName ? bird.family : null;
      }
      return null;
    };
    
    return (
      <div className={styles.compactContainer}>
        <div className={styles.compactRow}>
          {orderLabel && (
            <span
              className={styles.compactLabel}
              style={{ backgroundColor: orderLabel.color }}
            >
              {orderLabel.name}
              {getLatinName(orderLabel.name, 'order') && (
                <span className={styles.latinName}>/{getLatinName(orderLabel.name, 'order')}</span>
              )}
            </span>
          )}
        </div>
        <div className={styles.compactRow}>
          {familyLabel && (
            <span
              className={styles.compactLabel}
              style={{ backgroundColor: familyLabel.color }}
            >
              {familyLabel.name}
              {getLatinName(familyLabel.name, 'family') && (
                <span className={styles.latinName}>/{getLatinName(familyLabel.name, 'family')}</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    // 内联模式：用分隔符连接
    return (
      <span className={styles.inlineCategory}>
        {labels.map((label, index) => (
          <React.Fragment key={index}>
            <span
              className={styles.inlineLabel}
              style={{ color: label.color }}
            >
              {label.name}
            </span>
            {index < labels.length - 1 && (
              <span className={styles.separator}> &gt; </span>
            )}
          </React.Fragment>
        ))}
      </span>
    );
  }

  // 默认模式：垂直堆叠的标签
  return (
    <div className={styles.defaultContainer}>
      {labels.map((label, index) => (
        <span
          key={index}
          className={styles.defaultLabel}
          style={{ 
            backgroundColor: label.color,
            '--label-color': label.color
          }}
        >
          <span className={styles.level}>{label.level}</span>
          <span className={styles.name}>{label.name}</span>
        </span>
      ))}
    </div>
  );
}
