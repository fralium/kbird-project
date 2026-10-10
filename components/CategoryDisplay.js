import React from 'react';
import { getCategoryLabels } from '../utils/formatCategory';
import { getOrderChineseName, getFamilyChineseName } from '../data/taxonomyTranslation';
import styles from '../styles/CategoryDisplay.module.css';

export default function CategoryDisplay({ category, variant = 'default', bird = null }) {
  if (!category && !bird?.order && !bird?.family) return null;

  const labels = getCategoryLabels(category);

  if (variant === 'compact') {
    // 紧凑模式：优先使用结构化字段 order/family，避免 category 字符串层级不准确
    const orderLatin = bird?.order || '';
    const familyLatin = bird?.family || '';
    const parsedOrderLabel = labels.find(label => label.level === '目');
    const parsedFamilyLabel = labels.find(label => label.level === '科');

    const orderDisplay = orderLatin
      ? getOrderChineseName(orderLatin)
      : parsedOrderLabel?.name || '';
    const familyDisplay = familyLatin
      ? getFamilyChineseName(familyLatin)
      : parsedFamilyLabel?.name || '';
    
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
          {orderDisplay && (
            <span
              className={styles.compactLabel}
              style={{ backgroundColor: '#e74c3c' }}
            >
              {orderDisplay}
              {getLatinName(orderDisplay, 'order') && (
                <span className={styles.latinName}>/{getLatinName(orderDisplay, 'order')}</span>
              )}
            </span>
          )}
        </div>
        <div className={styles.compactRow}>
          {familyDisplay && (
            <span
              className={styles.compactLabel}
              style={{ backgroundColor: '#3498db' }}
            >
              {familyDisplay}
              {getLatinName(familyDisplay, 'family') && (
                <span className={styles.latinName}>/{getLatinName(familyDisplay, 'family')}</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    const orderLatin = bird?.order || '';
    const familyLatin = bird?.family || '';
    const parsedOrder = labels.find((label) => label.level === '目');
    const parsedFamily = labels.find((label) => label.level === '科');
    const orderName = orderLatin ? getOrderChineseName(orderLatin) : parsedOrder?.name || '';
    const familyName = familyLatin ? getFamilyChineseName(familyLatin) : parsedFamily?.name || '';
    const parts = [
      orderName ? { label: '目', name: orderName, latin: orderLatin && orderLatin !== orderName ? orderLatin : '' } : null,
      familyName ? { label: '科', name: familyName, latin: familyLatin && familyLatin !== familyName ? familyLatin : '' } : null,
    ].filter(Boolean);

    if (parts.length === 0 && labels.length > 0) {
      return (
        <span className={styles.inlineCategory}>
          {labels.map((label, index) => (
            <span key={index}>
              <span className={styles.inlineLabel}>{label.name}</span>
              {index < labels.length - 1 && <span className={styles.separator}> · </span>}
            </span>
          ))}
        </span>
      );
    }

    return (
      <span className={styles.inlineCategory}>
        {parts.map((part, index) => (
          <span key={`${part.label}-${part.name}`}>
            <span className={styles.inlineMuted}>{part.label}</span>{' '}
            <span className={styles.inlineLabel}>
              {part.name}
              {part.latin ? <span className={styles.inlineLatin}> {part.latin}</span> : null}
            </span>
            {index < parts.length - 1 && <span className={styles.separator}> · </span>}
          </span>
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
